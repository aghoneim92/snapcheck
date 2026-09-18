import type { Page } from 'playwright';

// Storybook's globals are double-underscored by Storybook, and ours mirrors them.
/* oxlint-disable no-underscore-dangle */

interface RenderState {
  status: 'pending' | 'rendered' | 'errored';
  error?: string;
}

interface StorybookChannel {
  on: (event: string, listener: (payload?: unknown) => void) => void;
}

interface TrackedWindow {
  __snapcheckRender?: RenderState;
  __STORYBOOK_ADDONS_CHANNEL__?: StorybookChannel;
}

/** Raised when Storybook itself reports the story did not render. */
export class StoryRenderError extends Error {
  override name = 'StoryRenderError';
}

/**
 * Runs before any page script. Storybook's preview creates its channel during
 * startup, well before a story renders, so polling for it every few ms
 * attaches the listeners before `storyRendered` can fire.
 */
function trackStoryRender(): void {
  const tracked = window as unknown as TrackedWindow;
  const state: RenderState = { status: 'pending' };
  tracked.__snapcheckRender = state;

  const attach = (): boolean => {
    const channel = tracked.__STORYBOOK_ADDONS_CHANNEL__;
    if (!channel) return false;
    channel.on('storyRendered', () => {
      if (state.status === 'pending') state.status = 'rendered';
    });
    for (const event of ['storyErrored', 'storyThrewException', 'storyMissing']) {
      channel.on(event, (payload) => {
        const detail = payload as { message?: string; title?: string } | string | undefined;
        state.status = 'errored';
        state.error = `${event}: ${
          typeof detail === 'string' ? detail : (detail?.message ?? detail?.title ?? 'no detail')
        }`;
      });
    }
    return true;
  };

  if (!attach()) {
    const timer = setInterval(() => {
      if (attach()) clearInterval(timer);
    }, 5);
  }
}

/** Call before `page.goto`. */
export async function installRenderTracker(page: Page): Promise<void> {
  await page.addInitScript(trackStoryRender);
}

/**
 * Resolves once Storybook reports the story rendered and the result has been
 * painted. Throws with Storybook's own error when the story failed, so an
 * error overlay is never captured as if it were the story.
 */
export async function waitForStoryRender(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as TrackedWindow).__snapcheckRender?.status !== 'pending',
    null,
    { timeout: timeoutMs },
  );
  const state = await page.evaluate(
    () => (window as unknown as TrackedWindow).__snapcheckRender as RenderState,
  );
  if (state.status === 'errored') throw new StoryRenderError(state.error ?? 'unknown render error');

  // Two frames: React commits effects after the render event, then paints.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/**
 * Storybook's error overlay replaces the story in the DOM. Without this check
 * a broken story yields a clean screenshot of an error page, which diffs as a
 * visual change rather than a failure.
 */
export async function assertNoErrorOverlay(page: Page): Promise<void> {
  const overlay = await page.evaluate(() => {
    if (!document.body?.classList.contains('sb-show-errordisplay')) return null;
    const text = document.querySelector('#error-message, .sb-errordisplay')?.textContent ?? '';
    return text.trim().slice(0, 300) || 'Storybook displayed its error overlay';
  });
  if (overlay !== null) throw new StoryRenderError(overlay);
}

/**
 * Waits until every font the page actually uses has loaded.
 *
 * `document.fonts.ready` alone is not enough: it resolves immediately while
 * nothing is loading yet, which is the state a page is in before its font
 * stylesheet (e.g. Google Fonts) has arrived, or before layout has asked for
 * any face. So: wait for stylesheets, force layout so used faces start
 * loading, then wait until the font set settles across a frame.
 */
export async function waitForFonts(page: Page, timeoutMs = 10_000): Promise<void> {
  await page.evaluate(async (timeout) => {
    const deadline = performance.now() + timeout;
    // Must stay inside: this function is serialized and runs in the browser.
    // oxlint-disable-next-line unicorn/consistent-function-scoping
    const nextFrame = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
    await Promise.all(
      links.map((link) =>
        link.sheet
          ? undefined
          : new Promise<void>((resolve) => {
              link.addEventListener('load', () => resolve(), { once: true });
              link.addEventListener('error', () => resolve(), { once: true });
            }),
      ),
    );

    // Sequential polling is the point: each pass waits for the set to settle.
    /* oxlint-disable no-await-in-loop */
    while (performance.now() < deadline) {
      document.body.getBoundingClientRect();
      await document.fonts.ready;
      await nextFrame();
      if (document.fonts.status === 'loaded') return;
    }
    /* oxlint-enable no-await-in-loop */
    throw new Error(`Fonts still loading after ${timeout}ms`);
  }, timeoutMs);
}
