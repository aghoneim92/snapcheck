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

Three token changes, all to fix contrast the source palette did not account for.
Light mode is pixel-identical; only dark mode differs.

- **`--sc-slab`** — the code block and `PASS` tag used `--ink` as a _surface_.
  `--ink` is a text token and inverts, so in dark mode both became pale text on
  a pale plate (the code block measured 1.1:1 — effectively invisible).
  `--sc-slab` stays dark in both themes.
- **`--sc-accent-text`** — accent used as text on paper measured 3.42:1 in dark.
  The text-only variant is lightened to `#4C85B8` (5.2:1); buttons still use
  `--sc-accent`.
- Light mode's `--label`, `--border-hover` and `--disabled-border` were
  self-referential in the source (`--label: var(--label)`) and resolved to
  nothing. Concrete values are supplied; `--label` uses the `#6E6A62` the
  design's own caption lists.

Two contrast shortfalls are left as designed, since they are deliberate brand
colours and the text stays legible: the amber `REVIEW` tag (4.48:1 light,
3.69:1 dark) and the primary button's dark-mode hover fill (3.92:1).
