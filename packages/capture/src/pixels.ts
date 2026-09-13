import { createHash } from 'node:crypto';

import { PNG } from 'pngjs';

/** A decoded image: dimensions plus raw RGBA bytes, 4 per pixel. */
export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export function decodePng(bytes: Uint8Array): DecodedImage {
  const png = PNG.sync.read(Buffer.from(bytes));
  return { width: png.width, height: png.height, data: png.data };
}

/**
 * Identity of an image's rendered content. Hashes dimensions plus decoded RGBA,
 * never PNG file bytes: metadata chunks, compression level and filter choice
 * vary between encoders without changing a single pixel.
 */
export function pixelHash(image: DecodedImage): string {
  const header = new Uint32Array([image.width, image.height]);
  return createHash('sha256')
    .update(new Uint8Array(header.buffer))
    .update(image.data)
    .digest('hex');
}

export interface ExactDiff {
  changedPixels: number;
  totalPixels: number;
  sameDimensions: boolean;
}

/**
 * Zero-tolerance comparison: a pixel counts as changed if any channel differs
 * at all. This is what determinism checks use, and it deliberately takes no
 * options: flake below a user's regression threshold must never be invisible
 * here.
 *
 * Images of different sizes count as fully changed, measured over the larger
 * of the two areas.
 */
export function exactDiff(a: DecodedImage, b: DecodedImage): ExactDiff {
  if (a.width !== b.width || a.height !== b.height) {
    const totalPixels = Math.max(a.width * a.height, b.width * b.height);
    return { changedPixels: totalPixels, totalPixels, sameDimensions: false };
  }

  const totalPixels = a.width * a.height;
  let changedPixels = 0;
  for (let offset = 0; offset < a.data.length; offset += 4) {
    if (
      a.data[offset] !== b.data[offset] ||
      a.data[offset + 1] !== b.data[offset + 1] ||
      a.data[offset + 2] !== b.data[offset + 2] ||
      a.data[offset + 3] !== b.data[offset + 3]
    ) {
      changedPixels++;
    }
  }
  return { changedPixels, totalPixels, sameDimensions: true };
}
