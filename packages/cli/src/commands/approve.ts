import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  decodePng,
  fixtureDifferences,
  pixelHash,
  promoteBaseline,
  readBaselineManifest,
  writeBaselineManifest,
  type SnapshotRunResult,
} from '@snapcheck/capture';

/**
 * `snapcheck approve`: promote the last run's changed stories to baseline.
 * The local stand-in for the review server's approve at M1.
 */

export interface ApproveInput {
  root: string;
}

async function lastRunDir(snapcheckDir: string): Promise<string | null> {
  try {
    const entries = await readdir(path.join(snapcheckDir, 'runs'));
    const sorted = entries.toSorted();
    const last = sorted.at(-1);
    return last ? path.join(snapcheckDir, 'runs', last) : null;
  } catch {
    return null;
  }
}

export async function runApprove(input: ApproveInput): Promise<number> {
  const snapcheckDir = path.join(input.root, '.snapcheck');
  const runDir = await lastRunDir(snapcheckDir);
  if (!runDir) {
    console.error(
      `No runs found in ${path.join(snapcheckDir, 'runs')}. Run \`snapcheck snapshot\` first.`,
    );
    return 2;
  }

  let run: SnapshotRunResult;
  try {
    run = JSON.parse(
      await readFile(path.join(runDir, 'results.json'), 'utf8'),
    ) as SnapshotRunResult;
  } catch (error) {
    console.error(
      `Could not read ${path.join(runDir, 'results.json')}: ${(error as Error).message}`,
    );
    return 2;
  }

  const baselineDir = path.join(snapcheckDir, 'baselines');
  const manifest = await readBaselineManifest(baselineDir);

  // A run from before a fixture re-baseline must not be mixed into baselines
  // for a different fixture build.
  const fixtureChange = fixtureDifferences(manifest.fixture, run.fixture);
  if (Object.keys(manifest.entries).length > 0 && fixtureChange.length > 0) {
    console.error(
      `Not approving ${runDir}: it captured a different fixture build than the baselines.\n` +
        fixtureChange.map((line) => `  ${line}`).join('\n'),
    );
    return 2;
  }

  const changed = run.results.filter(
    (result) => result.status === 'changed' || result.status === 'quarantined',
  );

  let promoted = 0;
  for (const result of changed) {
    if (!result.files.current) continue;
    // oxlint-disable-next-line no-await-in-loop -- one image in memory at a time
    const bytes = await readFile(path.join(runDir, result.files.current));
    const image = decodePng(bytes);
    // oxlint-disable-next-line no-await-in-loop
    manifest.entries[result.key] = await promoteBaseline(baselineDir, result.key, bytes, {
      hash: pixelHash(image),
      width: image.width,
      height: image.height,
    });
    promoted++;
  }

  manifest.fingerprint = run.fingerprint;
  await writeBaselineManifest(baselineDir, manifest);

  console.log(`Approved ${promoted} capture${promoted === 1 ? '' : 's'} from ${runDir}`);
  return 0;
}
