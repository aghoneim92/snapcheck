import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Reader for Storybook's own static-build index — the contract with builds we
 * do not control.
 *
 * Storybook changed the schema across majors: v3 is the legacy `stories.json`
 * (Storybook 6), v4 the first `index.json` (Storybook 7), v5 the current one
 * (Storybook 8+). All three normalize to `StoryEntry` here so nothing
 * downstream has to know which one it got.
 */

export interface StoryEntry {
  id: string;
  title: string;
  name: string;
  importPath: string;
  /** Empty for index versions that carry no tags (v3). */
  tags: string[];
  /**
   * Always empty when read from an index: no index version carries a story's
   * user `parameters`. Per-story snapshot settings come from config, and the
   * field exists so a future runner can fill it in from the rendered preview.
   */
  parameters: Record<string, unknown>;
}

export interface StoryIndex {
  /** Index format version as declared by the file's `v` field. */
  version: 3 | 4 | 5;
  /** File the index was read from. */
  source: string;
  stories: StoryEntry[];
  /** Entries dropped, by reason, for reporting. */
  skipped: { docs: number; excludedByTag: string[] };
}

export interface ReadStoryIndexOptions {
  /** A story carrying any of these tags is skipped. Default: none. */
  excludeTags?: string[];
  /**
   * Skip stories without Storybook's `test` tag, but only when the index uses
   * that tag at all. Storybook resolves `tags: ['!test']` when it builds the
   * index, so an excluded story arrives simply lacking `test`; the literal
   * `!test` never appears. Indexes from Storybook 6/7 have no `test` tag, and
   * the rule is skipped for them. Default: true.
   */
  requireTestTag?: boolean;
}

/** Thrown for a missing, unparseable or unsupported index, with the path and likely cause. */
export class StoryIndexError extends Error {
  override name = 'StoryIndexError';
}

const INDEX_FILENAMES = ['index.json', 'stories.json'] as const;

interface RawV3Entry {
  id?: string;
  name?: string;
  title?: string;
  kind?: string;
  importPath?: string;
  parameters?: { docsOnly?: boolean };
}

interface RawV4Entry {
  id?: string;
  name?: string;
  title?: string;
  importPath?: string;
  type?: string;
  tags?: string[];
}

function entryList(raw: unknown, source: string): { version: 3 | 4 | 5; entries: unknown[] } {
  if (typeof raw !== 'object' || raw === null) {
    throw new StoryIndexError(`Storybook index at ${source} is not a JSON object.`);
  }
  const index = raw as { v?: unknown; entries?: unknown; stories?: unknown };
  const version = index.v;
  if (version !== 3 && version !== 4 && version !== 5) {
    throw new StoryIndexError(
      `Storybook index at ${source} declares version ${JSON.stringify(version)}; ` +
        `snapcheck supports index versions 3, 4 and 5. ` +
        `Likely cause: a Storybook newer than this snapcheck release.`,
    );
  }

  // v3 keys stories by id under `stories`; v4/v5 under `entries`.
  const container = version === 3 ? index.stories : index.entries;
  if (typeof container !== 'object' || container === null) {
    throw new StoryIndexError(
      `Storybook index at ${source} has no ${version === 3 ? '"stories"' : '"entries"'} object.`,
    );
  }
  return { version, entries: Object.values(container) };
}

export function parseStoryIndex(
  raw: unknown,
  source: string,
  options: ReadStoryIndexOptions = {},
): StoryIndex {
  const { version, entries } = entryList(raw, source);
  const excludeTags = options.excludeTags ?? [];
  const requireTestTag = options.requireTestTag ?? true;

  const stories: StoryEntry[] = [];
  const skipped: StoryIndex['skipped'] = { docs: 0, excludedByTag: [] };

  const normalized = entries.map((entry) => {
    const shared = entry as RawV3Entry & RawV4Entry;
    const isDocs = version === 3 ? shared.parameters?.docsOnly === true : shared.type === 'docs';
    return {
      id: shared.id ?? '',
      title: shared.title ?? shared.kind ?? '',
      name: shared.name ?? '',
      importPath: shared.importPath ?? '',
      tags: version === 3 ? [] : (shared.tags ?? []),
      isDocs,
    };
  });

  // Only meaningful where Storybook itself applies the tag (8.1+ indexes).
  const indexUsesTestTag = normalized.some((entry) => entry.tags.includes('test'));

  for (const entry of normalized) {
    if (entry.isDocs) {
      skipped.docs++;
      continue;
    }
    if (!entry.id) {
      throw new StoryIndexError(`Storybook index at ${source} has an entry with no id.`);
    }
    const excluded = excludeTags.find((tag) => entry.tags.includes(tag));
    if (excluded !== undefined) {
      skipped.excludedByTag.push(entry.id);
      continue;
    }
    if (requireTestTag && indexUsesTestTag && !entry.tags.includes('test')) {
      skipped.excludedByTag.push(entry.id);
      continue;
    }
    stories.push({
      id: entry.id,
      title: entry.title,
      name: entry.name,
      importPath: entry.importPath,
      tags: entry.tags,
      parameters: {},
    });
  }

  return { version, source, stories, skipped };
}

/**
 * Reads `index.json`, or the legacy `stories.json`, from a Storybook static
 * build directory.
 */
export async function readStoryIndex(
  staticDir: string,
  options: ReadStoryIndexOptions = {},
): Promise<StoryIndex> {
  const dir = path.resolve(staticDir);
  const attempted: string[] = [];

  for (const filename of INDEX_FILENAMES) {
    const file = path.join(dir, filename);
    attempted.push(file);
    let contents: string;
    try {
      // In order by design: `index.json` first, the legacy name only as fallback.
      // oxlint-disable-next-line no-await-in-loop
      contents = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(contents);
    } catch (error) {
      throw new StoryIndexError(
        `Storybook index at ${file} is not valid JSON: ${(error as Error).message}. ` +
          `Likely cause: a truncated or partially written build.`,
      );
    }
    return parseStoryIndex(raw, file, options);
  }

  throw new StoryIndexError(
    `No Storybook index found in ${dir}.\n` +
      `Looked for: ${attempted.map((file) => path.basename(file)).join(', ')}.\n` +
      `Likely causes: the Storybook build has not run (\`storybook build\`), ` +
      `or the configured staticDir points at the wrong directory.`,
  );
}
