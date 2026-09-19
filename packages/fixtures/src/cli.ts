import path from 'node:path';
import { parseArgs } from 'node:util';

import { readFixtureManifest, type FixtureManifest } from '@snapcheck/capture';

import { buildFixture, buildProblems, REPO_ROOT, run, staticDirFor } from './build.ts';
import { fixtureDefinition } from './definitions.ts';
import { commitForTag, PINS_FILE, readPin, writePin } from './pins.ts';

/**
 * `pnpm fixture <command> <name>`
 *
 *   build <name> [--force]  Clone at the pin and build, or reuse a matching build
 *   verify <name>           Exit 1 unless the build on disk matches the pin
 *   bump <name> <tag>       Re-pin to a release tag. Deliberate: invalidates baselines
 *   path <name>             Print the fixture's staticDir
 *
 * Exit codes: 0 ok, 1 verify found a mismatch, 2 error.
 */

const USAGE = `pnpm fixture <build|verify|bump|path> <name> [tag] [--force]`;

function describe(manifest: FixtureManifest): string {
  const { index } = manifest;
  return (
    `${manifest.fixture} ${manifest.tag} (${manifest.sha.slice(0, 12)}, ${manifest.commitDate})\n` +
    `  Storybook ${manifest.storybookVersion}, ${index.file} v${index.version}: ` +
    `${index.entries} entries (${index.stories} stories, ${index.docs} docs)\n` +
    `  ${index.file} sha256 ${index.sha256}\n` +
    `  built ${manifest.builtAt} on ${manifest.build.platform}/${manifest.build.arch} ` +
    `node ${manifest.build.node} in ${(manifest.build.durationMs / 1000).toFixed(0)}s`
  );
}

const log = (line: string) => console.log(`[fixture] ${line}`);

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { force: { type: 'boolean', default: false } },
    allowPositionals: true,
  });
  const [command, name, tag] = positionals;
  if (!command || !name) {
    console.error(USAGE);
    return 2;
  }
  const definition = fixtureDefinition(name);
  const staticDir = staticDirFor(definition);

  switch (command) {
    case 'path': {
      console.log(path.relative(REPO_ROOT, staticDir));
      return 0;
    }

    case 'build': {
      const pin = await readPin(name);
      const result = await buildFixture({ definition, pin, force: values.force, log });
      log(result.reused ? 'build matches the pin; reusing it' : 'built');
      console.log(describe(result.manifest));
      console.log(`staticDir: ${path.relative(REPO_ROOT, result.staticDir)}`);
      return 0;
    }

    case 'verify': {
      const pin = await readPin(name);
      const manifest = await readFixtureManifest(staticDir);
      const problems = await buildProblems(pin, staticDir, manifest);
      if (problems.length > 0) {
        console.error(`${name}: build does not match the pin`);
        for (const problem of problems) console.error(`  ${problem}`);
        return 1;
      }
      console.log(describe(manifest as FixtureManifest));
      return 0;
    }

    case 'bump': {
      if (!tag) {
        console.error(`Usage: pnpm fixture bump ${name} <tag>`);
        return 2;
      }
      const pin = await readPin(name);
      const output = await run(
        'git',
        ['ls-remote', pin.repo, `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
        { cwd: REPO_ROOT },
      );
      const sha = commitForTag(output, tag);
      if (!sha) {
        console.error(`Tag ${tag} not found in ${pin.repo}.`);
        return 2;
      }
      if (sha === pin.sha && tag === pin.tag) {
        log(`${name} is already pinned to ${tag} (${sha.slice(0, 12)})`);
        return 0;
      }
      await writePin(name, { repo: pin.repo, tag, sha });
      console.warn(
        `\n!! ${name} re-pinned: ${pin.tag} (${pin.sha.slice(0, 12)}) → ${tag} (${sha.slice(0, 12)})\n` +
          `   Updated ${path.relative(REPO_ROOT, PINS_FILE)}. Every ${name} baseline is now invalid:\n` +
          `   snapshot runs will refuse to compare until re-baselined with --update.\n` +
          `   Next: pnpm fixture build ${name}\n`,
      );
      return 0;
    }

    default: {
      console.error(`Unknown command: ${command}\n${USAGE}`);
      return 2;
    }
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  },
);
