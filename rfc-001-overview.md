/
Snapcheck
Snapcheck
Snapcheck is a fully open source storybook and chromatic alternative

How can I help you today?

Recents
Snapcheck design system implementation plan
just now
Creating a project specification with Vite and React
21 hours ago
Open-source React storybook alternative
22 hours ago
Instructions
Add instructions to tailor Claude’s responses

Memory
Only you
View and manage what Claude remembers from your chats.

Context
1% of project capacity used

rfc-001-overview.md
19.2kB

md

Storybook and Chromatic Pain Points: Opportunity Landscape for a Self-Hosted Alternative.md
19kB

md

Scheduled
Set up recurring tasks for this project.

rfc-001-overview.md

# RFC-001: Component Workshop + Self-Hosted Visual Regression

**Status:** Draft
**Date:** 2026-09-12
**Name:** `snapcheck`
**License:** MIT throughout

---

## 1. Problem

Teams building React UI today pick between two unsatisfying halves:

- **Storybook** gives the ecosystem, but costs upgrade breakage once a year, slow builds, config sprawl, and monorepo friction.
- **Chromatic** gives the visual-testing workflow, but is SaaS-only, metered per snapshot, and ships screenshots of unreleased UI to a third party. There is no on-premise option.
  The self-hosted middle ground just got thinner: Lost Pixel was archived in April 2026, and Argos has no supported self-hosting path. Ladle and React Cosmos are fast workshops with no visual testing attached.

**The gap:** no actively-maintained tool combines a fast, low-flake React component workshop with built-in, genuinely self-hostable visual regression and a real review workflow.

## 2. Goals

1. **Stability over features.** Story format frozen at v1. No breaking changes within a major. Working codemods when a major does land.
2. **Fast by default.** Cold start under 2s, HMR under 100ms with state preserved, production build ≥3× faster than Storybook on an equivalent story count.
3. **Near-zero config.** Auto-detect React + Vite. Work in pnpm workspaces / Nx / Turborepo without per-package init.
4. **Visual regression built in, self-hosted.** Screenshot capture, baselines, diffing, and approve/reject review — all running inside the user's infrastructure, air-gapped, no metering.
5. **Migration is the front door.** Existing Storybook and Ladle stories should run with an import rewrite and nothing else.

## 3. Non-goals (v1)

- Frameworks other than React. No Vue, Svelte, Angular, web components.
- Bundlers other than Vite. No webpack, no Babel config surface.
- A general-purpose addon API. A fixed set of built-in panels instead.
- MDX / long-form docs authoring. Stories are the docs in v1.
- A hosted SaaS. Self-hosting is the product, not the fallback.
- Cross-browser matrices. Chromium only in M0; Firefox and WebKit come after the review workflow lands. Playwright makes the engine swap cheap, but every added browser multiplies snapshot volume, baseline storage, and flake surface, so each one waits until the determinism harness is proven on the one before it.

## 4. Stack

| Layer                | Choice                                                                     |
| -------------------- | -------------------------------------------------------------------------- |
| Language             | TypeScript, strict, ESM only                                               |
| Bundler / dev server | Vite 7+                                                                    |
| UI framework         | React 18/19                                                                |
| Package manager      | pnpm workspaces                                                            |
| Capture engine       | Playwright (Chromium first)                                                |
| Review service       | Node + Fastify, Postgres, S3-compatible object storage (MinIO or local FS) |
| Distribution         | npm packages + a single `docker compose` for the server                    |
| License              | MIT, all packages and the server                                           |

**On MIT.** Chosen deliberately over an AGPL server. A competitor can take the review server and run a hosted service against us, and that is accepted — the bet is that the moat is the migration path, the flake-free capture harness, and being the default recommendation for people leaving Chromatic, not license terms. The practical upside is that MIT clears enterprise policy everywhere, including the regulated buyers who are the core audience, and there is no CLA friction for contributors.

## 5. Story format — the main decision

### Options considered

**A. Invent a new format.** Full freedom to design something cleaner: typed, no `argTypes` duplication, visual-test config as a first-class field.
_Cost:_ every migration becomes a rewrite. We lose the one asset we can take from Storybook for free — the millions of story files already written. Stories also become a one-way door: adopting us means you can't go back, which raises the risk of trying us.

**B. Reimplement CSF in full**, including decorators, globals, MDX, and the addon parameter surface.
_Cost:_ we inherit the complexity we're positioning against, and the frozen-format promise becomes hard to keep.

