import type { BrowserContextOptions } from 'playwright';

import { DEFAULT_HARNESS, type HarnessConfig } from '../config.ts';

/**
 * The determinism harness: the techniques that make a story render the same
 * way twice. Every technique sits behind its own flag so a fix can be
 * attributed to one of them, and so the rig can bisect by turning one off.
 */

/**
 * Land every animation on its final frame and remove transitions.
 *
 * `animation-play-state: paused` alone is not enough — it freezes an animation
 * wherever it happens to be, which is a different frame on every run. A
 * negative delay larger than the duration means the animation is already past
 * its end when it starts, so it paints its end state deterministically.
 */
export const FREEZE_ANIMATIONS_CSS = `*, *::before, *::after {
  animation-delay: -1ms !important;
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  animation-fill-mode: forwards !important;
  animation-play-state: paused !important;
  transition-delay: 0s !important;
  transition-duration: 0s !important;
}`;

/** The text caret blinks, so it is present in some frames and not others. */
export const HIDE_CARET_CSS = `*, *::before, *::after {
  caret-color: transparent !important;
}`;

/**
 * Scrollbars appear only when content overflows, and overlay scrollbars fade
 * on a timer, so they come and go between runs.
 */
export const HIDE_SCROLLBARS_CSS = `*::-webkit-scrollbar {
  display: none !important;
}
* {
  scrollbar-width: none !important;
}`;

/** CSS for the enabled style-based techniques; empty when none apply. */
export function buildHarnessCss(harness: HarnessConfig): string {
  const blocks: string[] = [];
  if (harness.freezeAnimations ?? DEFAULT_HARNESS.freezeAnimations) {
    blocks.push(FREEZE_ANIMATIONS_CSS);
  }
  if (harness.hideCaret ?? DEFAULT_HARNESS.hideCaret) blocks.push(HIDE_CARET_CSS);
  if (harness.hideScrollbars ?? DEFAULT_HARNESS.hideScrollbars) blocks.push(HIDE_SCROLLBARS_CSS);
  return blocks.join('\n');
}

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Browser-context options for the enabled techniques.
 *
 * With `fixedViewport` off, Playwright's own default viewport applies and the
 * configured widths are ignored — that flag is the mechanism by which a
 * configured width reaches the browser.
 */
export function contextOptionsFor(
  harness: HarnessConfig,
  viewport: ViewportSize,
): BrowserContextOptions {
  const options: BrowserContextOptions = {};
  if (harness.reducedMotion ?? DEFAULT_HARNESS.reducedMotion) options.reducedMotion = 'reduce';
  if (harness.fixedViewport ?? DEFAULT_HARNESS.fixedViewport) options.viewport = viewport;
  if (harness.fixedDeviceScaleFactor ?? DEFAULT_HARNESS.fixedDeviceScaleFactor) {
    options.deviceScaleFactor = 1;
  }
  return options;
}
