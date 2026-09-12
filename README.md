# Snapcheck Core

The primitives shared by the Snapcheck marketing site and the review app,
implemented as React + TypeScript components from the
[Snapcheck Core v2](https://claude.ai/design/p/a64366c3-ae48-4102-b198-ee7a038f4d95)
design file.

## Layout

```
packages/tokens            @snapcheck/tokens            palette, type scale, grid — CSS + typed mirror
packages/core-components   @snapcheck/core-components   the components, with a story each
apps/showcase              @snapcheck/showcase          Vite app rendering the whole spec sheet
```

## Getting started

Node 24 and pnpm 12 are pinned (`.node-version`, `packageManager`):

```sh
fnm use            # reads .node-version
corepack enable    # activates the pinned pnpm
pnpm install
```

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Spec sheet at <http://localhost:5173>         |
| `pnpm storybook` | Component explorer at <http://localhost:6006> |
| `pnpm build`     | Builds every package, then the app            |
| `pnpm check`     | `format:check` + `lint` + `typecheck`         |

## How theming works

One attribute. `data-theme="dark"` on `<html>` swaps every token; no class
rewriting, no second stylesheet, no flash of the wrong palette.

```tsx
import { DesignSystemShowcase, ThemeProvider } from '@snapcheck/core-components';
import '@snapcheck/core-components/styles.css';

<ThemeProvider>
  <DesignSystemShowcase />
</ThemeProvider>;
```

Tokens are declared once in `packages/tokens/src/tokens.css` as `--sc-*` custom
properties, then mapped onto Tailwind's namespace with `@theme inline` so that
utilities emit `var(--sc-…)` rather than a baked-in value. That indirection is
what makes the single-attribute swap possible.

`ThemeProvider` persists the choice to `localStorage`; pass `persist={false}` to
drive it from outside, which is how the Storybook toolbar works.

## Toolchain notes

- **TypeScript 7** (`typescript@^7.0.2`) — the native compiler. Two ecosystem
  packages read compiler-API internals it no longer exposes, so they are not
  used: `vite-plugin-dts` (declarations come from `tsc -p tsconfig.build.json`)
  and `react-docgen-typescript` (Storybook uses the Babel-based `react-docgen`).
- **oxlint + oxfmt** replace ESLint and Prettier. oxfmt also sorts imports and
  Tailwind classes; it reads the v4 stylesheet to do so, which is why
  `sortTailwindcss.stylesheet` points at `packages/core-components/src/styles.css`.
- **`cn`** (shadcn's merge engine) replaces `clsx` + `tailwind-merge`. It is told
  about our type-scale names in `src/lib/cn.ts` — without that it reads
  `text-h1` as a colour and drops one of `text-h1 text-ink`.
- Workspace packages resolve to **source**, not `dist`, so there is no build step
  between editing a component and seeing it. `publishConfig` points at `dist` for
  when these are published.

## Deviations from the design file

Every change below fixes contrast the source palette did not account for, and
has been synced back to `Snapcheck Core v2.dc.html` in the design project.

**Surfaces vs text.** Three tokens were split because one name was doing two jobs:

- **`--sc-slab`** — the code block and `PASS` tag used `--ink` as a _surface_.
  `--ink` is a text token and inverts, so in dark mode both became pale text on
  a pale plate (the code block measured 1.1:1). `--sc-slab` stays dark.
- **`--sc-accent-text`** — accent used as text on paper measured 3.42:1 in dark;
  the text-only variant is `#4C85B8` (4.69:1). Buttons still use `--sc-accent`.
- **`--sc-accent-text-hover`** — the Quiet button reused `--sc-accent-hover` for
  its hover _text_. That had to be split before the fill could change (below),
  or Quiet's dark hover would have dropped to 2.47:1.

**Colour values.**

| Token               | Theme | Was       | Now       | Why                                                         |
| ------------------- | ----- | --------- | --------- | ----------------------------------------------------------- |
| `--sc-accent-hover` | dark  | `#4C85B8` | `#2C5880` | Darken on hover, not lighten: white text went 3.92 → 7.46:1 |
| `--sc-accent-press` | dark  | `#2C5880` | `#234870` | Stays distinct from the new hover                           |
| `--sc-amber`        | light | `#A66A05` | `#A46804` | White `REVIEW` text 4.48 → 4.60:1 (1% darker)               |
| `--sc-amber`        | dark  | `#B4790F` | `#A06B0D` | White `REVIEW` text 3.70 → 4.56:1 (11% darker, visible)     |

Light mode's `--label`, `--border-hover` and `--disabled-border` were also
self-referential in the source (`--label: var(--label)`) and resolved to nothing;
they now have concrete values.

## Accessibility audit

Every story was audited in both themes with axe-core 4.10 against WCAG 2.0,
2.1 and 2.2 A/AA: **124 runs, 0 violations**. Transitions were disabled during
the audit so colours were measured at rest, not mid-animation.

- The textarea reports contrast as "needs review" — axe cannot sample the
  background under the resize grip. Checked by calculation instead: value text
  18.2:1 / 15.1:1, placeholder 5.38:1 / 5.59:1 (light / dark).
- `Layout/SpecSection/Brand` has no applicable rules; it is decorative bars only.
- Automated checks cover roughly a third of WCAG. Keyboard flow and screen-reader
  output have not been tested by hand.
