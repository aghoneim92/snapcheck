import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { captureStub, type StubHarness } from '../stub/capture.ts';
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
    'reduced-motion': { type: 'boolean', default: false },
    'disable-gpu': { type: 'boolean', default: false },
    'force-software-rendering': { type: 'boolean', default: false },
  },
});

const harness: StubHarness = {
  reducedMotion: values['reduced-motion'],
  disableGpu: values['disable-gpu'],
  forceSoftwareRendering: values['force-software-rendering'],
};

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
        .join(', ') || 'none (naive stub)'
    }`,
  );

  if (report.fingerprintMismatches.length > 0) {
    console.log('\n!! Fingerprint changed between runs; results are not comparable:');
    for (const mismatch of report.fingerprintMismatches) console.log(`   ${mismatch}`);
  }

  const unstable = report.stories.filter(
    (story) => story.differingRuns > 0 || story.failedRuns > 0,
  );
  const compared = report.runs - 1;
  console.log(
    `\n${report.stories.length - unstable.length}/${report.stories.length} stories stable across ${report.runs} runs`,
  );
  if (unstable.length === 0) return;

  console.log('\nUnstable stories, worst first:\n');
  const idWidth = Math.max(...unstable.map((story) => story.id.length), 5);
  console.log(`  ${'story'.padEnd(idWidth)}  differed  failed  renders  max changed  per run`);
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
    const manifest = await captureStub({ staticDir, outDir: dir, harness });
    const failed = manifest.stories.filter((story) => story.error).length;
    console.log(
      `run ${index}/${runCount}: ${manifest.stories.length} stories, ${failed} failed, concurrency ${manifest.concurrency}, ${((performance.now() - started) / 1000).toFixed(1)}s`,
    );
    runs.push({ dir, fingerprint: manifest.fingerprint, stories: manifest.stories });
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
