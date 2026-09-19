import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import {
  FIXTURE_MANIFEST_FILE,
  readFixtureManifest,
  type FixtureManifest,
} from '@snapcheck/capture';

import type { FixtureDefinition } from './definitions.ts';
import type { Pin } from './pins.ts';

/**
 * Fixture acquisition: clone at the pinned commit, build Storybook, record
 * what was built. A one-time cost, not a per-run one — a build whose manifest
 * already matches the pin is reused as is, which is also how CI consumes its
 * cached copy without a clone.
 */

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
/** Gitignored. Clones live here, never inside the monorepo's tracked tree. */
export const WORK_ROOT = path.join(REPO_ROOT, '.fixtures');

export function workDirFor(name: string): string {
  return path.join(WORK_ROOT, name);
}

export function staticDirFor(definition: FixtureDefinition, workDir = workDirFor(definition.name)) {
  return path.join(workDir, definition.outputDir);
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

interface RunOptions {
  cwd: string;
  env?: Record<string, string>;
  /** Also append all output to this file. */
  log?: string;
}

/** Runs a command; resolves with its stdout, rejects with the tail of its output. */
export function run(command: string, args: string[], options: RunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = options.log ? createWriteStream(options.log, { flags: 'a' }) : undefined;
    let output = '';
    const collect = (chunk: Buffer) => {
      log?.write(chunk);
      output += chunk.toString();
      // Keep only the tail for error messages; builds print megabytes.
      if (output.length > 200_000) output = output.slice(-100_000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      log?.end();
      if (code === 0) resolve(output.trim());
      else {
        const tail = output.trim().split('\n').slice(-25).join('\n');
        reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${tail}`));
      }
    });
  });
}

export interface IndexSummary {
  file: string;
  version: number;
  entries: number;
  stories: number;
  docs: number;
  sha256: string;
}

/** Counts a Storybook index's entries, raw: no tag filtering, unlike the reader. */
export function summarizeIndex(raw: unknown): Omit<IndexSummary, 'file' | 'sha256'> {
  const index = raw as {
    v?: number;
    entries?: Record<string, { type?: string }>;
    stories?: Record<string, { parameters?: { docsOnly?: boolean } }>;
  };
  const version = index.v ?? 0;
  if (version === 3) {
    const entries = Object.values(index.stories ?? {});
    const docs = entries.filter((entry) => entry.parameters?.docsOnly === true).length;
    return { version, entries: entries.length, stories: entries.length - docs, docs };
  }
  const entries = Object.values(index.entries ?? {});
  const docs = entries.filter((entry) => entry.type === 'docs').length;
  return { version, entries: entries.length, stories: entries.length - docs, docs };
}

export async function readIndexSummary(staticDir: string): Promise<IndexSummary> {
  for (const file of ['index.json', 'stories.json']) {
    const full = path.join(staticDir, file);
    // oxlint-disable-next-line no-await-in-loop -- index.json first, by design
    if (!(await exists(full))) continue;
    // oxlint-disable-next-line no-await-in-loop
    const bytes = await readFile(full);
    return {
      file,
      ...summarizeIndex(JSON.parse(bytes.toString('utf8'))),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  throw new Error(`No index.json or stories.json in ${staticDir}.`);
}

/** Storybook's own record of its version, falling back to the installed package. */
async function storybookVersion(workDir: string, staticDir: string): Promise<string> {
  try {
    const project = JSON.parse(await readFile(path.join(staticDir, 'project.json'), 'utf8')) as {
      storybookVersion?: string;
    };
    if (project.storybookVersion) return project.storybookVersion;
  } catch {
    // Older builds have no project.json.
  }
  const require = createRequire(path.join(workDir, 'package.json'));
  for (const name of ['storybook', '@storybook/core', '@storybook/react']) {
    try {
      return (require(`${name}/package.json`) as { version: string }).version;
    } catch {
      // Try the next one.
    }
  }
  return 'unknown';
}

/**
 * Problems with a build relative to its pin, empty when it can be reused:
 * its manifest must name the pinned commit, and its index must still hash to
 * what the manifest recorded.
 */
export async function buildProblems(
  pin: Pin,
  staticDir: string,
  manifest: FixtureManifest | undefined,
): Promise<string[]> {
  if (!manifest) return [`no ${FIXTURE_MANIFEST_FILE} in ${staticDir}`];
  const problems: string[] = [];
  if (manifest.repo !== pin.repo) problems.push(`repo ${manifest.repo}, pinned ${pin.repo}`);
  if (manifest.sha !== pin.sha) problems.push(`built from ${manifest.sha}, pinned ${pin.sha}`);
  if (manifest.tag !== pin.tag) problems.push(`built from tag ${manifest.tag}, pinned ${pin.tag}`);
  try {
    const index = await readIndexSummary(staticDir);
    if (index.sha256 !== manifest.index.sha256) {
      problems.push(`${index.file} no longer matches the hash its manifest recorded`);
    }
  } catch (error) {
    problems.push((error as Error).message);
  }
  return problems;
}

/**
 * Puts the clone at the pinned commit. A fresh directory is cloned shallowly;
 * an existing clone at another commit is moved to the pin and cleaned, since
 * leftover build state from another commit (Grafana copies assets only when
 * they are missing, for one) would silently leak into the new build.
 */
async function checkout(pin: Pin, workDir: string, log: (line: string) => void): Promise<void> {
  const git = (...args: string[]) => run('git', args, { cwd: workDir });

  if (!(await exists(path.join(workDir, '.git')))) {
    await mkdir(workDir, { recursive: true });
    log(`cloning ${pin.repo} at ${pin.tag} (${pin.sha.slice(0, 12)})`);
    await git('init', '-q');
    await git('remote', 'add', 'origin', pin.repo);
  } else {
    const head = await git('rev-parse', 'HEAD').catch(() => '');
    if (head === pin.sha) return;
    const dirty = await git('status', '--porcelain', '--untracked-files=no');
    if (dirty) {
      throw new Error(
        `${workDir} has local changes to tracked files; refusing to overwrite them.\n` +
          `Delete the directory to re-clone it.`,
      );
    }
    log(`moving existing clone from ${head.slice(0, 12) || 'nothing'} to ${pin.sha.slice(0, 12)}`);
  }

  await git('fetch', '-q', '--depth', '1', 'origin', pin.sha);
  await git('checkout', '-q', '--detach', '--force', pin.sha);
  await git('clean', '-q', '-ffdx');
}

export interface BuildFixtureOptions {
  definition: FixtureDefinition;
  pin: Pin;
  workDir?: string;
  /** Rebuild even when a matching build exists. */
  force?: boolean;
  log?: (line: string) => void;
}

export interface BuildFixtureResult {
  manifest: FixtureManifest;
  staticDir: string;
  reused: boolean;
}

export async function buildFixture(options: BuildFixtureOptions): Promise<BuildFixtureResult> {
  const { definition, pin } = options;
  const log = options.log ?? (() => undefined);
  const workDir = options.workDir ?? workDirFor(definition.name);
  const staticDir = staticDirFor(definition, workDir);

  const existing = await readFixtureManifest(staticDir);
  if (!options.force && existing) {
    const problems = await buildProblems(pin, staticDir, existing);
    if (problems.length === 0) return { manifest: existing, staticDir, reused: true };
    log(`existing build is stale: ${problems.join('; ')}`);
  }

  const started = performance.now();
  await checkout(pin, workDir, log);
  const commitDate = await run('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: workDir });

  const logFile = `${workDir}.build.log`;
  await writeFile(logFile, '');
  // Never let a previous build's output survive into this one's manifest.
  await rm(staticDir, { recursive: true, force: true });

  for (const step of definition.steps) {
    const stepStarted = performance.now();
    log(`${step.label}: ${step.command} ${step.args.join(' ')} (log: ${logFile})`);
    // oxlint-disable-next-line no-await-in-loop -- steps are sequential
    await run(step.command, step.args, { cwd: workDir, env: step.env, log: logFile });
    log(`${step.label}: done in ${((performance.now() - stepStarted) / 1000).toFixed(0)}s`);
  }

  const manifest: FixtureManifest = {
    manifestVersion: 1,
    fixture: definition.name,
    repo: pin.repo,
    sha: pin.sha,
    tag: pin.tag,
    commitDate,
    builtAt: new Date().toISOString(),
    storybookVersion: await storybookVersion(workDir, staticDir),
    index: await readIndexSummary(staticDir),
    build: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      durationMs: Math.round(performance.now() - started),
    },
  };
  await writeFile(
    path.join(staticDir, FIXTURE_MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return { manifest, staticDir, reused: false };
}
