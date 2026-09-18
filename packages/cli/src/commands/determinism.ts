import path from 'node:path';

import { compareRuns, type CaptureRunResult, type RigRun } from '@snapcheck/capture';

/**
 * `snapcheck snapshot --runs <n>`: capture the same build n times and require
 * every run to be pixel-identical.
 *
 * Deliberately wired to the exact comparison, with no access to the user's
 * threshold: flake below that threshold is exactly what this mode exists to
 * catch.
 */

export interface DeterminismInput {
  capture: (outDir: string) => Promise<CaptureRunResult>;
  runs: number;
  outDir: string;
}

export async function runDeterminism(input: DeterminismInput): Promise<number> {
  const root = path.join(input.outDir, new Date().toISOString().replaceAll(':', '-'));
  const runs: RigRun[] = [];

  for (let index = 1; index <= input.runs; index++) {
    const dir = path.join(root, `run-${String(index).padStart(2, '0')}`);
    // Runs must not overlap: each stands in for a separate CI run.
    // oxlint-disable-next-line no-await-in-loop
    const run = await input.capture(dir);
    const failed = run.results.filter((result) => result.status === 'failed').length;
    console.log(`run ${index}/${input.runs}: ${run.results.length} captures, ${failed} failed`);
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
  const unstable = report.stories.filter(
    (story) => story.differingRuns > 0 || story.failedRuns > 0,
  );
  console.log(
    `\n${report.stories.length - unstable.length}/${report.stories.length} captures stable across ${report.runs} runs`,
  );
  for (const story of unstable) {
    console.log(
      `  ${story.id}: differed in ${story.differingRuns}/${report.runs - 1}, worst ${(story.maxChangedFraction * 100).toFixed(3)}%`,
    );
  }
  return report.stable ? 0 : 1;
}
