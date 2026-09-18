import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import type { HarnessConfig } from '../config.ts';
import { captureStories } from '../runner/capture.ts';
import { compareRuns, type RigReport, type RigRun } from './determinism.ts';

/**
 * `pnpm rig:determinism`: capture the same build N times and fail unless every
 * run is pixel-identical to the first. Runs at the default concurrency on
 * purpose; see `defaultConcurrency`.
 *
 * Exit codes: 0 stable, 1 unstable, 2 error.
 */

const { values } = parseArgs({
  options: {
    'static-dir': { type: 'string' },
    runs: { type: 'string', default: '10' },
    out: { type: 'string', default: '.snapcheck/rig' },
    /** Single viewport by default: every extra one multiplies rig runtime. */
    viewports: { type: 'string', default: '1280' },
    'no-reduced-motion': { type: 'boolean', default: false },
    'no-freeze-animations': { type: 'boolean', default: false },
    'no-wait-for-fonts': { type: 'boolean', default: false },
    'no-wait-for-network-idle': { type: 'boolean', default: false },
    'no-hide-caret': { type: 'boolean', default: false },
    'no-hide-scrollbars': { type: 'boolean', default: false },
    'no-fixed-device-scale-factor': { type: 'boolean', default: false },
    'no-fixed-viewport': { type: 'boolean', default: false },
    'disable-gpu': { type: 'boolean', default: false },
    'force-software-rendering': { type: 'boolean', default: false },
  },
});

// Every technique is on unless turned off, so a rig run can bisect one flag
// at a time and attribute a fix to it.
const harness: HarnessConfig = {
  reducedMotion: !values['no-reduced-motion'],
  freezeAnimations: !values['no-freeze-animations'],
  waitForFonts: !values['no-wait-for-fonts'],
  waitForNetworkIdle: !values['no-wait-for-network-idle'],
  hideCaret: !values['no-hide-caret'],
  hideScrollbars: !values['no-hide-scrollbars'],
  fixedDeviceScaleFactor: !values['no-fixed-device-scale-factor'],
  fixedViewport: !values['no-fixed-viewport'],
  disableGpu: values['disable-gpu'],
  forceSoftwareRendering: values['force-software-rendering'],
};
const viewports = values.viewports.split(',').map((width) => Number(width.trim()));

function formatPercent(fraction: number): string {
  if (fraction === 0) return '0';
  return fraction < 0.0001
    ? `${(fraction * 100).toExponential(1)}%`
    : `${(fraction * 100).toFixed(3)}%`;
}

function printReport(report: RigReport, run: RigRun): void {
  const { fingerprint } = run;
  console.log('\nEnvironment');
  console.log(`  ${fingerprint.os} ${fingerprint.arch}`);
  console.log(
    `  Chromium ${fingerprint.chromiumVersion}, Playwright ${fingerprint.playwrightVersion}`,
  );
  console.log(`  headless=${fingerprint.headlessMode} dsf=${fingerprint.deviceScaleFactor}`);
  console.log(`  gpu=${fingerprint.gpu.active} (${fingerprint.gpu.renderer})`);
  console.log(
    `\nHarness: ${
      Object.entries(harness)
        .filter(([, on]) => on)
        .map(([name]) => name)
        .join(', ') || 'none'
    }`,
  );
  console.log(`Viewports: ${viewports.join(', ')}`);

  if (report.fingerprintMismatches.length > 0) {
    console.log('\n!! Fingerprint changed between runs; results are not comparable:');
    for (const mismatch of report.fingerprintMismatches) console.log(`   ${mismatch}`);
  }

  const unstable = report.stories.filter(
    (story) => story.differingRuns > 0 || story.failedRuns > 0,
  );
  const compared = report.runs - 1;
  console.log(
    `\n${report.stories.length - unstable.length}/${report.stories.length} captures stable across ${report.runs} runs`,
  );
  if (unstable.length === 0) return;

  console.log('\nUnstable captures, worst first:\n');
  const idWidth = Math.max(...unstable.map((story) => story.id.length), 7);
  console.log(`  ${'capture'.padEnd(idWidth)}  differed  failed  renders  max changed  per run`);
  for (const story of unstable) {
    const perRun = story.fractions.map((fraction) =>
      fraction === null ? '-' : formatPercent(fraction),
    );
    console.log(
      `  ${story.id.padEnd(idWidth)}  ${`${story.differingRuns}/${compared}`.padStart(8)}  ${String(story.failedRuns).padStart(6)}  ${String(story.distinctRenders).padStart(7)}  ${formatPercent(story.maxChangedFraction).padStart(11)}${story.dimensionMismatch ? '*' : ' '} ${perRun.join(' ')}`,
    );
  }
  if (unstable.some((story) => story.dimensionMismatch)) {
    console.log('\n  * page dimensions differed between runs');
  }
}

async function main(): Promise<number> {
  const staticDir = values['static-dir'];
  const runCount = Number(values.runs);
  if (!staticDir || !Number.isInteger(runCount) || runCount < 2) {
    console.error(
      'Usage: rig:determinism --static-dir <storybook-static> [--runs <n ≥ 2>] [--out <dir>]',
    );
    return 2;
  }

  const root = path.resolve(values.out, new Date().toISOString().replaceAll(':', '-'));
  const runs: RigRun[] = [];
  for (let index = 1; index <= runCount; index++) {
    const dir = path.join(root, `run-${String(index).padStart(2, '0')}`);
    const started = performance.now();
    // Runs must not overlap: each one stands in for a separate CI run.
    // oxlint-disable-next-line no-await-in-loop
    const run = await captureStories({ staticDir, outDir: dir, harness, viewports });
    const failures = run.results.filter((result) => result.status === 'failed');
    console.log(
      `run ${index}/${runCount}: ${run.results.length} captures, ${failures.length} failed, concurrency ${run.concurrency}, ${((performance.now() - started) / 1000).toFixed(1)}s`,
    );
    for (const failure of failures.slice(0, 5)) {
      console.log(
        `    ${failure.key}: ${failure.renderError ? 'render error: ' : ''}${failure.error}`,
      );
    }
    runs.push({
      dir,
      fingerprint: run.fingerprint,
      stories: run.results.map((result) => ({
        id: result.key,
        file: result.file,
        error: result.error,
      })),
    });
  }

  const report = await compareRuns(runs);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'report.json'), JSON.stringify({ harness, ...report }, null, 2));
  printReport(report, runs[0] as RigRun);
  console.log(`\nReport: ${path.join(root, 'report.json')}`);
  return report.stable ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(2);
  },
);
