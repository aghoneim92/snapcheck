import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  captureStories,
  globToRegExp,
  renderReport,
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
  if (run.wroteNewBaselines) {
    console.warn('\nWarning: new baselines were written; nothing was compared for those stories.');
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

  // Determinism mode: capture repeatedly and require pixel-identical results.
  // Wired to the exact comparison only — it must never read a user threshold.
  const runCount = typeof values.runs === 'string' ? Number(values.runs) : 1;
  if (runCount > 1) {
    return await runDeterminism({
      capture: (outDir) =>
        captureStories({
          staticDir: config.staticDir,
          outDir,
          concurrency,
          viewports: config.snapshot?.viewports,
          harness: config.harness,
          stories: config.stories,
          index: config.index,
          filter,
        }),
      runs: runCount,
      outDir: path.join(input.root, '.snapcheck', 'determinism'),
    });
  }

  const run = await runSnapshot({
    config,
    snapcheckDir: path.join(input.root, '.snapcheck'),
    update: values.update === true,
    concurrency,
    filter,
  });

  await mkdir(run.runDir, { recursive: true });
  await writeFile(path.join(run.runDir, 'report.html'), await renderReport(run));

  summarize(run);
  console.log(`\nReport: ${path.join(run.runDir, 'report.html')}`);

  // Quarantined stories never fail the run; that is the point of quarantine.
  if (run.counts.changed > 0 || run.counts.failed > 0) return 1;
  return 0;
}