**C. Adopt a strict subset of CSF3 as the native format, plus a namespaced extension for visual testing.** ← **Recommended**

### Decision

**Reuse CSF. Do not invent a new format.** Compatibility is the moat; the product differentiator is the runtime and the visual-testing workflow, not the file syntax.

Concretely:

**Supported (CSF3 canonical):**

```ts
import type { Meta, StoryObj } from '@snapcheck/react';
import { Button } from './Button';

const meta = {
  title: 'Controls/Button',
  component: Button,
  args: { variant: 'primary' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: 'Save' },
};

export const Loading: Story = {
  args: { loading: true },
  parameters: {
    snapshot: { viewports: [375, 1280], threshold: 0.02 },
  },
};
```

- Default export meta: `title`, `component`, `args`, `argTypes`, `tags`, `parameters`, `decorators`.
- Named exports as stories, object form, with `args`, `render`, `name`, `tags`, `parameters`, `play`.
- Story IDs derived from `title` + export name using Storybook's slugging rules, so existing Chromatic/Storybook URLs and baseline keys line up.
- `Meta` / `StoryObj` types are API-compatible, so migration is an import-specifier rewrite. Ship a codemod that does only that.
  **Supported for compatibility, not documented as canonical:**

- CSF2 function stories (`export const A = Template.bind({})`). A function export is simply treated as `render`. Cheap to support, and it covers a large share of real-world repos.
  **Deliberately not supported:**

- `storiesOf` (CSF1), `storyStoreV7` internals, `.mdx` story files.
- Arbitrary addon `parameters` — unknown namespaces are **ignored, never an error**, so a file can stay valid in both tools during a migration.
- `argTypes` beyond control type + options + description. No custom control renderers in v1.
  **Our extension: `parameters.snapshot`**

```ts
parameters: {
  snapshot: {
    disable?: boolean;
    viewports?: number[];          // widths, default from config
    threshold?: number;            // 0–1, default 0.01
    delay?: number;                // ms, escape hatch
    waitFor?: string;              // CSS selector
    modes?: string[];              // e.g. ['light', 'dark']
  }
}
```

Namespacing under `parameters` is what makes stories bidirectional: Storybook ignores `snapshot`, we ignore `chromatic`. Teams can run both during a trial period, which is how migrations actually get approved.

**Stability contract:** the fields above are frozen for the v1 major. Additions are optional-only. Anything that would break a story file requires a major and a codemod that is tested against the top open-source design systems.

## 6. Architecture

```
packages/
  core        story discovery, config, virtual index module, Vite plugin
  react       renderer, Meta/StoryObj types, public entry
  ui          workshop client (sidebar, canvas, args panel)
  cli         dev | build | snapshot | approve
  capture     Playwright runner, determinism harness
  server      review API + web UI (Fastify, Postgres, S3)
  codemods    storybook → snapcheck import rewrites
```

**Dev loop.** `snapcheck dev` starts a Vite server. Stories are discovered by glob and exposed as a virtual module; Vite owns HMR, and story modules are hot-accepted so component edits preserve args and canvas state. No custom HMR layer — that is where Storybook's chronic HMR bugs come from.

**Build.** `snapcheck build` emits a static SPA plus `index.json`: every story ID, title, tags, and resolved snapshot parameters. This manifest is the contract between the workshop and everything downstream. The workshop build is deployable to any static host on its own.

**Configuration.** One `snapcheck.config.ts` at the repository root, typed via `defineConfig`. No per-package config files, no inheritance, no cascade — in a monorepo the root config carries package globs and stories are namespaced by the package they came from:

```ts
export default defineConfig({
  stories: ['packages/*/src/**/*.stories.tsx'],
  snapshot: { viewports: [375, 1280], threshold: 0.01 },
});
```

This is the right shape for a visual-testing-first product: one story index, one snapshot run, one baseline set, one CI check per commit, regardless of how many packages the change touched. Per-package config would fragment all four. Where a single package genuinely needs different defaults, that is expressed as an override keyed by glob inside the root file, not as a second file.

**Isolation route.** Each story renders standalone at `/frame?id=<storyId>&mode=<mode>` with no chrome. Capture uses this route; the workshop UI iframes it. One rendering path, so what you review is what you saw.

## 7. Visual regression

