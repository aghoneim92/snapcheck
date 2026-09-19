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
  httpCache: { mode: 'replay' },
});
```

### The three comparison knobs are not interchangeable

- **`threshold`** is the **fraction of the image that changed**. A story fails
  when `changedPixels / totalPixels > threshold`. Reach for this one when a
  story is failing over noise you consider acceptable. Exactly at the threshold
  passes.
- **`pixelThreshold`** is **per-pixel colour distance**: how different two
  pixels must be before they count as changed at all. Reach for this one when a
  gradient or shadow renders with slightly different values between runs.
- **`minChangedPixels`** is an **absolute floor**: a story also fails when more
  than this many pixels changed, however small a share of the image that is.
  `false` disables it.

A story fails if **either** `threshold` or `minChangedPixels` is exceeded.

The floor exists because a fraction is measured against the whole capture, and
most stories draw a small control on a large, mostly empty page. Changing one
button's padding by 8px in this repo altered 14 of 18 captures visibly, but
only 2 cleared `threshold: 0.01` — a plainly visible change came to 0.03% of a
1280×720 page. The smallest genuinely-hidden change was 300 pixels, hence the
default of 250.

The deeper fix is to capture the story's element rather than the whole page, so
the denominator is the story instead of the viewport. That is planned, not
done; the floor is the cheap guard in the meantime.

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

`waitForNetworkIdle` is the expensive one: on CI it costs about 13 seconds per
run of this fixture (39s to 52s), measured by bisecting with
`--no-wait-for-network-idle`, and caught nothing here — no story in `core-ui`
fetches anything. It stays on because a story that does fetch needs it, and a
missed request is a wrong snapshot rather than a slow one. Turn it off if your
stories make no requests and you want the time back.

The GPU flags are off because GPU-enabled rendering is tried first. On a
machine with a GPU, one story here rendered its rounded corners two different
ways about once in twenty runs; `disableGpu` fixed it but doubled run time, and
the GitHub Actions runner has no GPU anyway. When a story cannot be stabilized,
quarantine that story — never raise the global threshold to accommodate a
handful, because that blinds every other story.

## External requests: HTTP record/replay

A story that loads a webfont from a CDN, an avatar from a bucket or data from
an API is nondeterministic in exactly the way this harness exists to remove,
and often it cannot be fixed at source. snapcheck can record every response
from outside the static build once and replay it on every run after that, with
the network switched off. That is also what lets capture run air-gapped.

```sh
snapcheck snapshot --http-cache record   # fetch and store every external response
snapcheck snapshot                        # replays: the default once a cache exists
snapcheck snapshot --http-cache bypass   # live network, no cache (the old behaviour)
```

or `httpCache: { mode, dir }` in config. The cache lives in
`.snapcheck/http-cache/<fixture>/` (gitignored), `default` for an ordinary
build: `manifest.json` maps each request to its status, headers, content type,
size and body hash, and bodies are stored once each, by content, in `blobs/`.

What each mode guarantees:

- **record** fetches each request once and serves every later request for the
  same method and URL from what it stored. A response that differs per request,
  like a random avatar, is frozen at its first value. A capture does not
  proceed while a response it asked for is still being recorded, and one that
  cannot be recorded fails that capture by URL. A recording run still waits on
  the real network, so **take baselines in replay**, not from the recording run.
- **replay** serves only from the cache. Outbound networking is off at the
  browser, not just unrouted, so service-worker fetches and WebSockets cannot
  reach the network either. A request with no cached response **fails that
  story's capture and names the URL**; there is no passthrough, because one
  uncached request is one flake source.
- **bypass** uses the live network, as snapcheck did before the cache existed.

Requests to the static build itself are never cached — the build is what is
under test.

**Baselines record which cache they came from.** The environment fingerprint
gains the cache mode and a hash of everything the cache serves, so comparing
against baselines captured from the live network, or from a different
recording, is warned about as an environment change rather than reported as a
visual one. Headers are part of that hash, and a fresh recording almost always
changes it (a `Date` header alone does): re-recording means re-baselining.

What "replays byte-identically" means precisely: bodies are the exact bytes the
page consumed and headers are replayed verbatim, in order. Two things differ
from the wire, both forced by how Chromium intercepts requests:

- A compressed response is stored **decoded**, because that is how the browser
  hands it over; its `content-encoding` header is replayed unchanged and
  Chromium ignores it for intercepted bodies.
- A **redirect is stored as its final response** under the requested URL.
  Chromium does not intercept the follow-up request of a replayed redirect, so
  replaying the 3xx itself would let that request escape the cache. The target
  is kept as `finalUrl` in the manifest.

Known limits:

- Requests are keyed by **method and URL only**. Two POSTs to one GraphQL
  endpoint with different bodies share one cached response.
- A request made **by a service worker** is blocked in replay but is not seen by
  the cache, so it is not named as a miss: the story renders without it rather
  than failing loudly. Stories using MSW are affected only for requests MSW
  passes through to the network.
- Repeated response headers other than `set-cookie` are folded into one
  comma-separated header on replay; Playwright takes one value per name.

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
Playwright versions, device scale factor, headless mode, whether the GPU was
active, and which HTTP cache served external requests — and comparing against baselines captured under a different
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

Read that number for what it is: one fixture, at one viewport, in one
environment. `packages/core-ui` contains no images, dates, randomness, portals,
CSS-in-JS class hashes or data fetching, so those flake sources are untested
rather than handled.

## Known gaps

[KNOWN-GAPS.md](./KNOWN-GAPS.md) records what is incomplete, unvalidated or
resting on a single fixture — as distinct from the deliberate non-goals below.
The load-bearing ones:

- Only one fixture has ever been captured, and only its v5 index has been read
  from a real build; v3 and v4 are tested against hand-written fixtures.
- The changed fraction is measured against the whole page, so a visible change
  to a small control is a fraction of a percent. `minChangedPixels` guards it;
  capturing the story element is the actual fix.
- A GPU rasterization flake is open, not fixed, and CI cannot catch it because
  the runner has no GPU.
- `parameters.snapshot` in story files is not read; per-story settings come
  from config globs only.

## Out of scope at M0

No review server, no Postgres, no object storage, no Docker. No component
workshop, dev server or Vite plugin. No story discovery beyond Storybook's
`index.json`, no Git-history baseline resolution, no native CSF support, no
`play` function execution — static story states only. Chromium only. No
telemetry and no network calls of any kind.
