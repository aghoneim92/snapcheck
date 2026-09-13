import { chromium, type Browser } from 'playwright';

/**
 * Which Chromium headless implementation renders the snapshots.
 *
 * - `new`: full Chromium running headless (`channel: 'chromium'`). Same
 *   rendering path as headed Chrome.
 * - `shell`: the separate `chromium-headless-shell` binary, the old headless
 *   implementation.
 *
 * The two render differently, and Playwright has changed which one is the
 * default before, so it is always passed explicitly and recorded in the
 * environment fingerprint instead of inherited from the Playwright version.
 */
export type HeadlessMode = 'new' | 'shell';

export const DEFAULT_HEADLESS_MODE: HeadlessMode = 'new';

export interface LaunchOptions {
  headlessMode?: HeadlessMode;
  /** Extra Chromium flags, e.g. the GPU toggles the harness bisects with. */
  args?: string[];
}

export interface GpuFlags {
  /** `--disable-gpu`: no hardware acceleration; Chromium picks its own fallback. */
  disableGpu?: boolean;
  /**
   * Rasterize and composite on the CPU and run GL through SwiftShader, so no
   * pixel touches the GPU driver. Slower, but independent of the host GPU.
   */
  forceSoftwareRendering?: boolean;
}

/**
 * Chromium flags for the GPU toggles. Both default OFF: snapcheck tries
 * GPU-enabled rendering first, and these exist so the rig can bisect with them.
 */
export function gpuArgs(flags: GpuFlags): string[] {
  const args: string[] = [];
  if (flags.disableGpu) args.push('--disable-gpu');
  if (flags.forceSoftwareRendering) {
    args.push(
      '--disable-gpu-rasterization',
      '--disable-gpu-compositing',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    );
  }
  return args;
}

export function launchChromium(options: LaunchOptions = {}): Promise<Browser> {
  const headlessMode = options.headlessMode ?? DEFAULT_HEADLESS_MODE;
  return chromium.launch({
    headless: true,
    channel: headlessMode === 'new' ? 'chromium' : 'chromium-headless-shell',
    args: options.args ?? [],
  });
}