**Capture.** `snapshot` reads an `index.json` — ours, or the one Storybook already emits in its static build — launches Playwright against the built output, and navigates to the isolation route per story. Storybook's `/iframe.html?id=<storyId>` is the equivalent of our frame route, so the same runner covers both without a compatibility layer. Determinism is enforced by the harness, not by user-supplied `delay`:

- `prefers-reduced-motion: reduce` plus injected CSS that zeroes animation/transition durations and pins them to their final state.
- Await `document.fonts.ready` and network idle; fonts baked into a pinned capture image so CI and local match.
- Fixed device scale factor and viewport; caret and scrollbars hidden.
- Optional per-story `waitFor` selector as the escape hatch; `delay` documented as a last resort.
  **Baselines.** Content-addressed PNGs in object storage, keyed by `storyId + mode + viewport`. Never committed to Git — that avoids BackstopJS's merge conflicts and review-by-PNG. Baseline resolution walks first-parent Git history from the current commit to the most recent commit on the base branch with an approved build.

**Diff.** Per-story threshold with antialiasing tolerance. Identical diffs across stories are grouped so a token change is one review decision, not two hundred.

**Review.** Web UI listing builds and changed stories, with side-by-side / onion-skin / diff toggle, approve/reject per story, and bulk approve per group. Approval is recorded against the commit.

**CI contract.** `snapcheck snapshot --server <url> --token <token>` exits non-zero when a build has unapproved changes. Optional commit status posted to GitHub/GitLab/Bitbucket, including self-hosted instances — the case Chromatic gates behind Enterprise.

## 8. Self-hosting

One `docker-compose.yml`: `server`, `postgres`, `minio`. Filesystem storage supported for single-node setups so MinIO is optional. No outbound network calls, no telemetry, no license server — it must run air-gapped in a regulated environment. Retention (drop blobs older than N days, keep approved baselines) is a config value, because storage is the only thing that grows.

## 9. Milestones

Ordered so that the sellable product comes first and the workshop comes later. Everything before M2 works against a **plain Storybook static build** — we read Storybook's own `index.json`, so no story changes, no workshop, no migration required to become a customer.

|        | Scope                                                                                                 | Done when                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **M0** | Capture + local diff, no server required. Consumes a Storybook (or Ladle) static build.               | `snapshot` produces identical results across 10 consecutive CI runs on a real design system |
| **M1** | Review server: Git-history baselines, approve/reject UI, CI status checks, `docker compose` self-host | A team can replace Chromatic in their pipeline without touching a story file                |
| **M2** | Migration guides (Chromatic, Lost Pixel) + docs site + pricing/licensing page                         | First external team running it in CI                                                        |
| **M3** | Workshop: dev server, story index, canvas, sidebar, args panel, Next.js adapter                       | Cold start <2s and HMR <100ms on a 300-story fixture, on both a Vite and a Next project     |
| **M4** | Native CSF support, static build, our own `index.json`, codemod                                       | A real open-source design system's stories run with only an import rewrite                  |

**Why this order.** M0+M1 is a complete product on its own — it is the Chromatic replacement, and it is sellable to teams who intend to keep using Storybook indefinitely. That is a much larger addressable set than teams willing to swap their component workshop. It also inverts the migration risk: adopting us costs a CI step, not a rewrite.

The consequence is that the workshop (M3/M4) has to justify itself later, against a userbase that already has the visual testing working. That is the right way round — if the workshop never ships, M0–M2 is still a business, whereas a workshop with no visual testing is just a slower Ladle.

Note that M0 alone (local diff, no server) is roughly BackstopJS-tier and hard to charge for. The review workflow in M1 is where the value is; plan to release them close together.

## 10. Open questions

1. **Decorators — deferred to M3, preference stated.** Until we own the renderer, Storybook renders its own decorators and we photograph the result, so nothing before M3 depends on this. The standing preference is **option C below: accept CSF decorators as-is, mark them deprecated, and document the global wrapper as the recommended approach.** Revisit at M3 with evidence from the repos migrated during M0–M2.
2. **Hosted option scope.** Revenue is a hosted service plus paid enterprise integrations (SSO, audit logs, self-hosted Git providers, support SLA). Undecided: whether the hosted option launches alongside M1 or after, and whether enterprise integrations live in the MIT repo or a separate closed one. Note that MIT means a competitor can offer the hosted version too, so time-to-market matters more here than it would under a copyleft server.

### The decorator options

