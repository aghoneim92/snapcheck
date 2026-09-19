import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** A fixture's pinned source: a commit on a release tag, never a branch tip. */
export interface Pin {
  repo: string;
  tag: string;
  sha: string;
}

export const PINS_FILE = path.resolve(import.meta.dirname, '..', 'pins.json');

export async function readPins(file = PINS_FILE): Promise<Record<string, Pin>> {
  return JSON.parse(await readFile(file, 'utf8')) as Record<string, Pin>;
}

export async function readPin(name: string, file = PINS_FILE): Promise<Pin> {
  const pin = (await readPins(file))[name];
  if (!pin) throw new Error(`No pin for fixture "${name}" in ${file}.`);
  return pin;
}

export async function writePin(name: string, pin: Pin, file = PINS_FILE): Promise<void> {
  const pins = await readPins(file);
  pins[name] = pin;
  await writeFile(file, `${JSON.stringify(pins, null, 2)}\n`);
}

/**
 * The commit a tag points at, from `git ls-remote <repo> refs/tags/<tag>
 * refs/tags/<tag>^{}` output. An annotated tag lists the tag object first and
 * the commit it peels to second; the commit is what gets pinned.
 */
export function commitForTag(lsRemoteOutput: string, tag: string): string | undefined {
  const refs = new Map<string, string>();
  for (const line of lsRemoteOutput.split('\n')) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (sha && ref) refs.set(ref, sha);
  }
  return refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`);
}
