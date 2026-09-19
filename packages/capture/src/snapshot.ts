import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  baselinePath,
  promoteBaseline,
  readBaselineManifest,
  writeBaselineManifest,
  type BaselineManifest,
} from './baselines.ts';
import { compare, isVisualChange } from './compare.ts';
import { isQuarantined, resolveConfig, type SnapcheckConfig } from './config.ts';
import { fingerprintDifferences, type EnvironmentFingerprint } from './environment.ts';
import { decodePng, encodePng, pixelHash } from './pixels.ts';
import { captureStories, type CaptureResult } from './runner/capture.ts';

/** Per-capture outcome. `quarantined` replaces what would have been a failure. */
export type SnapshotStatus = 'new' | 'unchanged' | 'changed' | 'failed' | 'quarantined';

export interface SnapshotResult {
  key: string;
  storyId: string;
  mode: string;
  viewport: number;
  status: SnapshotStatus;
  /** Fraction of the image that changed, 0 when there is nothing to compare. */
  changedFraction: number;
  changedPixels: number;
  durationMs: number;
  error?: string;
  /** Paths relative to the run directory. */
  files: { current?: string; baseline?: string; diff?: string };
}

export interface SnapshotCounts {
  total: number;
  new: number;
  unchanged: number;
  changed: number;
  failed: number;
  quarantined: number;
}

export interface SnapshotRunResult {
  runDir: string;
  fingerprint: EnvironmentFingerprint;
  /** Fingerprint the baselines were captured under, when there are baselines. */
  baselineFingerprint?: EnvironmentFingerprint;
  /** Non-empty when the two fingerprints differ: a warning, not a visual change. */
  fingerprintMismatch: string[];
  harness: Record<string, boolean>;
  threshold: number;
  pixelThreshold: number;
  minChangedPixels: number | false;
  counts: SnapshotCounts;
  results: SnapshotResult[];
  /** True when new baselines were written for stories that had none. */
  wroteNewBaselines: boolean;
}

export interface RunSnapshotOptions {
  config: SnapcheckConfig;
  /** Root for baselines and runs. Default `.snapcheck`. */
  snapcheckDir?: string;
  /** Promote every changed capture to baseline. */
  update?: boolean;
  concurrency?: number;
  filter?: (storyId: string) => boolean;
  /** Overrides the timestamped run directory name. */
  runId?: string;
}

interface StatusInput {
  failed: boolean;
  hasBaseline: boolean;
  aboveThreshold: boolean;
  quarantined: boolean;
}

/**
 * Pure status rule.
 *
 * Quarantined stories are still captured and diffed; quarantine only changes
 * how the outcome is reported, so a handful of unstable stories never forces
 * the global threshold up, which would blind every other story.
 */
export function decideStatus(input: StatusInput): SnapshotStatus {
  if (input.failed) return input.quarantined ? 'quarantined' : 'failed';
  if (!input.hasBaseline) return 'new';
  if (!input.aboveThreshold) return 'unchanged';
  return input.quarantined ? 'quarantined' : 'changed';
}

function countStatuses(results: readonly SnapshotResult[]): SnapshotCounts {
  const counts: SnapshotCounts = {
    total: results.length,
    new: 0,
    unchanged: 0,
    changed: 0,
    failed: 0,
    quarantined: 0,
  };
  for (const result of results) counts[result.status]++;
  return counts;
}

/**
 * Capture every story, compare against baselines, and write the run's
 * machine-readable results.
 *
 * Comparison is hash-first: on a real design system most stories are unchanged
 * on most commits, and skipping the pixel diff on a hash match is the
 * difference between a run taking seconds and taking minutes.
 */