**A. Full CSF decorators.** Arbitrary functions at global, component, and story level, composing outward, receiving story context. Maximum migration compatibility — nearly every Storybook repo runs unchanged. The cost is that arbitrary user code runs on every render, which is a leading cause of the "passes locally, flakes in CI" reports in the research: decorators that fetch, start timers, mount portals, or remount on args change.

**B. Global provider wrapper only.** One component, declared once in the root config, wrapped around every story:

```ts
// snapcheck.config.ts
export default defineConfig({
  wrapper: './src/snapcheck/wrapper.tsx',
});
```

```tsx
// wrapper.tsx
export default function Wrapper({ children, mode }: WrapperProps) {
  return (
    <ThemeProvider theme={mode === 'dark' ? dark : light}>
      <IntlProvider locale="en">{children}</IntlProvider>
    </ThemeProvider>
  );
}
```

It is a plain React component, not a decorator API — type-checked, testable, and obvious to anyone reading the repo. It receives `mode`, which is what makes `parameters.snapshot.modes: ['light', 'dark']` work without per-story wiring.

The determinism win is structural: one wrapper, statically resolved, so we can mount it once and keep it alive across stories instead of tearing down and rebuilding providers per story. That is faster and removes a whole class of setup-timing flake. It also gives a single file to audit for the rule that matters most — no network, no timers, no randomness in the wrapper.

In practice this covers most of what global decorators are actually used for: theme, i18n, router, query client, CSS reset, font loading.

Where it falls short is per-story needs that genuinely exist: this story must sit at a specific route, that one needs a mocked provider value, this one needs a fixed-width container or RTL direction. Under B those move into the story's own `render`, which is more verbose but explicit and local.

**C. Support as-is, deprecate, recommend the wrapper.** ← standing preference

Decorators work at all three levels with Storybook's composition order preserved (story → meta → wrapper outermost), so migrated stories render identically. They are simultaneously marked deprecated: the docs teach the wrapper, `render` is the per-story escape hatch, and decorators appear only in the migration guide.

What "deprecated" means concretely matters more than the label:

- **Deprecated is not removal.** §5 freezes the story format for the v1 major, and that covers decorators. Removal would require a new major plus a codemod, and the codemod is only mechanical for simple wrapping decorators — ones that read story context are a manual rewrite. Decide at the point of a v2, not before.
- **No runtime nagging.** No console warnings on every render and nothing written to CI logs. A deprecation that makes a working build noisy trains people to ignore our output, which is the opposite of what a testing tool needs.
- **Surface it where it is actionable:** JSDoc `@deprecated` on the type so it strikes through in the editor, one line in the migration guide, and optionally a lint rule users opt into.
  The reason to support rather than restrict is the same reason we kept CSF: breaking on a decorator is a migration that fails at the door, and migrations that don't fail at the door are the entire acquisition story. The reason to deprecate anyway is that every decorator is arbitrary code on the render path, and this product's core claim is low flake.

One honest tension: shipping a feature already marked deprecated is odd, and if the wrapper turns out not to cover real cases, the deprecation quietly becomes permanent — decorators stay forever, just with worse docs. The test at M3 is whether migrated repos' decorators actually collapse into a wrapper plus a few `render` calls. If a large share genuinely need per-story context, drop the deprecation instead of carrying it indefinitely.

## 11. Decided

- **Name:** `snapcheck`. Free on npm in both plain and hyphenated form, so the similarity rule won't block publishing. Grab the GitHub org and domain before first publish.
- **License:** MIT across every package and the server. Competitors may deploy rival services on this code; that is accepted.
- **Story format:** strict CSF3 subset, plus `parameters.snapshot`. No new format.
- **Milestone order:** visual testing first, workshop later.
- **Browsers:** Chromium in M0, others sequenced after the review workflow.
- **Next.js:** adapter lands with the workshop at M3. Before that it is irrelevant — capture works against any built Storybook regardless of what built it.
- **Interaction testing:** `play` functions are deferred past v1. Capture renders static story states only.
- **Config:** one root `snapcheck.config.ts`, package globs, no per-package files.
- **Revenue:** hosted option plus paid enterprise integrations. Core stays MIT and fully self-hostable.
- **Decorators:** deferred to M3; preference is support-as-is plus deprecation in favour of the global wrapper. Independent of that choice, decorators must be synchronous and pure-render — async work, data fetching, and timers inside a decorator are documented as unsupported rather than left to half-work, since that is exactly where the flake reports in the research originate.
