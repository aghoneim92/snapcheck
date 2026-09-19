import { createRequire } from 'node:module';
import os from 'node:os';

import type { Browser } from 'playwright';

import type { HeadlessMode } from './browser.ts';
import type { HttpCacheMode } from './httpCache.ts';

/**
 * Everything outside the story itself that changes rendered pixels. Snapshots
 * are only comparable between runs with equal fingerprints: macOS and Linux,
 * or GPU and software raster, will never match pixel for pixel, and that must
 * be reported as an environment mismatch rather than as a visual change.
 */
export interface EnvironmentFingerprint {
  os: string;
  arch: string;
  chromiumVersion: string;
  playwrightVersion: string;
  deviceScaleFactor: number;
  headlessMode: HeadlessMode;
  gpu: {
    /** False when Chromium composites and rasterizes in software. */
    active: boolean;
    /** WebGL renderer string, e.g. `ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max)`. */
    renderer: string;
  };
  /**
   * Where external responses came from. A baseline captured against the live
   * network is not comparable to one captured from a cache, nor to one from a
   * different cache. Absent on fingerprints written before the field existed,
   * which were all captured against the network.
   */
  httpCache?: { mode: HttpCacheMode; manifestHash?: string };
}

/**
 * Record and replay serve the same cached bytes, so they compare by the cache
 * they served; bypass is the live network.
 */
function httpCacheSource(httpCache: EnvironmentFingerprint['httpCache']): string {
  if (!httpCache || httpCache.mode === 'bypass') return 'network';
  return `cache ${httpCache.manifestHash ?? 'unknown'}`;
}

const require = createRequire(import.meta.url);

export async function captureFingerprint(
  browser: Browser,
  options: { headlessMode: HeadlessMode; deviceScaleFactor?: number },
): Promise<EnvironmentFingerprint> {
  const { version: playwrightVersion } = require('playwright/package.json') as { version: string };

  const context = await browser.newContext(
    options.deviceScaleFactor === undefined ? {} : { deviceScaleFactor: options.deviceScaleFactor },
  );
  try {
    const page = await context.newPage();
    const probe = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'none';
      return { renderer, deviceScaleFactor: window.devicePixelRatio };
    });

    return {
      os: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      chromiumVersion: browser.version(),
      playwrightVersion,
      deviceScaleFactor: probe.deviceScaleFactor,
      headlessMode: options.headlessMode,
      gpu: {
        active: !/swiftshader|llvmpipe|software|none/i.test(probe.renderer),
        renderer: probe.renderer,
      },
    };
  } finally {
    await context.close();
  }
}

function flat(f: EnvironmentFingerprint): Record<string, string> {
  return {
    os: f.os,
    arch: f.arch,
    chromiumVersion: f.chromiumVersion,
    playwrightVersion: f.playwrightVersion,
    deviceScaleFactor: String(f.deviceScaleFactor),
    headlessMode: f.headlessMode,
    'gpu.active': String(f.gpu.active),
    'gpu.renderer': f.gpu.renderer,
    httpCache: httpCacheSource(f.httpCache),
  };
}

/** Field-by-field differences, empty when the fingerprints match. */
export function fingerprintDifferences(
  a: EnvironmentFingerprint,
  b: EnvironmentFingerprint,
): string[] {
  const left = flat(a);
  const right = flat(b);
  return Object.keys(left)
    .filter((key) => left[key] !== right[key])
    .map((key) => `${key}: ${left[key]} → ${right[key]}`);
}
