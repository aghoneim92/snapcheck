import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { decodePng, exactDiff, pixelHash, type DecodedImage } from './pixels.ts';

function solid(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): DecodedImage {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set(rgba, offset);
  return { width, height, data };
}

function encode(
  image: DecodedImage,
  options: { deflateLevel: number; filterType: number },
): Buffer {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png, options);
}

describe('pixelHash', () => {
  it('is identical for the same pixels encoded differently', () => {
    const image = solid(8, 8, [20, 21, 26, 255]);
    image.data[5] = 99;
    const fast = encode(image, { deflateLevel: 1, filterType: 0 });
    const small = encode(image, { deflateLevel: 9, filterType: 4 });

    expect(Buffer.compare(fast, small)).not.toBe(0);
    expect(pixelHash(decodePng(fast))).toBe(pixelHash(decodePng(small)));
  });

  it('changes when a single channel of a single pixel changes', () => {
    const a = solid(4, 4, [0, 0, 0, 255]);
    const b = solid(4, 4, [0, 0, 0, 255]);
    b.data[b.data.length - 2] = 1;
    expect(pixelHash(a)).not.toBe(pixelHash(b));
  });

  it('distinguishes dimensions that share the same byte count', () => {
    expect(pixelHash(solid(2, 8, [1, 2, 3, 4]))).not.toBe(pixelHash(solid(8, 2, [1, 2, 3, 4])));
  });
});

describe('exactDiff', () => {
  it('reports zero changes for identical images', () => {
    expect(exactDiff(solid(3, 3, [9, 9, 9, 255]), solid(3, 3, [9, 9, 9, 255]))).toEqual({
      changedPixels: 0,
      totalPixels: 9,
      sameDimensions: true,
    });
  });

  it('counts a one-unit difference in any channel, including alpha', () => {
    const a = solid(2, 2, [9, 9, 9, 255]);
    const b = solid(2, 2, [9, 9, 9, 255]);
    b.data[0] = 10;
    b.data[7] = 254;
    expect(exactDiff(a, b).changedPixels).toBe(2);
  });

  it('treats mismatched dimensions as fully changed over the larger area', () => {
    expect(exactDiff(solid(4, 4, [0, 0, 0, 0]), solid(4, 5, [0, 0, 0, 0]))).toEqual({
      changedPixels: 20,
      totalPixels: 20,
      sameDimensions: false,
    });
  });
});
