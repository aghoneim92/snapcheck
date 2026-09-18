import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  parseStoryIndex,
  readStoryIndex,
  StoryIndexError,
  type StoryIndex,
} from './storybookIndex.ts';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const ids = (index: StoryIndex) => index.stories.map((story) => story.id);

describe('readStoryIndex', () => {
  it('reads the legacy stories.json (v3) and drops docs-only entries', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v3'));

    expect(index.version).toBe(3);
    expect(index.source.endsWith('stories.json')).toBe(true);
    expect(ids(index)).toEqual(['controls-button--primary', 'forms-input--default']);
    expect(index.skipped.docs).toBe(1);
  });

  it('normalizes v3 `kind` into `title` and reports no tags', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v3'));

    expect(index.stories[0]).toEqual({
      id: 'controls-button--primary',
      title: 'Controls/Button',
      name: 'Primary',
      importPath: './src/components/Button.stories.tsx',
      tags: [],
      parameters: {},
    });
  });

  it('reads v4 index.json and drops entries typed as docs', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v4'));

    expect(index.version).toBe(4);
    expect(ids(index)).toEqual([
      'controls-button--primary',
      'forms-input--default',
      'forms-input--untagged',
    ]);
    expect(index.skipped.docs).toBe(1);
  });

  it('reads v5 index.json', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v5'));

    expect(index.version).toBe(5);
    expect(index.stories[0]?.tags).toContain('test');
  });

  it('skips stories missing the `test` tag when the index uses it (Storybook resolved `!test`)', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v5'));

    expect(ids(index)).not.toContain('forms-input--excluded-from-test');
    expect(index.skipped.excludedByTag).toContain('forms-input--excluded-from-test');
  });

  it('keeps every story when the index predates the `test` tag', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v4'));

    expect(ids(index)).toContain('forms-input--untagged');
  });

  it('can opt out of the `test` tag rule', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v5'), { requireTestTag: false });

    expect(ids(index)).toContain('forms-input--excluded-from-test');
  });

  it('honours configured excluded tags', async () => {
    const index = await readStoryIndex(path.join(fixtures, 'v5'), {
      excludeTags: ['no-snapshot'],
    });

    expect(ids(index)).not.toContain('forms-input--default');
    expect(index.skipped.excludedByTag).toContain('forms-input--default');
  });

  it('names the directory and the likely causes when no index exists', async () => {
    const missing = path.join(fixtures, 'does-not-exist');

    await expect(readStoryIndex(missing)).rejects.toThrow(StoryIndexError);
    await expect(readStoryIndex(missing)).rejects.toThrow(
      /No Storybook index found in .*does-not-exist[\s\S]*index\.json, stories\.json[\s\S]*storybook build/,
    );
  });
});

describe('parseStoryIndex', () => {
  it('rejects an unsupported index version and names the supported ones', () => {
    expect(() => parseStoryIndex({ v: 6, entries: {} }, '/build/index.json')).toThrow(
      /declares version 6.*supports index versions 3, 4 and 5/s,
    );
  });

  it('rejects an index with no entries container', () => {
    expect(() => parseStoryIndex({ v: 5 }, '/build/index.json')).toThrow(/no "entries" object/);
  });

  it('rejects a non-object index', () => {
    expect(() => parseStoryIndex('nope', '/build/index.json')).toThrow(/not a JSON object/);
  });

  it('rejects an entry without an id', () => {
    expect(() =>
      parseStoryIndex({ v: 5, entries: { broken: { type: 'story' } } }, '/build/index.json'),
    ).toThrow(/entry with no id/);
  });
});
