import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FIXTURE_MANIFEST_FILE,
  fixtureDifferences,
  FixtureMismatchError,
  readFixtureManifest,
  type FixtureManifest,
} from './fixture.ts';
import { checkBaselineFixture } from './snapshot.ts';

function manifest(overrides: Partial<FixtureManifest> = {}): FixtureManifest {
  return {
    manifestVersion: 1,
    fixture: 'grafana',
    repo: 'https://github.com/grafana/grafana.git',
    sha: '3db12332b66497c31f8ad2a5fb0eb0fe0ca05a7e',
    tag: 'v13.2.2',
    commitDate: '2026-09-15T11:07:13Z',
    builtAt: '2026-09-19T00:00:00.000Z',
    storybookVersion: '10.3.6',
    index: { file: 'index.json', version: 5, entries: 477, stories: 333, docs: 144, sha256: 'aa' },
    build: { node: 'v24.18.0', platform: 'darwin', arch: 'arm64', durationMs: 1 },
    ...overrides,
  };
}

describe('fixtureDifferences', () => {
  it('is empty for plain Storybook builds on both sides', () => {
    expect(fixtureDifferences(undefined, undefined)).toEqual([]);
  });

  it('ignores a rebuild of the same pin on another machine', () => {
    const rebuilt = manifest({
      builtAt: '2026-10-01T00:00:00.000Z',
      build: { node: 'v24.11.1', platform: 'linux', arch: 'x64', durationMs: 999 },
    });
    expect(fixtureDifferences(manifest(), rebuilt)).toEqual([]);
  });

  it('names each identity field that changed', () => {
    const bumped = manifest({
      sha: 'ffffffffffffffffffffffffffffffffffffffff',
      tag: 'v13.3.0',
      index: { ...manifest().index, stories: 340, sha256: 'bb' },
    });
    expect(fixtureDifferences(manifest(), bumped)).toEqual([
      'sha: 3db12332b66497c31f8ad2a5fb0eb0fe0ca05a7e → ffffffffffffffffffffffffffffffffffffffff',
      'tag: v13.2.2 → v13.3.0',
      'index.stories: 333 → 340',
      'index.sha256: aa → bb',
    ]);
  });

  it('catches a changed index even when the pin did not move', () => {
    const drifted = manifest({ index: { ...manifest().index, sha256: 'cc' } });
    expect(fixtureDifferences(manifest(), drifted)).toEqual(['index.sha256: aa → cc']);
  });

  it('treats gaining or losing a fixture manifest as a change', () => {
    expect(fixtureDifferences(undefined, manifest())).toEqual([
      'fixture: none → grafana@v13.2.2 (3db12332b664)',
    ]);
    expect(fixtureDifferences(manifest(), undefined)).toEqual([
      'fixture: grafana@v13.2.2 (3db12332b664) → none',
    ]);
  });
});

describe('checkBaselineFixture', () => {
  const bumped = manifest({ sha: 'f'.repeat(40) });

  it('passes a plain Storybook build with baselines', () => {
    expect(
      checkBaselineFixture({
        baseline: undefined,
        current: undefined,
        hasBaselines: true,
        update: false,
      }),
    ).toBe(false);
  });

  it('refuses to compare against baselines from another fixture build', () => {
    expect(() =>
      checkBaselineFixture({
        baseline: manifest(),
        current: bumped,
        hasBaselines: true,
        update: false,
      }),
    ).toThrow(FixtureMismatchError);
  });

  it('discards every baseline when re-baselining after a fixture change', () => {
    expect(
      checkBaselineFixture({
        baseline: manifest(),
        current: bumped,
        hasBaselines: true,
        update: true,
      }),
    ).toBe(true);
  });

  it('has nothing to invalidate without baselines', () => {
    expect(
      checkBaselineFixture({
        baseline: manifest(),
        current: bumped,
        hasBaselines: false,
        update: false,
      }),
    ).toBe(false);
  });
});

describe('readFixtureManifest', () => {
  it('returns undefined for a build without one', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'snapcheck-fixture-'));
    expect(await readFixtureManifest(dir)).toBeUndefined();
  });

  it('reads the manifest from the build directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'snapcheck-fixture-'));
    await writeFile(path.join(dir, FIXTURE_MANIFEST_FILE), JSON.stringify(manifest()));
    expect(await readFixtureManifest(dir)).toEqual(manifest());
  });
});
