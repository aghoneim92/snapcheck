# Known gaps at M0

Things inside M0's remit that are incomplete, unvalidated, or resting on a
single fixture. This is distinct from the README's "Out of scope" section,
which lists what M0 deliberately does not attempt.

Written down because the one thing worse than a gap is a gap nobody recorded.

---

## Unvalidated claims

### Only one fixture has ever been captured

Everything measured here comes from `packages/core-ui`: 62 stories, all static
React with Tailwind classes. That fixture contains **no** images, `Date`,
`Math.random`, portals, CSS-in-JS with generated class names, data fetching,
canvas, video, or iframes — all named as flake sources in the original survey.

So "62/62 stable across 10 CI runs" means those categories are untested, not
that they are handled. A third-party Storybook is the next step, and it is
where the real evidence will come from.

### The v3 and v4 index readers have never seen a real build

`readStoryIndex` normalizes v3 (`stories.json`, Storybook 6), v4 (Storybook 7)
and v5 (Storybook 8+), and there are tests for all three — but against
**hand-written fixtures**. Only v5 has been read from a real `storybook build`.
Hand-written fixtures encode what the schema was believed to be, which is
exactly the kind of assumption a real build breaks.

### `requireTestTag` rests on a heuristic

Storybook resolves `tags: ['!test']` when it builds the index, so an excluded
story simply arrives without the `test` tag. The reader therefore applies the
rule only when _some_ entry in the index carries `test`.

A build where stories legitimately lack the tag for another reason would have
those stories skipped silently. No real build with `!test` stories has been
tested. If this proves wrong, the fix is to make `requireTestTag` default off
and require opting in.

### Browser-crash recovery is untested

`captureStories` relaunches Chromium once if it disconnects. That code was
written after an out-of-memory kill during the GPU bisect, and it has never
actually run: no CI run has crashed a browser. It may not work.

## Correctness risks

### The changed fraction is measured against the whole page

A fraction of a full-page capture is dominated by empty space. Changing one
button's padding by 8px altered 14 of 18 captures visibly, but only 2 cleared
`threshold: 0.01` — a plainly visible change came to 0.03% of a 1280×720 page.

`minChangedPixels` (default 250) is a guard, not a fix. **The fix is to capture
the story's element rather than the viewport**, so the denominator is the story.
That work needs three decisions:

- what a size change between baseline and current means, since the element
  legitimately resizes (currently a size change counts as 100% changed and
  produces no diff image);
- what to do about content that overflows the story root — tooltips, portals,
  absolutely-positioned elements — which element capture would clip;
- `layout: 'fullscreen'` stories, which legitimately fill the viewport.

### The `minChangedPixels` default is derived from one kind of change

250 comes from one fixture and one patch: the smallest genuinely-hidden change
measured 300 pixels. A design system with large photographic or gradient-heavy
stories will see more pixels change for visually trivial reasons and may want a
higher floor. `false` restores fraction-only behaviour exactly.

### A GPU rasterization flake is open, not fixed

On an Apple M1 Max with GPU rendering on, `design-system-core-spec-sheet--default`
renders its 6px rounded corners two different ways, in roughly 1 run in 20. Fill
and text are identical; only the corner arcs differ. `disableGpu` eliminates it
but roughly doubles run time, and 61 of 62 stories never showed it.

It does not appear on CI, because the GitHub runner has no GPU and renders
through SwiftShader. So the project's own CI cannot catch a regression here, and
the story is **not** quarantined. Anyone running snapcheck locally on a GPU
machine may see it.

### `waitForNetworkIdle` costs 13s and has caught nothing

Measured by bisecting on CI: ~39s per run without it, ~52s with it. No story in
`core-ui` fetches anything, so it has never prevented a wrong snapshot here. It
stays on because a story that does fetch needs it, and a missed request is a
wrong snapshot rather than a slow one — but its value is currently unproven.

### Determinism evidence covers one viewport

`pnpm rig:determinism` captures at 1280 only, because each extra viewport
multiplies rig runtime by the number of runs. The snapshot path defaults to
`[375, 1280]`. Stability at 375 has been observed in snapshot runs but has never
been subjected to the 10-run exact-comparison check.

## Unimplemented from the M0 brief

### Committing baselines is not a config opt-in

The brief called for committing baselines to Git to be available behind an
explicit config opt-in. There is no such field. `.snapcheck/` is gitignored, and
a team wanting committed baselines would edit `.gitignore` themselves. The
trade-off is documented in the README; the config surface is not there.

### `parameters.snapshot` in story files is not read

Per-story settings come from `stories` globs in `snapcheck.config.ts` only.
Storybook's `index.json` carries no user `parameters` in any format version, so
reading them requires extracting them from the running preview. `StoryEntry`
has a `parameters` field that is always empty, reserved for that.

The consequence: a team migrating from Chromatic with per-story parameters
already in their story files has to restate them in config.

### Modes are a key, not a feature

Baselines are keyed by `storyId + mode + viewport` and `mode` is always
`'default'`. Light/dark capture is not implemented.

## Operational

### `report.html` embeds every image as a data URI

Self-contained by design, which makes it large: 14 changed stories produced a
297KB file. A real design system with hundreds of changed stories would produce
a report measured in tens of megabytes. The report is throwaway and gets
replaced by the review server at M1, so this is a limit to be aware of rather
than a design to build on.

### Run output grows without bound

`.snapcheck/runs/<timestamp>/` accumulates a full set of captures per run.
Nothing prunes it. On CI this does not matter because the workspace is
discarded; locally it will grow until someone deletes it.

### Timeouts are fixed constants

Navigation 30s, story render 15s, fonts 10s, network idle 10s. None are
configurable. A slow machine or a heavy story could hit them, and the only
recourse today is editing the source.

### The CI snapshot job never regression-tests

Baselines are gitignored, so every CI run of the `snapshot` job writes fresh
baselines and exits 0 with a warning. It proves the loop runs end to end; it
cannot detect a visual regression. The `report-smoke` job covers the changed
path by deliberately patching a component. Real cross-commit regression testing
needs the review server at M1, or committed baselines.
