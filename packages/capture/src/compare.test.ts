import { describe, expect, it } from 'vitest';

import { compare, exceedsThreshold, isVisualChange, pixelmatchComparator } from './compare.ts';
import type { DecodedImage } from './pixels.ts';

function image(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): DecodedImage {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set(rgba, offset);
  return { width, height, data };
}

function withPixel(base: DecodedImage, index: number, rgba: [number, number, number, number]) {
  const copy: DecodedImage = { ...base, data: Uint8Array.from(base.data) };
  copy.data.set(rgba, index * 4);
  return copy;
}

const white: [number, number, number, number] = [255, 255, 255, 255];

describe('compare', () => {
  it('reports no change for identical images', () => {
    const result = compare(image(4, 4, white), image(4, 4, white));

    expect(result.changedPixels).toBe(0);
    expect(result.changedFraction).toBe(0);
    expect(result.sameDimensions).toBe(true);
  });

  it('counts a changed pixel and reports it as a fraction of the image', () => {
    const base = image(10, 10, white);
    const result = compare(base, withPixel(base, 55, [0, 0, 0, 255]));

    expect(result.changedPixels).toBe(1);
    expect(result.totalPixels).toBe(100);
    expect(result.changedFraction).toBe(0.01);
  });

  it('treats differently sized images as fully changed, over the larger area', () => {
    const result = compare(image(4, 4, white), image(4, 5, white));

    expect(result.sameDimensions).toBe(false);
    expect(result.changedFraction).toBe(1);
    expect(result.totalPixels).toBe(20);
    expect(result.diffImage).toBeUndefined();
  });

  it('returns a diff image the size of the inputs, and skips it on request', () => {
    const base = image(6, 3, white);
    const changed = withPixel(base, 4, [0, 0, 0, 255]);

    expect(compare(base, changed).diffImage).toMatchObject({ width: 6, height: 3 });
    expect(compare(base, changed).diffImage?.data.length).toBe(6 * 3 * 4);
    expect(compare(base, changed, { diff: false }).diffImage).toBeUndefined();
  });

  it('names the engine behind the interface', () => {
    expect(pixelmatchComparator.name).toBe('pixelmatch');
  });
});

describe('pixelThreshold', () => {
  const base = image(8, 8, [120, 120, 120, 255]);
  // A small colour step: counted as changed only when sensitivity is high.
  const nudged = withPixel(base, 12, [132, 132, 132, 255]);

  it('ignores a small colour difference at a coarse sensitivity', () => {
    expect(compare(base, nudged, { pixelThreshold: 0.5 }).changedPixels).toBe(0);
  });

  it('counts the same difference at a fine sensitivity', () => {
    expect(compare(base, nudged, { pixelThreshold: 0.001 }).changedPixels).toBe(1);
  });
});

describe('antialiasing tolerance', () => {
  it('never counts fewer pixels when antialiased pixels are included', () => {
    // A diagonal edge: the pixels either side of it are what AA detection finds.
    const base = image(16, 16, white);
    const shifted = image(16, 16, white);
    for (let y = 0; y < 16; y++) {
      base.data.set([0, 0, 0, 255], (y * 16 + y) * 4);
      shifted.data.set([0, 0, 0, 255], (y * 16 + Math.min(y + 1, 15)) * 4);
    }

    const tolerant = compare(base, shifted).changedPixels;
    const strict = compare(base, shifted, { includeAntialiasing: true }).changedPixels;

    expect(strict).toBeGreaterThanOrEqual(tolerant);
  });
});

describe('isVisualChange', () => {
  // A small control on a large empty page: plainly visible, but a tiny share
  // of the capture. This is the case the fraction alone silently passes.
  const sparse = {
    changedPixels: 300,
    totalPixels: 1280 * 720,
    changedFraction: 300 / (1280 * 720),
    sameDimensions: true,
  };

  it('catches a change the fraction rule alone would hide', () => {
    expect(exceedsThreshold(sparse, 0.01)).toBe(false);
    expect(isVisualChange(sparse, { threshold: 0.01, minChangedPixels: 250 })).toBe(true);
  });

  it('still fails on the fraction when the floor is not reached', () => {
    const dense = { ...sparse, changedPixels: 100, changedFraction: 0.5 };
    expect(isVisualChange(dense, { threshold: 0.01, minChangedPixels: 250 })).toBe(true);
  });

  it('passes a change exactly at the floor', () => {
    expect(
      isVisualChange({ ...sparse, changedPixels: 250 }, { threshold: 0.01, minChangedPixels: 250 }),
    ).toBe(false);
  });

  it('falls back to the fraction alone when the floor is disabled', () => {
    expect(isVisualChange(sparse, { threshold: 0.01, minChangedPixels: false })).toBe(false);
    expect(isVisualChange(sparse, { threshold: 0.01 })).toBe(false);
  });

  it('reports no change when neither rule is broken', () => {
    expect(
      isVisualChange(
        { ...sparse, changedPixels: 0, changedFraction: 0 },
        { threshold: 0.01, minChangedPixels: 250 },
      ),
    ).toBe(false);
  });
});

describe('exceedsThreshold', () => {
  const result = {
    changedPixels: 1,
    totalPixels: 100,
    changedFraction: 0.01,
    sameDimensions: true,
  };

  it('passes a change exactly at the threshold', () => {
    expect(exceedsThreshold(result, 0.01)).toBe(false);
  });

  it('fails a change above the threshold', () => {
    expect(exceedsThreshold(result, 0.009)).toBe(true);
  });

  it('ignores the pixel floor: it is the fraction rule alone', () => {
    expect(exceedsThreshold({ ...result, changedPixels: 100_000 }, 0.5)).toBe(false);
  });

  it('fails everything at a zero threshold except an identical image', () => {
    expect(exceedsThreshold(result, 0)).toBe(true);
    expect(exceedsThreshold({ ...result, changedPixels: 0, changedFraction: 0 }, 0)).toBe(false);
  });
});
