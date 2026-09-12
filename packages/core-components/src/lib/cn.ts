import { createCn } from 'cn/config';

/**
 * Class merger for the design system.
 *
 * `cn` (shadcn's engine) replaces the clsx + tailwind-merge pair with one
 * dependency and the same call signature. It needs one piece of local
 * knowledge: our type scale adds names to the `text-*` prefix, which it would
 * otherwise read as colors — so `text-h1 text-ink` would drop one of the two.
 * Registering the scale under `font-size` keeps size and color independent.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'h1', 'h2', 'h3', 'lead', 'small', 'code', 'mono', 'mono-xs'] },
      ],
    },
  },
});

export type { ClassValue } from 'cn';
