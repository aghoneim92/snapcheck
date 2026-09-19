import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  captureStories,
  globToRegExp,
  parseHttpCacheMode,
  renderReport,
  resolveHttpCache,
  runSnapshot,
  type HarnessConfig,
  type SnapcheckConfig,
  type SnapshotRunResult,
} from '@snapcheck/capture';

import { runDeterminism } from './determinism.ts';

export interface SnapshotCommandInput {
  config: SnapcheckConfig;
  /** Directory the config file lives in; relative paths resolve against it. */
  root: string;
  values: Record<string, string | boolean | undefined>;
}

function harnessFrom(values: SnapshotCommandInput['values']): HarnessConfig {
  const off = (flag: string) => values[flag] === true;
  return {
    reducedMotion: !off('no-reduced-motion'),
    freezeAnimations: !off('no-freeze-animations'),
    waitForFonts: !off('no-wait-for-fonts'),
    waitForNetworkIdle: !off('no-wait-for-network-idle'),
    hideCaret: !off('no-hide-caret'),
    hideScrollbars: !off('no-hide-scrollbars'),
    fixedDeviceScaleFactor: !off('no-fixed-device-scale-factor'),
    fixedViewport: !off('no-fixed-viewport'),
    disableGpu: values['disable-gpu'] === true,
    forceSoftwareRendering: values['force-software-rendering'] === true,
  };
}

function summarize(run: SnapshotRunResult): void {
  const { counts } = run;
  console.log(
    `\n${counts.changed} changed · ${counts.new} new · ${counts.unchanged} unchanged · ` +
      `${counts.failed} failed · ${counts.quarantined} quarantined`,
  );
  if (run.fingerprintMismatch.length > 0) {
    console.warn('\nWarning: baselines were captured in a different environment.');
    console.warn('Differences may not be visual changes:');
    for (const line of run.fingerprintMismatch) console.warn(`  ${line}`);
  }
  if (run.httpCache) {
    const cache = run.httpCache;
    const size = `${(cache.bytes / 1024 / 1024).toFixed(2)} MB`;
    console.log(
      cache.mode === 'record'
        ? `\nHTTP cache: recorded ${cache.entries} responses (${size}) to ${cache.dir}`
        : `\nHTTP cache: replayed ${cache.hits} requests from ${cache.entries} cached responses (${size})`,
    );
    for (const failure of cache.recordFailures) console.warn(`  could not record: ${failure}`);
    for (const miss of cache.misses) console.warn(`  not in cache: ${miss}`);
  }
  if (run.wroteNewBaselines) {
    console.warn('\nWarning: new baselines were written; nothing was compared for those stories.');
    if (run.httpCache?.mode === 'record') {
      console.warn(
        'They come from a recording run, which waits on the live network. Re-baseline in replay\n' +
          '(snapshot --update) before trusting them.',
      );
    }
  }
  for (const result of run.results) {
    if (result.status === 'changed' || result.status === 'failed') {
      console.log(`  ${result.status}: ${result.key}${result.error ? ` — ${result.error}` : ''}`);
    }
  }
}

export async function runSnapshotCommand(input: SnapshotCommandInput): Promise<number> {
  const { values } = input;
  const config: SnapcheckConfig = {
    ...input.config,
    staticDir: path.resolve(
      input.root,
      typeof values['static-dir'] === 'string' ? values['static-dir'] : input.config.staticDir,
    ),
    harness: { ...input.config.harness, ...harnessFrom(values) },
  };

  const filterGlob = typeof values.filter === 'string' ? values.filter : undefined;
  const filter = filterGlob
    ? (storyId: string) => globToRegExp(filterGlob).test(storyId)
    : undefined;
  const concurrency =
    typeof values.concurrency === 'string' ? Number(values.concurrency) : undefined;
  const httpCacheMode =
    typeof values['http-cache'] === 'string' ? parseHttpCacheMode(values['http-cache']) : undefined;
  const snapcheckDir = path.join(input.root, '.snapcheck');

  // Determinism mode: capture repeatedly and require pixel-identical results.
  // Wired to the exact comparison only — it must never read a user threshold.
  const runCount = typeof values.runs === 'string' ? Number(values.runs) : 1;
  if (runCount > 1) {
    const httpCache = await resolveHttpCache({
      config: config.httpCache,
      mode: httpCacheMode,
      snapcheckDir,
      staticDir: config.staticDir,
      root: input.root,
    });
    const captureOnce = (outDir: string, cache: typeof httpCache) =>
      captureStories({
        staticDir: config.staticDir,
        outDir,
        concurrency,
        viewports: config.snapshot?.viewports,
        harness: config.harness,
        stories: config.stories,
        index: config.index,
        filter,
        httpCache: cache,
      });
    // Record once, outside the comparison: a recording run still waits on the
    // live network. The compared runs replay it.
    let comparedCache = httpCache;
    if (httpCache.mode === 'record') {
      const recording = await captureOnce(
        path.join(snapcheckDir, 'determinism', 'record'),
        httpCache,
      );
      const cache = recording.httpCache;
      console.log(
        `Recorded ${cache?.entries ?? 0} responses (${((cache?.bytes ?? 0) / 1024 / 1024).toFixed(2)} MB); comparing replays.`,
      );
      for (const failure of cache?.recordFailures ?? [])
        console.warn(`  could not record: ${failure}`);
      comparedCache = { ...httpCache, mode: 'replay' };
    }
    return await runDeterminism({
      capture: (outDir) => captureOnce(outDir, comparedCache),
      runs: runCount,
      outDir: path.join(input.root, '.snapcheck', 'determinism'),
    });
  }

  const run = await runSnapshot({
    config,
    snapcheckDir,
    update: values.update === true,
    concurrency,
    filter,
    httpCacheMode,
    root: input.root,
  });

  await mkdir(run.runDir, { recursive: true });
  await writeFile(path.join(run.runDir, 'report.html'), await renderReport(run));

  summarize(run);
  console.log(`\nReport: ${path.join(run.runDir, 'report.html')}`);

  // Quarantined stories never fail the run; that is the point of quarantine.
  if (run.counts.changed > 0 || run.counts.failed > 0) return 1;
  return 0;
}
