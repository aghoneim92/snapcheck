/**
 * How each third-party fixture is built from source. The pinned commit lives
 * separately in `pins.json`, because bumping it is a deliberate act with its
 * own command and should never be an edit buried in build logic.
 */

export interface BuildStep {
  label: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface FixtureDefinition {
  name: string;
  /** Built Storybook, relative to the clone. This is the fixture's `staticDir`. */
  outputDir: string;
  /** Run in order in the clone's root. */
  steps: BuildStep[];
}

// Every build runs with Storybook telemetry off, as core-ui's does.
const quiet = { STORYBOOK_DISABLE_TELEMETRY: '1', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };

export const FIXTURES: Record<string, FixtureDefinition> = {
  /**
   * Grafana's Saga design system: the `@grafana/ui` Storybook, which also
   * pulls stories from `packages/grafana-alerting`. Pure JS — Yarn 4 via
   * corepack; nothing from Grafana's Go backend is involved.
   */
  grafana: {
    name: 'grafana',
    outputDir: 'packages/grafana-ui/dist/storybook',
    steps: [
      {
        label: 'install',
        command: 'corepack',
        args: ['yarn', 'install', '--immutable'],
        env: quiet,
      },
      {
        label: 'build',
        command: 'corepack',
        args: ['yarn', 'storybook:build'],
        // Grafana's Storybook config drops `*.internal` alerting stories only
        // when NODE_ENV is production, which is how their published build runs.
        env: { ...quiet, NODE_ENV: 'production' },
      },
    ],
  },
};

export function fixtureDefinition(name: string): FixtureDefinition {
  const definition = FIXTURES[name];
  if (!definition) {
    throw new Error(`Unknown fixture "${name}". Known: ${Object.keys(FIXTURES).join(', ')}.`);
  }
  return definition;
}
