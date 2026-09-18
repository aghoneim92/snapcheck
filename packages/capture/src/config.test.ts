import { describe, expect, it } from 'vitest';

import {
  defineConfig,
  globToRegExp,
  isQuarantined,
  matchesAnyGlob,
  resolveConfig,
  storySettingsFor,
} from './config.ts';

describe('resolveConfig', () => {
  it('fills the documented defaults', () => {
    const resolved = resolveConfig({ staticDir: 'build' });

    expect(resolved.snapshot).toEqual({
      viewports: [375, 1280],
      threshold: 0.01,
      pixelThreshold: 0.1,
    });
    expect(resolved.harness).toEqual({
      reducedMotion: true,
      waitForFonts: true,
      disableGpu: false,
      forceSoftwareRendering: false,
    });
    expect(resolved.quarantine).toEqual([]);
  });

  it('merges partial snapshot and harness overrides', () => {
    const resolved = resolveConfig(
      defineConfig({
        staticDir: 'build',
        snapshot: { threshold: 0.02 },
        harness: { disableGpu: true },
      }),
    );

    expect(resolved.snapshot.threshold).toBe(0.02);
    expect(resolved.snapshot.pixelThreshold).toBe(0.1);
    expect(resolved.harness.disableGpu).toBe(true);
    expect(resolved.harness.reducedMotion).toBe(true);
  });
});

describe('globToRegExp', () => {
  it('matches `*` across any characters and `?` across one', () => {
    expect(globToRegExp('forms-*').test('forms-input--default')).toBe(true);
    expect(globToRegExp('forms-*').test('controls-button--primary')).toBe(false);
    expect(globToRegExp('forms-input--defaul?').test('forms-input--default')).toBe(true);
  });

  it('treats regex metacharacters in a glob literally', () => {
    expect(globToRegExp('a+b--story').test('a+b--story')).toBe(true);
    expect(globToRegExp('a.b--story').test('axb--story')).toBe(false);
  });

  it('anchors at both ends', () => {
    expect(globToRegExp('forms-input--default').test('x-forms-input--default-y')).toBe(false);
  });
});

describe('storySettingsFor', () => {
  it('returns an empty object when nothing matches', () => {
    expect(storySettingsFor({ 'forms-*': { delay: 50 } }, 'controls-button--primary')).toEqual({});
  });

  it('merges every matching glob, later declarations winning', () => {
    const settings = storySettingsFor(
      {
        '*': { waitFor: '.ready' },
        'forms-*': { delay: 50 },
        'forms-input--*': { delay: 100 },
      },
      'forms-input--default',
    );

    expect(settings).toEqual({ waitFor: '.ready', delay: 100 });
  });
});

describe('quarantine', () => {
  it('matches story IDs by glob', () => {
    expect(isQuarantined(['design-system-*'], 'design-system-core-spec-sheet--default')).toBe(true);
    expect(isQuarantined(['design-system-*'], 'forms-input--default')).toBe(false);
  });

  it('is empty-safe', () => {
    expect(isQuarantined([], 'forms-input--default')).toBe(false);
    expect(matchesAnyGlob('forms-input--default', [])).toBe(false);
  });
});
