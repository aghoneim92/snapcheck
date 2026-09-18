import { describe, expect, it } from 'vitest';

import { DEFAULT_HARNESS } from '../config.ts';
import { buildHarnessCss, contextOptionsFor } from './harness.ts';

describe('buildHarnessCss', () => {
  it('includes every style technique by default', () => {
    const css = buildHarnessCss(DEFAULT_HARNESS);

    expect(css).toContain('animation-delay: -1ms');
    expect(css).toContain('caret-color: transparent');
    expect(css).toContain('scrollbar-width: none');
  });

  it('pins animations to their end frame rather than only pausing them', () => {
    const css = buildHarnessCss({ freezeAnimations: true });

    // A negative delay longer than the duration lands on the final frame;
    // pausing alone would freeze a different frame on every run.
    expect(css).toContain('animation-delay: -1ms');
    expect(css).toContain('animation-duration: 1ms');
    expect(css).toContain('animation-play-state: paused');
  });

  it('zeroes transition durations and delays', () => {
    const css = buildHarnessCss({ freezeAnimations: true });

    expect(css).toContain('transition-duration: 0s');
    expect(css).toContain('transition-delay: 0s');
  });

  it('drops each block when its flag is off', () => {
    expect(buildHarnessCss({ freezeAnimations: false })).not.toContain('animation-delay');
    expect(buildHarnessCss({ hideCaret: false })).not.toContain('caret-color');
    expect(buildHarnessCss({ hideScrollbars: false })).not.toContain('scrollbar-width');
  });

  it('is empty when every style technique is off', () => {
    expect(
      buildHarnessCss({ freezeAnimations: false, hideCaret: false, hideScrollbars: false }),
    ).toBe('');
  });
});

describe('contextOptionsFor', () => {
  const viewport = { width: 375, height: 720 };

  it('applies reduced motion, the configured viewport and a pinned scale factor by default', () => {
    expect(contextOptionsFor(DEFAULT_HARNESS, viewport)).toEqual({
      reducedMotion: 'reduce',
      viewport,
      deviceScaleFactor: 1,
    });
  });

  it('omits each option when its flag is off', () => {
    expect(contextOptionsFor({ reducedMotion: false }, viewport).reducedMotion).toBeUndefined();
    expect(contextOptionsFor({ fixedViewport: false }, viewport).viewport).toBeUndefined();
    expect(
      contextOptionsFor({ fixedDeviceScaleFactor: false }, viewport).deviceScaleFactor,
    ).toBeUndefined();
  });

  it('passes the requested width through', () => {
    expect(contextOptionsFor(DEFAULT_HARNESS, { width: 1280, height: 720 }).viewport).toEqual({
      width: 1280,
      height: 720,
    });
  });
});
