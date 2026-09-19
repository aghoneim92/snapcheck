import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Provenance of a Storybook build that snapcheck's own tooling produced from a
 * pinned third-party source, written into the build directory as
 * `snapcheck-fixture.json`.
 *
 * Baselines record it, because a fixture that changed underneath them is the
 * most confusing possible failure: every story that moved would be reported as
 * a visual regression when nothing in snapcheck changed. A build without the
 * file is an ordinary Storybook build and none of this applies to it.
 */

export const FIXTURE_MANIFEST_FILE = 'snapcheck-fixture.json';

export interface FixtureManifest {
  manifestVersion: 1;
  /** Fixture name, e.g. `grafana`. */
  fixture: string;
  repo: string;
  /** Pinned commit the build was produced from. */
  sha: string;
  tag: string;
  /** Committer date of `sha`, ISO 8601. */
  commitDate: string;
  /** When this build ran. Informational: rebuilding the same pin is not a change. */
  builtAt: string;
  storybookVersion: string;
  index: {
    /** `index.json`, or `stories.json` for Storybook 6. */
    file: string;
    /** The index's own `v` field. */
    version: number;
    entries: number;
    stories: number;
    docs: number;
    /** SHA-256 of the index file's bytes. */
    sha256: string;
  };
  /** Where and how it was built. Informational, like `builtAt`. */
  build: { node: string; platform: string; arch: string; durationMs: number };
}

/** Reads the fixture manifest from a static build, `undefined` when there is none. */
export async function readFixtureManifest(staticDir: string): Promise<FixtureManifest | undefined> {
  let raw: string;
  try {
    raw = await readFile(path.join(staticDir, FIXTURE_MANIFEST_FILE), 'utf8');
  } catch {
    return undefined;
  }
  return JSON.parse(raw) as FixtureManifest;
}

/**
 * The fields that make two builds the same fixture. `builtAt` and `build` are
 * left out on purpose: rebuilding the same commit on another machine is not a
 * change, and if it did produce a different index the hash would say so.
 */
function identity(manifest: FixtureManifest): Record<string, string> {
  return {
    fixture: manifest.fixture,
    repo: manifest.repo,
    sha: manifest.sha,
    tag: manifest.tag,
    storybookVersion: manifest.storybookVersion,
    'index.version': String(manifest.index.version),
    'index.stories': String(manifest.index.stories),
    'index.docs': String(manifest.index.docs),
    'index.sha256': manifest.index.sha256,
  };
}

function label(manifest: FixtureManifest | undefined): string {
  return manifest ? `${manifest.fixture}@${manifest.tag} (${manifest.sha.slice(0, 12)})` : 'none';
}

/**
 * Field-by-field differences between the fixture baselines were captured
 * against and the one being captured now; empty when they are the same
 * fixture. Gaining or losing a manifest is itself a difference.
 */
export function fixtureDifferences(
  baseline: FixtureManifest | undefined,
  current: FixtureManifest | undefined,
): string[] {
  if (!baseline && !current) return [];
  if (!baseline || !current) return [`fixture: ${label(baseline)} → ${label(current)}`];
  const left = identity(baseline);
  const right = identity(current);
  return Object.keys(left)
    .filter((key) => left[key] !== right[key])
    .map((key) => `${key}: ${left[key]} → ${right[key]}`);
}

/**
 * Raised instead of reporting a diff when baselines were captured against a
 * different fixture build. Every difference it would have reported is the
 * fixture's, not snapcheck's, so none of them may be presented as a change.
 */
export class FixtureMismatchError extends Error {
  override name = 'FixtureMismatchError';
  readonly baseline: FixtureManifest | undefined;
  readonly current: FixtureManifest | undefined;
  readonly differences: string[];

  constructor(
    baseline: FixtureManifest | undefined,
    current: FixtureManifest | undefined,
    differences: string[],
  ) {
    super(
      `Baselines were captured against a different fixture build: ` +
        `${label(baseline)} → ${label(current)}.\n` +
        differences.map((line) => `  ${line}`).join('\n') +
        `\nEvery existing baseline for this build is invalid. Nothing was compared.\n` +
        `Re-baseline deliberately with --update once the fixture change is intended.`,
    );
    this.baseline = baseline;
    this.current = current;
    this.differences = differences;
  }
}
