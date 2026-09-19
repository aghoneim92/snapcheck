import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FixtureManifest } from '@snapcheck/capture';
import { describe, expect, it } from 'vitest';

import { buildProblems, readIndexSummary, summarizeIndex } from './build.ts';
import { commitForTag, type Pin } from './pins.ts';

describe('commitForTag', () => {
  it('pins the commit an annotated tag peels to, not the tag object', () => {
    const output = [
      '1111111111111111111111111111111111111111\trefs/tags/v13.2.2',
      '3db12332b66497c31f8ad2a5fb0eb0fe0ca05a7e\trefs/tags/v13.2.2^{}',
    ].join('\n');
    expect(commitForTag(output, 'v13.2.2')).toBe('3db12332b66497c31f8ad2a5fb0eb0fe0ca05a7e');
  });

  it('uses a lightweight tag directly', () => {
    expect(
      commitForTag('2222222222222222222222222222222222222222\trefs/tags/v1.0.0', 'v1.0.0'),
    ).toBe('2222222222222222222222222222222222222222');
  });

  it('returns undefined for an unknown tag', () => {
    expect(commitForTag('', 'v0.0.0')).toBeUndefined();
  });
});

describe('summarizeIndex', () => {
  it('counts v4/v5 entries by type', () => {
    const index = {
      v: 5,
      entries: {
        'a--docs': { type: 'docs' },
        'a--one': { type: 'story' },
        'a--two': { type: 'story' },
      },
    };
    expect(summarizeIndex(index)).toEqual({ version: 5, entries: 3, stories: 2, docs: 1 });
  });

  it('counts v3 docs-only entries as docs', () => {
    const index = {
      v: 3,
      stories: {
        'a--page': { parameters: { docsOnly: true } },
        'a--one': { parameters: {} },
      },
    };
    expect(summarizeIndex(index)).toEqual({ version: 3, entries: 2, stories: 1, docs: 1 });
  });
});

describe('buildProblems', () => {
  const pin: Pin = {
    repo: 'https://github.com/grafana/grafana.git',
    tag: 'v13.2.2',
    sha: '3db12332b66497c31f8ad2a5fb0eb0fe0ca05a7e',
  };

  async function buildDir(): Promise<{ dir: string; manifest: FixtureManifest }> {
    const dir = await mkdtemp(path.join(tmpdir(), 'snapcheck-fixtures-'));
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({ v: 5, entries: {} }));
    const index = await readIndexSummary(dir);
    const manifest: FixtureManifest = {
      manifestVersion: 1,
      fixture: 'grafana',
      ...pin,
      commitDate: '2026-09-15T11:07:13Z',
      builtAt: '2026-09-19T00:00:00.000Z',
      storybookVersion: '10.3.6',
      index,
      build: { node: 'v24.18.0', platform: 'linux', arch: 'x64', durationMs: 1 },
    };
    return { dir, manifest };
  }

  it('reuses a build that matches its pin', async () => {
    const { dir, manifest } = await buildDir();
    expect(await buildProblems(pin, dir, manifest)).toEqual([]);
  });

  it('rejects a build without a manifest', async () => {
    const { dir } = await buildDir();
    expect(await buildProblems(pin, dir, undefined)).toHaveLength(1);
  });

  it('rejects a build from another commit after a bump', async () => {
    const { dir, manifest } = await buildDir();
    const bumped = { ...pin, tag: 'v13.3.0', sha: 'f'.repeat(40) };
    expect(await buildProblems(bumped, dir, manifest)).toEqual([
      `built from ${pin.sha}, pinned ${'f'.repeat(40)}`,
      'built from tag v13.2.2, pinned v13.3.0',
    ]);
  });

  it('rejects a build whose index changed after its manifest was written', async () => {
    const { dir, manifest } = await buildDir();
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({ v: 5, entries: { x: {} } }));
    expect(await buildProblems(pin, dir, manifest)).toEqual([
      'index.json no longer matches the hash its manifest recorded',
    ]);
  });
});
