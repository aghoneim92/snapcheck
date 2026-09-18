import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  baselinePath,
  emptyManifest,
  promoteBaseline,
  readBaselineManifest,
  writeBaselineManifest,
} from './baselines.ts';
import { decideStatus } from './snapshot.ts';

const tempDir = () => mkdtemp(path.join(tmpdir(), 'snapcheck-baselines-'));

describe('baseline manifest', () => {
  it('treats a missing manifest as no baselines yet', async () => {
    const dir = await tempDir();
    expect(await readBaselineManifest(path.join(dir, 'baselines'))).toEqual(emptyManifest());
  });

  it('treats an unreadable manifest as no baselines yet', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'manifest.json'), 'not json');
    expect(await readBaselineManifest(dir)).toEqual(emptyManifest());
  });

  it('round-trips entries and the fingerprint', async () => {
    const dir = await tempDir();
    const manifest = emptyManifest();
    manifest.entries['a--b__default__1280'] = {
      key: 'a--b__default__1280',
      hash: 'abc',
      width: 1280,
      height: 720,
      updatedAt: '2026-09-18T00:00:00.000Z',
    };
    await writeBaselineManifest(dir, manifest);

    expect(await readBaselineManifest(dir)).toEqual(manifest);
  });
});

describe('promoteBaseline', () => {
  it('writes the image under its key and returns the entry', async () => {
    const dir = await tempDir();
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const entry = await promoteBaseline(dir, 'a--b__default__375', bytes, {
      hash: 'hash-1',
      width: 375,
      height: 720,
    });

    expect(entry).toMatchObject({ key: 'a--b__default__375', hash: 'hash-1', width: 375 });
    expect(new Uint8Array(await readFile(baselinePath(dir, 'a--b__default__375')))).toEqual(bytes);
  });
});

describe('decideStatus', () => {
  const input = { failed: false, hasBaseline: true, aboveThreshold: false, quarantined: false };

  it('reports a capture with no baseline as new', () => {
    expect(decideStatus({ ...input, hasBaseline: false })).toBe('new');
  });

  it('reports a change within the threshold as unchanged', () => {
    expect(decideStatus(input)).toBe('unchanged');
  });

  it('reports a change above the threshold as changed', () => {
    expect(decideStatus({ ...input, aboveThreshold: true })).toBe('changed');
  });

  it('reports a capture failure as failed', () => {
    expect(decideStatus({ ...input, failed: true })).toBe('failed');
  });

  it('reports quarantined stories instead of changed or failed', () => {
    expect(decideStatus({ ...input, aboveThreshold: true, quarantined: true })).toBe('quarantined');
    expect(decideStatus({ ...input, failed: true, quarantined: true })).toBe('quarantined');
  });

  it('leaves a quarantined story that did not change as unchanged', () => {
    expect(decideStatus({ ...input, quarantined: true })).toBe('unchanged');
  });
});
