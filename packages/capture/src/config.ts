import type { ReadStoryIndexOptions } from './storybookIndex.ts';

/**
 * The public config surface. One `snapcheck.config.ts` at the repository root,
 * typed via `defineConfig`.
 */

export interface SnapshotConfig {
  /** Viewport widths to capture each story at. */
  viewports: number[];
  /**
   * Fraction of the image allowed to change before a story fails, 0–1.
   * This is the pass/fail knob: a story fails when
   * `changedPixels / totalPixels > threshold`.
   *
   * Example: `0.01` lets a 1280×720 story differ by ~9,200 pixels — enough to
   * absorb antialiasing noise, not enough to hide a moved button.
   */
  threshold: number;
  /**
   * How different two pixels must be to count as changed at all, 0–1.
   * Per-pixel colour distance, not an amount of the image.
   *
   * Example: raise it to `0.2` when a gradient renders with slightly different
   * dithering between runs; that is a per-pixel question, not an area one.
   */
  pixelThreshold: number;
}

/**
 * Harness techniques, each individually toggleable so a fix can be attributed
 * to one of them. Only flags that are implemented appear here; the rest land
 * in Phase 4 rather than sitting in config doing nothing.
 */
export interface HarnessConfig {
  /** `prefers-reduced-motion: reduce`. Default: true. */
  reducedMotion?: boolean;
  /** Wait for stylesheets and every font the page uses. Default: true. */
  waitForFonts?: boolean;
  /** Chromium `--disable-gpu`. Default: false — GPU rendering is tried first. */
  disableGpu?: boolean;
  /** CPU raster and compositing, SwiftShader GL. Default: false. */
  forceSoftwareRendering?: boolean;
}

/** Per-story overrides, keyed by story-ID glob in `stories`. */
export interface StorySettings {
  /** CSS selector to wait for before capturing. */
  waitFor?: string;
  /**
   * Fixed wait in ms before capturing. Last resort: it slows every run and
   * hides the real condition. Prefer `waitFor`.
   */
  delay?: number;
  /** Override the configured viewports for these stories. */
  viewports?: number[];
  /** Skip these stories entirely. */
  disable?: boolean;
}

export interface SnapcheckConfig {
  /** Storybook static build directory, relative to the config file. */
  staticDir: string;
  snapshot?: Partial<SnapshotConfig>;
  /** Pages captured in parallel. Default: half the logical CPUs. */
  concurrency?: number;
  /** Story-ID globs captured and diffed but never failing the run. */
  quarantine?: string[];
  harness?: HarnessConfig;
  /** Per-story settings, keyed by story-ID glob. Later matches win. */
  stories?: Record<string, StorySettings>;
  /** Storybook index reader options. */
  index?: ReadStoryIndexOptions;
}

export interface ResolvedConfig {
  staticDir: string;
  snapshot: SnapshotConfig;
  concurrency?: number;
  quarantine: string[];
  harness: Required<HarnessConfig>;
  stories: Record<string, StorySettings>;
  index: ReadStoryIndexOptions;
}

/** Identity function that types a `snapcheck.config.ts` default export. */
export function defineConfig(config: SnapcheckConfig): SnapcheckConfig {
  return config;
}

export const DEFAULT_SNAPSHOT: SnapshotConfig = {
  viewports: [375, 1280],
  threshold: 0.01,
  pixelThreshold: 0.1,
};

export const DEFAULT_HARNESS: Required<HarnessConfig> = {
  reducedMotion: true,
  waitForFonts: true,
  disableGpu: false,
  forceSoftwareRendering: false,
};

export function resolveConfig(config: SnapcheckConfig): ResolvedConfig {
  return {
    staticDir: config.staticDir,
    snapshot: { ...DEFAULT_SNAPSHOT, ...config.snapshot },
    concurrency: config.concurrency,
    quarantine: config.quarantine ?? [],
    harness: { ...DEFAULT_HARNESS, ...config.harness },
    stories: config.stories ?? {},
    index: config.index ?? {},
  };
}

/**
 * Glob over story IDs: `*` matches any run of characters, `?` a single one.
 * Story IDs are slug segments joined by `--`, so no path semantics are needed.
 */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`^${escaped.replaceAll('*', '.*').replaceAll('?', '.')}$`);
}

export function matchesAnyGlob(id: string, globs: readonly string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(id));
}

/** Settings for one story, merging every matching glob in declaration order. */
export function storySettingsFor(
  stories: Record<string, StorySettings>,
  id: string,
): StorySettings {
  const settings: StorySettings = {};
  for (const [glob, value] of Object.entries(stories)) {
    if (globToRegExp(glob).test(id)) Object.assign(settings, value);
  }
  return settings;
}

export function isQuarantined(quarantine: readonly string[], id: string): boolean {
  return matchesAnyGlob(id, quarantine);
}
