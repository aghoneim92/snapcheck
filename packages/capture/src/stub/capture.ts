import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_HEADLESS_MODE, gpuArgs, launchChromium } from '../browser.ts';
import { captureFingerprint, type EnvironmentFingerprint } from '../environment.ts';
import { defaultConcurrency, runPool } from '../pool.ts';
import { serveStatic } from '../serve.ts';
import { readStoryIndex } from '../storybookIndex.ts';
import { installRenderTracker, waitForFonts, waitForStoryRender } from './wait.ts';

/**
 * PHASE 1 STUB. The naive capture the determinism rig is proven against:
 * navigate, screenshot, save. No waiting beyond page load, no stabilization,
 * no harness. It exists so the rig demonstrably fails before anything hides
 * the flake. Replaced by the real runner in Phase 3.
 */

export interface StubStoryResult {
  id: string;
  /** PNG path relative to the run directory; absent when capture failed. */
  file?: string;
  error?: string;
  durationMs: number;
}

/**
 * Harness techniques the stub can opt into, one at a time, so the rig can
 * attribute which one fixed which flake. Names match the Phase 4 flags where
 * one exists. All off by default: the stub's job is to show the raw flake.
 */
export interface StubHarness {
  /** Playwright's `reducedMotion: 'reduce'`, i.e. `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean;
  /** `--disable-gpu`. */
  disableGpu?: boolean;
  /** CPU raster and compositing, SwiftShader GL. */
  forceSoftwareRendering?: boolean;
  /**
   * Wait for Storybook's `storyRendered` event before capturing. Prototype
   * name: the Phase 3 runner always does this, so it will not stay a flag.
   */
  waitForRender?: boolean;
  /** Wait for stylesheets, then for every font the page uses to load. */
  waitForFonts?: boolean;
}

export interface StubRunManifest {
  fingerprint: EnvironmentFingerprint;
  concurrency: number;
  harness: Required<StubHarness>;
  stories: StubStoryResult[];
}

export interface StubCaptureOptions {
  staticDir: string;
  outDir: string;
  concurrency?: number;
  harness?: StubHarness;
}

export async function captureStub(options: StubCaptureOptions): Promise<StubRunManifest> {
  const concurrency = options.concurrency ?? defaultConcurrency();
  const harness: Required<StubHarness> = {
    reducedMotion: options.harness?.reducedMotion ?? false,
    disableGpu: options.harness?.disableGpu ?? false,
    forceSoftwareRendering: options.harness?.forceSoftwareRendering ?? false,
    waitForRender: options.harness?.waitForRender ?? false,
    waitForFonts: options.harness?.waitForFonts ?? false,
  };
  const index = await readStoryIndex(options.staticDir);
  const storyIds = index.stories.map((story) => story.id);
  await mkdir(options.outDir, { recursive: true });

  const server = await serveStatic(options.staticDir);
  const browser = await launchChromium({
    headlessMode: DEFAULT_HEADLESS_MODE,
    args: gpuArgs(harness),
  });
  try {
    const fingerprint = await captureFingerprint(browser, { headlessMode: DEFAULT_HEADLESS_MODE });

    const stories = await runPool(storyIds, concurrency, async (id) => {
      const started = performance.now();
      const context = await browser
        .newContext(harness.reducedMotion ? { reducedMotion: 'reduce' } : {})
        .catch((error: unknown) => error as Error);
      if (context instanceof Error) {
        return { id, error: String(context), durationMs: performance.now() - started };
      }
      try {
        const page = await context.newPage();
        if (harness.waitForRender) await installRenderTracker(page);

        await page.goto(`${server.origin}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`);
        if (harness.waitForRender) await waitForStoryRender(page);
        if (harness.waitForFonts) await waitForFonts(page);

        const file = `${id}.png`;
        await page.screenshot({ path: path.join(options.outDir, file), fullPage: true });
        return { id, file, durationMs: performance.now() - started };
      } catch (error) {
        return { id, error: String(error), durationMs: performance.now() - started };
      } finally {
        await context.close().catch(() => undefined);
      }
    });

    const manifest: StubRunManifest = { fingerprint, concurrency, harness, stories };
    await writeFile(path.join(options.outDir, 'run.json'), JSON.stringify(manifest, null, 2));
    return manifest;
  } finally {
    await browser.close();
    await server.close();
  }
}
