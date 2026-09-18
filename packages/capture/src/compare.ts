import pixelmatch from 'pixelmatch';

import type { DecodedImage } from './pixels.ts';

/**
 * Regression comparison: current capture against a baseline, across commits.
 *
 * Kept behind a small interface so the engine (pixelmatch today, odiff later)
 * can be swapped without touching callers.
 *
 * This is deliberately separate from `exactDiff` in `pixels.ts`, which the
 * determinism rig uses. Runs at the same commit must be pixel-identical with
 * zero tolerance, so the rig must never be able to read a user threshold.
 */

export interface CompareOptions {
  /**
   * Per-pixel colour distance sensitivity, 0–1. How different two pixels must
   * be to count as changed at all. Default 0.1 (pixelmatch's default).
   */
  pixelThreshold?: number;
  /**
   * Count antialiased pixels as changed. Default false: antialiasing tolerance
   * is on, because AA differences are the most common source of noise that is
   * not a real visual change.
   */
  includeAntialiasing?: boolean;
  /** Produce the diff image. Default true; pass false when only counts matter. */
  diff?: boolean;
}

export interface CompareResult {
  changedPixels: number;
  totalPixels: number;
  /** `changedPixels / totalPixels`, the number `threshold` is compared against. */
  changedFraction: number;
  /** False when the images differ in size, which counts as fully changed. */
  sameDimensions: boolean;
  /** Present when `diff` is on and the images are the same size. */
  diffImage?: DecodedImage;
}

export interface ImageComparator {
  readonly name: string;
  compare(a: DecodedImage, b: DecodedImage, options?: CompareOptions): CompareResult;
}

export const DEFAULT_PIXEL_THRESHOLD = 0.1;

export const pixelmatchComparator: ImageComparator = {
  name: 'pixelmatch',
  compare(a, b, options = {}) {
    if (a.width !== b.width || a.height !== b.height) {
      const totalPixels = Math.max(a.width * a.height, b.width * b.height);
      return {
        changedPixels: totalPixels,
        totalPixels,
        changedFraction: 1,
        sameDimensions: false,
      };
    }

    const totalPixels = a.width * a.height;
    const wantsDiff = options.diff ?? true;
    // `undefined`, not `null`: pixelmatch's output parameter is optional.
    const diffData = wantsDiff ? new Uint8Array(totalPixels * 4) : undefined;
    const changedPixels = pixelmatch(a.data, b.data, diffData, a.width, a.height, {
      threshold: options.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD,
      includeAA: options.includeAntialiasing ?? false,
    });

    return {
      changedPixels,
      totalPixels,
      changedFraction: totalPixels === 0 ? 0 : changedPixels / totalPixels,
      sameDimensions: true,
      ...(diffData ? { diffImage: { width: a.width, height: a.height, data: diffData } } : {}),
    };
  },
};

/** Compare with the default engine. */
export function compare(a: DecodedImage, b: DecodedImage, options?: CompareOptions): CompareResult {
  return pixelmatchComparator.compare(a, b, options);
}

/**
 * The pass/fail rule: a story fails when more than `threshold` of the image
 * changed. Exactly at the threshold passes.
 */
export function exceedsThreshold(result: CompareResult, threshold: number): boolean {
  return result.changedFraction > threshold;
}
