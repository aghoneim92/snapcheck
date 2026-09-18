import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { SnapcheckConfig } from '@snapcheck/capture';

/** Config file names tried, in order, when `--config` is not given. */
const CONFIG_FILENAMES = ['snapcheck.config.ts', 'snapcheck.config.js', 'snapcheck.config.mjs'];

export class ConfigError extends Error {
  override name = 'ConfigError';
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function findConfig(cwd: string, explicit?: string): Promise<string> {
  if (explicit) {
    const resolved = path.resolve(cwd, explicit);
    if (!(await exists(resolved))) {
      throw new ConfigError(`Config file not found: ${resolved}`);
    }
    return resolved;
  }

  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(cwd, filename);
    // oxlint-disable-next-line no-await-in-loop -- first match wins, in order
    if (await exists(candidate)) return candidate;
  }

  throw new ConfigError(
    `No snapcheck config found in ${cwd}.\n` +
      `Looked for: ${CONFIG_FILENAMES.join(', ')}.\n` +
      `Create snapcheck.config.ts with: export default defineConfig({ staticDir: '...' })`,
  );
}

/**
 * Loads the config file. A `.ts` config is imported directly — Node strips the
 * types (22.18+), so no bundler or loader is involved.
 */
export async function loadConfig(file: string): Promise<SnapcheckConfig> {
  let loaded: { default?: unknown };
  try {
    loaded = (await import(pathToFileURL(file).href)) as { default?: unknown };
  } catch (error) {
    throw new ConfigError(`Could not load ${file}: ${(error as Error).message}`);
  }

  const config = loaded.default;
  if (typeof config !== 'object' || config === null) {
    throw new ConfigError(`${file} must export a config object as its default export.`);
  }
  if (typeof (config as SnapcheckConfig).staticDir !== 'string') {
    throw new ConfigError(
      `${file} must set \`staticDir\` to the Storybook static build directory.`,
    );
  }
  return config as SnapcheckConfig;
}
