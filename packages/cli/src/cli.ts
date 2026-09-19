#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';

import { FixtureMismatchError } from '@snapcheck/capture';

import { runApprove } from './commands/approve.ts';
import { runSnapshotCommand } from './commands/snapshot.ts';
import { ConfigError, findConfig, loadConfig } from './config.ts';

/**
 * `snapcheck` — thin by design: argument parsing, config loading and exit
 * codes. Everything else lives in @snapcheck/capture.
 *
 * Exit codes are a CI contract and there are only three:
 *   0  no changes (new baselines written also exits 0, with a warning)
 *   1  visual changes detected, or a story failed to render
 *   2  error: crash, missing build, invalid config
 */

const USAGE = `snapcheck <command> [options]

Commands:
  snapshot    Capture, diff against baselines, write a report
  approve     Promote the last run's changed stories to baseline

Options:
  --config <file>        Config file (default: snapcheck.config.ts)
  --static-dir <dir>     Override the configured Storybook static build
  --update               Promote changed stories to baseline as part of the run
  --concurrency <n>      Pages captured in parallel
  --filter <glob>        Only stories whose id matches
  --runs <n>             Determinism mode: capture n times, require identical
  --http-cache <mode>    External requests: record, replay or bypass
                         (default: replay when a cache exists, else bypass)
  --no-<harness-flag>    Turn one harness technique off, e.g. --no-hide-caret
`;

export async function main(argv: string[]): Promise<number> {
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return command ? 0 : 2;
  }

  const { values } = parseArgs({
    args: argv.slice(1),
    options: {
      config: { type: 'string' },
      'static-dir': { type: 'string' },
      update: { type: 'boolean', default: false },
      concurrency: { type: 'string' },
      filter: { type: 'string' },
      runs: { type: 'string' },
      'http-cache': { type: 'string' },
      'no-reduced-motion': { type: 'boolean', default: false },
      'no-freeze-animations': { type: 'boolean', default: false },
      'no-wait-for-fonts': { type: 'boolean', default: false },
      'no-wait-for-network-idle': { type: 'boolean', default: false },
      'no-hide-caret': { type: 'boolean', default: false },
      'no-hide-scrollbars': { type: 'boolean', default: false },
      'no-fixed-device-scale-factor': { type: 'boolean', default: false },
      'no-fixed-viewport': { type: 'boolean', default: false },
      'disable-gpu': { type: 'boolean', default: false },
      'force-software-rendering': { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  const cwd = process.cwd();
  const configFile = await findConfig(cwd, values.config);
  const config = await loadConfig(configFile);
  const root = path.dirname(configFile);

  switch (command) {
    case 'snapshot': {
      return await runSnapshotCommand({ config, root, values });
    }
    case 'approve': {
      return await runApprove({ root });
    }
    default: {
      console.error(`Unknown command: ${command}\n\n${USAGE}`);
      return 2;
    }
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    // Loud, and exit 2 rather than 1: the baselines are invalid, which is not
    // the same thing as the design system having changed.
    if (error instanceof FixtureMismatchError) {
      console.error(`\n!! FIXTURE CHANGED — NOT A VISUAL REGRESSION\n\n${error.message}\n`);
      process.exit(2);
    }
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(2);
    }
    console.error(error);
    process.exit(2);
  },
);
