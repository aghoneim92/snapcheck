# snapcheck — M0

Visual regression testing for React component libraries that runs entirely
inside your own infrastructure. M0 is **capture + local diff, with no server**:
it consumes a **Storybook static build** — yours or anyone else's — reads
Storybook's `index.json`, screenshots each story with Playwright, and diffs
against baselines. No story file has to change.

```
packages/capture   @snapcheck/capture   index reader, Playwright runner,
                                        determinism harness, diff, report
packages/cli       @snapcheck/cli       bin `snapcheck`: args, config, exit codes
```

## Quick start

```sh
pnpm snapshot           # build Storybook, capture, diff, report
pnpm rig:determinism    # capture 10 times, require pixel-identical results
```

Or directly:

```sh
snapcheck snapshot --update        # promote what changed to baseline
snapcheck snapshot --runs 10       # determinism mode
snapcheck approve                  # promote the last run's changed stories
```

## Config

One `snapcheck.config.ts` at the repository root. No per-package config files.

```ts
import { defineConfig } from '@snapcheck/capture';

export default defineConfig({
  staticDir: 'packages/core-ui/storybook-static',
  snapshot: {
    viewports: [375, 1280],
    threshold: 0.01,
    pixelThreshold: 0.1,
  },
  concurrency: 4,
  quarantine: [],
  harness: {},
  stories: {
    'forms-*': { waitFor: '.ready' },
  },
  index: { excludeTags: [], requireTestTag: true },
});
```

### The two thresholds are not interchangeable

- **`threshold`** is the **fraction of the image that changed**, and it is the
  pass/fail knob. A story fails when `changedPixels / totalPixels > threshold`.
  Reach for this one when a story is failing over noise you consider
  acceptable. Exactly at the threshold passes.
- **`pixelThreshold`** is **per-pixel colour distance**: how different two
  pixels must be before they count as changed at all. Reach for this one when a
  gradient or shadow renders with slightly different values between runs.

Antialiasing tolerance is on by default.

### Per-story settings

Keyed by story-ID glob, so they work on a Storybook you don't control:

```ts
stories: {
  'content-chart--*': { waitFor: '[data-chart-ready]' },
  'content-chart--slow': { delay: 250 },
  'design-system-*': { viewports: [1280] },
  'forms-internal--*': { disable: true },
}
```

**`delay` is a last resort.** It slows every run by a fixed amount and hides
the real condition rather than describing it, so the run stays slow forever and
still races on a slower machine. Prefer `waitFor`, which names what you are
actually waiting for. Use `delay` only when nothing observable marks readiness.

## The determinism harness

Every technique is individually toggleable, so a fix can be attributed to one
of them and the rig can bisect with `--no-<flag>`.

| Flag                     | Default | What it removes                                                        |
| ------------------------ | ------- | ---------------------------------------------------------------------- |
| `reducedMotion`          | on      | `prefers-reduced-motion` animations                                    |
| `freezeAnimations`       | on      | CSS animations and transitions; animations pinned to their end frame   |
| `waitForFonts`           | on      | Text captured in the fallback font                                     |
| `waitForNetworkIdle`     | on      | Late-arriving network content (bounded, non-fatal)                     |
| `hideCaret`              | on      | The blinking text caret                                                |
| `hideScrollbars`         | on      | Scrollbars that appear and fade on their own timers                    |
| `fixedDeviceScaleFactor` | on      | Device-pixel-ratio differences                                         |
| `fixedViewport`          | on      | Ambient viewport size; also how a configured width reaches the browser |
| `disableGpu`             | **off** | GPU rasterization differences                                          |
| `forceSoftwareRendering` | **off** | All GPU involvement                                                    |

Waiting for Storybook to report the story rendered is unconditional, not a
flag. Storybook's own render errors and its error overlay are reported as
failures rather than screenshotted as if they were the story.

The GPU flags are off because GPU-enabled rendering is tried first. On a
machine with a GPU, one story here rendered its rounded corners two different
ways about once in twenty runs; `disableGpu` fixed it but doubled run time, and
the GitHub Actions runner has no GPU anyway. When a story cannot be stabilized,
quarantine that story — never raise the global threshold to accommodate a
handful, because that blinds every other story.

## Baselines are temporary, and environment-scoped

Baselines live in a **gitignored `.snapcheck/baselines/`**, keyed by
`storyId + mode + viewport`, alongside a manifest holding each baseline's
decoded-pixel hash so unchanged stories skip the diff entirely.

**This is the degraded single-user mode.** Local baselines have no review
workflow, no sharing between machines, and no history. The review server at M1
replaces them, so do not build on the assumption that this is permanent.
Committing baselines to Git is not the default: it produces merge conflicts and
review-by-PNG, which is a problem this product exists to solve.

**Baselines only compare within one environment.** macOS and Linux will never
produce identical pixels, and neither will GPU and software rendering. Every
run records an environment fingerprint — OS, architecture, Chromium and
Playwright versions, device scale factor, headless mode, and whether the GPU
was active — and comparing against baselines captured under a different
fingerprint produces a loud warning rather than a diff reported as a visual
change. That warning is the difference between "it passes locally and fails in
CI" being a five-second diagnosis and an afternoon.

Identity is on **decoded pixels**, never PNG bytes: metadata chunks,
compression level and filter choice vary without changing the image.

## Exit codes

A CI contract, and there are only three:

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | No changes. Writing new baselines also exits 0, with a warning. |
| `1`  | Visual changes detected, or a story failed to render.           |
| `2`  | Error: crash, missing build, invalid config.                    |

Quarantined stories never affect the exit code; their count is reported as a
headline number.

## Determinism is the acceptance criterion

`snapcheck snapshot --runs <n>` and `pnpm rig:determinism` capture the same
build repeatedly and require every run to be **pixel-identical**. That
comparison is exact, zero-tolerance, and deliberately cannot read your
`threshold`: flake quieter than the user threshold is invisible to the user but
is exactly the failure this tool exists to prevent.

Pixel-identical is only expected **within one environment**. The rig compares
runs to each other on one machine; it never tries to make platforms agree.

Current status on `ubuntu-24.04`: **62/62 captures stable across 10 runs**. The
same fixture was 16/62 with a naive capture, 33/62 with animations frozen, and
reached 62/62 once fonts and render completion were waited for.

## Out of scope at M0

No review server, no Postgres, no object storage, no Docker. No component
workshop, dev server or Vite plugin. No story discovery beyond Storybook's
`index.json`, no Git-history baseline resolution, no native CSF support, no
`play` function execution — static story states only. Chromium only. No
telemetry and no network calls of any kind.
