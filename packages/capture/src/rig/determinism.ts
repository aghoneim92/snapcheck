import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { fingerprintDifferences, type EnvironmentFingerprint } from '../environment.ts';
import { decodePng, exactDiff, pixelHash, type DecodedImage } from '../pixels.ts';

/**
 * The determinism rig compares N captures of the same build against each other.
 *
 * It is wired to `exactDiff` only and imports nothing from user config: runs
 * at the same commit must be pixel-identical, with zero tolerance. A story
 * that flickers by 0.001% is exactly the flake this product exists to catch,
 * so no regression threshold may ever apply here.
 */

export interface RigRun {
  dir: string;
  fingerprint: EnvironmentFingerprint;
  stories: { id: string; file?: string; error?: string }[];
}

export interface StoryStability {
  id: string;
  /** Runs whose pixels differed from the reference run (the first successful one). */
  differingRuns: number;
  /** Runs where capture itself failed. */
  failedRuns: number;
  /** Runs compared against the reference. */
  comparedRuns: number;
  /** Worst changed-pixel fraction across compared runs, 0–1. */
  maxChangedFraction: number;
  /** Changed-pixel fraction per run, `null` for the reference or failed runs. */
  fractions: (number | null)[];
  /** Distinct pixel hashes seen, a quick read on how many render variants exist. */
  distinctRenders: number;
  dimensionMismatch: boolean;
}

export interface RigReport {
  runs: number;
  stable: boolean;
  fingerprintMismatches: string[];
  stories: StoryStability[];
}

export async function compareRuns(runs: readonly RigRun[]): Promise<RigReport> {
  const reference = runs[0];
  if (!reference) throw new Error('compareRuns needs at least one run.');

  const fingerprintMismatches = runs
    .slice(1)
    .flatMap((run, offset) =>
      fingerprintDifferences(reference.fingerprint, run.fingerprint).map(
        (difference) => `run ${offset + 2}: ${difference}`,
      ),
    );

  const ids = [...new Set(runs.flatMap((run) => run.stories.map((story) => story.id)))];
  const stories: StoryStability[] = [];

  for (const id of ids) {
    const images: (DecodedImage | null)[] = [];
    for (const run of runs) {
      const entry = run.stories.find((story) => story.id === id);
      // One decode at a time: a full-page capture is tens of MB of RGBA.
      // oxlint-disable-next-line no-await-in-loop
      images.push(entry?.file ? decodePng(await readFile(path.join(run.dir, entry.file))) : null);
    }

    const referenceIndex = images.findIndex((image) => image !== null);
    const referenceImage = referenceIndex === -1 ? null : images[referenceIndex];
    const referenceHash = referenceImage ? pixelHash(referenceImage) : null;
    const hashes = new Set<string>();
    const result: StoryStability = {
      id,
      differingRuns: 0,
      failedRuns: images.filter((image) => image === null).length,
      comparedRuns: 0,
      maxChangedFraction: 0,
      fractions: [],
      distinctRenders: 0,
      dimensionMismatch: false,
    };

    images.forEach((image, index) => {
      if (!image || !referenceImage || index === referenceIndex) {
        if (image) hashes.add(pixelHash(image));
        result.fractions.push(null);
        return;
      }
      result.comparedRuns++;
      const hash = pixelHash(image);
      hashes.add(hash);
      if (hash === referenceHash) {
        result.fractions.push(0);
        return;
      }
      const diff = exactDiff(referenceImage, image);
      const fraction = diff.changedPixels / diff.totalPixels;
      result.fractions.push(fraction);
      if (diff.changedPixels > 0) result.differingRuns++;
      if (!diff.sameDimensions) result.dimensionMismatch = true;
      result.maxChangedFraction = Math.max(result.maxChangedFraction, fraction);
    });

    result.distinctRenders = hashes.size;
    stories.push(result);
  }

  stories.sort(
    (a, b) =>
      b.failedRuns - a.failedRuns ||
      b.differingRuns - a.differingRuns ||
      b.maxChangedFraction - a.maxChangedFraction ||
      a.id.localeCompare(b.id),
  );

  const stable =
    fingerprintMismatches.length === 0 &&
    stories.every((story) => story.differingRuns === 0 && story.failedRuns === 0);

  return { runs: runs.length, stable, fingerprintMismatches, stories };
}