export async function runSnapshot(options: RunSnapshotOptions): Promise<SnapshotRunResult> {
  const config = resolveConfig(options.config);
  const snapcheckDir = options.snapcheckDir ?? '.snapcheck';
  const baselineDir = path.join(snapcheckDir, 'baselines');
  const runId = options.runId ?? new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(snapcheckDir, 'runs', runId);
  const currentDir = path.join(runDir, 'current');
  const diffDir = path.join(runDir, 'diff');

  const run = await captureStories({
    staticDir: config.staticDir,
    outDir: currentDir,
    concurrency: options.concurrency ?? config.concurrency,
    viewports: config.snapshot.viewports,
    harness: config.harness,
    stories: config.stories,
    index: config.index,
    filter: options.filter,
  });

  const manifest = await readBaselineManifest(baselineDir);
  const updatedManifest: BaselineManifest = {
    version: 1,
    fingerprint: manifest.fingerprint ?? run.fingerprint,
    entries: { ...manifest.entries },
  };

  const results: SnapshotResult[] = [];
  let wroteNewBaselines = false;

  for (const capture of run.results) {
    // One capture at a time: a full-page image is tens of MB decoded.
    // oxlint-disable-next-line no-await-in-loop
    const evaluated = await evaluateCapture({
      capture,
      config,
      baselineDir,
      currentDir,
      diffDir,
      runDir,
      manifest: updatedManifest,
      update: options.update ?? false,
      onNewBaseline: () => {
        wroteNewBaselines = true;
      },
    });
    results.push(evaluated);
  }

  await writeBaselineManifest(baselineDir, updatedManifest);

  const result: SnapshotRunResult = {
    runDir,
    fingerprint: run.fingerprint,
    baselineFingerprint: manifest.fingerprint,
    fingerprintMismatch: manifest.fingerprint
      ? fingerprintDifferences(manifest.fingerprint, run.fingerprint)
      : [],
    harness: run.harness as unknown as Record<string, boolean>,
    threshold: config.snapshot.threshold,
    pixelThreshold: config.snapshot.pixelThreshold,
    minChangedPixels: config.snapshot.minChangedPixels,
    counts: countStatuses(results),
    results,
    wroteNewBaselines,
  };

  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, 'results.json'), JSON.stringify(result, null, 2));
  return result;
}

interface EvaluateInput {
  capture: CaptureResult;
  config: ReturnType<typeof resolveConfig>;
  baselineDir: string;
  currentDir: string;
  diffDir: string;
  runDir: string;
  manifest: BaselineManifest;
  update: boolean;
  onNewBaseline: () => void;
}

async function evaluateCapture(input: EvaluateInput): Promise<SnapshotResult> {
  const { capture, config, manifest } = input;
  const quarantined = isQuarantined(config.quarantine, capture.storyId);
  const base = {
    key: capture.key,
    storyId: capture.storyId,
    mode: capture.mode,
    viewport: capture.viewport,
    durationMs: capture.durationMs,
  };

  if (capture.status === 'failed' || !capture.file) {
    return {
      ...base,
      status: decideStatus({
        failed: true,
        hasBaseline: false,
        aboveThreshold: false,
        quarantined,
      }),
      changedFraction: 0,
      changedPixels: 0,
      error: capture.error,
      files: {},
    };
  }

  const currentPath = path.join(input.currentDir, capture.file);
  const currentBytes = await readFile(currentPath);
  const current = decodePng(currentBytes);
  const currentHash = pixelHash(current);
  const files: SnapshotResult['files'] = { current: path.relative(input.runDir, currentPath) };
  const existing = manifest.entries[capture.key];

  if (!existing) {
    manifest.entries[capture.key] = await promoteBaseline(
      input.baselineDir,
      capture.key,
      currentBytes,
      {
        hash: currentHash,
        width: current.width,
        height: current.height,
      },
    );
    input.onNewBaseline();
    return {
      ...base,
      status: 'new',
      changedFraction: 0,
      changedPixels: 0,
      files,
    };
  }

  files.baseline = path.relative(input.runDir, baselinePath(input.baselineDir, capture.key));

  // Hash first: identical pixels need no diff at all.
  if (existing.hash === currentHash) {
    return { ...base, status: 'unchanged', changedFraction: 0, changedPixels: 0, files };
  }

  const baseline = decodePng(await readFile(baselinePath(input.baselineDir, capture.key)));
  const comparison = compare(baseline, current, {
    pixelThreshold: config.snapshot.pixelThreshold,
  });
  const aboveThreshold = isVisualChange(comparison, {
    threshold: config.snapshot.threshold,
    minChangedPixels: config.snapshot.minChangedPixels,
  });

  if (aboveThreshold && comparison.diffImage) {
    await mkdir(input.diffDir, { recursive: true });
    const diffPath = path.join(input.diffDir, `${capture.key}.png`);
    await writeFile(diffPath, encodePng(comparison.diffImage));
    files.diff = path.relative(input.runDir, diffPath);
  }

  if (input.update && aboveThreshold) {
    manifest.entries[capture.key] = await promoteBaseline(
      input.baselineDir,
      capture.key,
      currentBytes,
      { hash: currentHash, width: current.width, height: current.height },
    );
  }

  return {
    ...base,
    status: decideStatus({
      failed: false,
      hasBaseline: true,
      aboveThreshold,
      quarantined,
    }),
    changedFraction: comparison.changedFraction,
    changedPixels: comparison.changedPixels,
    files,
  };
}
