import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import type { Browser } from 'playwright';

import { DEFAULT_HEADLESS_MODE, gpuArgs, launchChromium } from '../browser.ts';
import {
  DEFAULT_HARNESS,
  storySettingsFor,
  type HarnessConfig,
  type StorySettings,
} from '../config.ts';
import { captureFingerprint, type EnvironmentFingerprint } from '../environment.ts';
import { defaultConcurrency, runPool } from '../pool.ts';
import { serveStatic } from '../serve.ts';
import { readStoryIndex, type ReadStoryIndexOptions } from '../storybookIndex.ts';
import { buildHarnessCss, contextOptionsFor } from './harness.ts';
import {
  assertNoErrorOverlay,
  installRenderTracker,
  waitForFonts,
  waitForStoryRender,
} from './wait.ts';

/**
 * The capture runner: serve the build, render each story in isolation, save a
 * PNG per story and viewport.
 *
 * Every story is independent. One that throws, times out or renders an error
 * boundary is recorded as failed and the run continues — a single bad story
 * must never end a run.
 */

/** Height of the capture window; `fullPage` grows past it. */
const VIEWPORT_HEIGHT = 720;
const NAVIGATION_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_TIMEOUT_MS = 10_000;

export interface CaptureResult {
  /** `storyId + mode + viewport`, the key baselines are stored under. */
  key: string;
  storyId: string;
  mode: string;
  viewport: number;
  status: 'captured' | 'failed';
  /** PNG path relative to the run directory; absent when capture failed. */
  file?: string;
  error?: string;
  /** True when Storybook itself reported a render failure. */
  renderError?: boolean;
  durationMs: number;
}

export interface CaptureRunResult {
  fingerprint: EnvironmentFingerprint;
  concurrency: number;
  harness: Required<HarnessConfig>;
  /** Index format version the story list came from. */
  indexVersion: 3 | 4 | 5;
  results: CaptureResult[];
}

export interface CaptureOptions {
  staticDir: string;
  outDir: string;
  /**
   * Pages in flight. Defaults to half the logical CPUs. Concurrency is itself
   * a flake source — parallel pages contend for CPU and GPU, which changes
   * paint timing — so the determinism rig runs at the default, because that is
   * what users get.
   */
  concurrency?: number;
  viewports?: number[];
  harness?: HarnessConfig;
  /** Per-story settings keyed by story-ID glob. */
  stories?: Record<string, StorySettings>;
  index?: ReadStoryIndexOptions;
  /** Restrict the run to story IDs passing this test. */
  filter?: (storyId: string) => boolean;
}

interface Task {
  storyId: string;
  viewport: number;
  mode: string;
  settings: StorySettings;
}

function keyFor(storyId: string, mode: string, viewport: number): string {
  return `${storyId}__${mode}__${viewport}`;
}

export async function captureStories(options: CaptureOptions): Promise<CaptureRunResult> {
  const concurrency = options.concurrency ?? defaultConcurrency();
  const harness: Required<HarnessConfig> = { ...DEFAULT_HARNESS, ...options.harness };
  const viewports = options.viewports ?? [1280];
  const storyConfig = options.stories ?? {};

  const index = await readStoryIndex(options.staticDir, options.index);
  const tasks: Task[] = [];
  for (const story of index.stories) {
    if (options.filter && !options.filter(story.id)) continue;
    const settings = storySettingsFor(storyConfig, story.id);
    if (settings.disable) continue;
    for (const viewport of settings.viewports ?? viewports) {
      tasks.push({ storyId: story.id, viewport, mode: 'default', settings });
    }
  }

  await mkdir(options.outDir, { recursive: true });
  const server = await serveStatic(options.staticDir);
  const launch = () =>
    launchChromium({ headlessMode: DEFAULT_HEADLESS_MODE, args: gpuArgs(harness) });
  let browser = await launch();

  // A crashed browser (OOM, for instance) would otherwise fail every remaining
  // story; relaunch once per detection, with only one relaunch in flight.
  let relaunching: Promise<void> | undefined;
  const ensureBrowser = async (): Promise<Browser> => {
    if (browser.isConnected()) return browser;
    relaunching ??= (async () => {
      browser = await launch();
    })().finally(() => {
      relaunching = undefined;
    });
    await relaunching;
    return browser;
  };

  try {
    const fingerprint = await captureFingerprint(browser, { headlessMode: DEFAULT_HEADLESS_MODE });

    const results = await runPool(tasks, concurrency, async (task): Promise<CaptureResult> => {
      const started = performance.now();
      const key = keyFor(task.storyId, task.mode, task.viewport);
      const base = { key, storyId: task.storyId, mode: task.mode, viewport: task.viewport };

      try {
        const active = await ensureBrowser();
        const context = await active.newContext(
          contextOptionsFor(harness, { width: task.viewport, height: VIEWPORT_HEIGHT }),
        );
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
          await installRenderTracker(page);

          const url = `${server.origin}/iframe.html?id=${encodeURIComponent(task.storyId)}&viewMode=story`;
          await page.goto(url, { timeout: NAVIGATION_TIMEOUT_MS });
          await waitForStoryRender(page);
          await assertNoErrorOverlay(page);

          const css = buildHarnessCss(harness);
          if (css) await page.addStyleTag({ content: css });
          if (harness.waitForNetworkIdle) {
            // Bounded and non-fatal: a page that never goes idle (polling, a
            // long-lived connection) must not fail an otherwise good capture.
            await page
              .waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS })
              .catch(() => undefined);
          }
          if (harness.waitForFonts) await waitForFonts(page);
          if (task.settings.waitFor) {
            await page.waitForSelector(task.settings.waitFor, { state: 'visible' });
          }
          if (task.settings.delay) await sleep(task.settings.delay);

          const file = `${key}.png`;
          await page.screenshot({ path: path.join(options.outDir, file), fullPage: true });
          return { ...base, status: 'captured', file, durationMs: performance.now() - started };
        } finally {
          await context.close().catch(() => undefined);
        }
      } catch (error) {
        return {
          ...base,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          renderError: (error as Error).name === 'StoryRenderError',
          durationMs: performance.now() - started,
        };
      }
    });

    const run: CaptureRunResult = {
      fingerprint,
      concurrency,
      harness,
      indexVersion: index.version,
      results,
    };
    await writeFile(path.join(options.outDir, 'run.json'), JSON.stringify(run, null, 2));
    return run;
  } finally {
    await browser.close().catch(() => undefined);
    await server.close();
  }
}
