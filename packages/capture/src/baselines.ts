import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { EnvironmentFingerprint } from './environment.ts';
import type { FixtureManifest } from './fixture.ts';

/**
 * Baselines at M0: PNGs on disk in a gitignored directory, keyed by
 * `storyId + mode + viewport`.
 *
 * This is the degraded single-user mode. Committing baselines to Git is an
 * explicit opt-in, not the default, because it produces merge conflicts and
 * review-by-PNG — a problem this product exists to solve. The review server at
 * M1 replaces local baselines; nothing should be built on the assumption that
 * they are permanent.
 */

export const BASELINE_MANIFEST = 'manifest.json';

export interface BaselineEntry {
  key: string;
  /** Hash of the decoded RGBA pixels, so an unchanged story skips the diff. */
  hash: string;
  width: number;
  height: number;
  updatedAt: string;
}

export interface BaselineManifest {
  version: 1;
  /**
   * Environment the baselines were captured in. Comparing against a baseline
   * from a different environment produces differences that are not visual
   * changes, so a mismatch is warned about rather than reported as a diff.
   */
  fingerprint?: EnvironmentFingerprint;
  /**
   * Fixture build the baselines were captured against, for builds that carry
   * a `snapcheck-fixture.json`. A different fixture invalidates every entry.
   */
  fixture?: FixtureManifest;
  entries: Record<string, BaselineEntry>;
}

export function emptyManifest(): BaselineManifest {
  return { version: 1, entries: {} };
}

export function baselinePath(baselineDir: string, key: string): string {
  return path.join(baselineDir, `${key}.png`);
}

/** Reads the manifest, treating a missing one as "no baselines yet". */
export async function readBaselineManifest(baselineDir: string): Promise<BaselineManifest> {
  try {
    const raw = await readFile(path.join(baselineDir, BASELINE_MANIFEST), 'utf8');
    const parsed = JSON.parse(raw) as BaselineManifest;
    return {
      version: 1,
      fingerprint: parsed.fingerprint,
      fixture: parsed.fixture,
      entries: parsed.entries ?? {},
    };
  } catch {
    return emptyManifest();
  }
}

export async function writeBaselineManifest(
  baselineDir: string,
  manifest: BaselineManifest,
): Promise<void> {
  await mkdir(baselineDir, { recursive: true });
  await writeFile(path.join(baselineDir, BASELINE_MANIFEST), JSON.stringify(manifest, null, 2));
}

/** Writes one baseline image and returns its manifest entry. */
export async function promoteBaseline(
  baselineDir: string,
  key: string,
  png: Uint8Array,
  image: { hash: string; width: number; height: number },
): Promise<BaselineEntry> {
  await mkdir(baselineDir, { recursive: true });
  await writeFile(baselinePath(baselineDir, key), png);
  return {
    key,
    hash: image.hash,
    width: image.width,
    height: image.height,
    updatedAt: new Date().toISOString(),
  };
}
