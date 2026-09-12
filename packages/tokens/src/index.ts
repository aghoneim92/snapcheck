/**
 * Typed mirror of `tokens.css`, for anything that needs token values in JS —
 * docs tables, the spec-sheet swatch grid, canvas rendering, tests.
 *
 * The CSS file stays the source of truth for *applying* tokens; this file is
 * the source of truth for *talking about* them.
 */

export type ThemeName = 'light' | 'dark';

/** A token that resolves to a different value per theme. */
export interface ThemedColor {
  /** CSS custom property name, e.g. `--sc-ink`. */
  readonly cssVar: string;
  readonly light: string;
  readonly dark: string;
}

const themed = (cssVar: string, light: string, dark: string): ThemedColor => ({
  cssVar,
  light,
  dark,
});

export const colors = {
  paper: themed('--sc-paper', '#F4F1EA', '#151412'),
  surface: themed('--sc-surface', '#FFFFFF', '#1E1C18'),
  surface2: themed('--sc-surface-2', '#E9E6DD', '#242118'),

  ink: themed('--sc-ink', '#14151A', '#F4F1EA'),
  body: themed('--sc-body', '#3C3A36', '#CFC9BC'),
  sec: themed('--sc-sec', '#5A564E', '#ADA69A'),
  label: themed('--sc-label', '#6E6A62', '#9A9387'),

  rule: themed('--sc-rule', '#DCD7CB', '#302C26'),
  ruleSoft: themed('--sc-rule-soft', '#E8E4DA', '#26231F'),
  border: themed('--sc-border', '#C5C0B4', '#45413A'),
  borderSoft: themed('--sc-border-soft', '#CFCAC0', '#38352F'),
  borderHover: themed('--sc-border-hover', '#A19C90', '#6A6559'),

  accent: themed('--sc-accent', '#2B5C8A', '#3B6E9E'),
  accentHover: themed('--sc-accent-hover', '#1F4568', '#4C85B8'),
  accentPress: themed('--sc-accent-press', '#163350', '#2C5880'),

  pass: themed('--sc-pass', '#0E7C66', '#14957A'),
  passBright: themed('--sc-pass-bright', '#34D3A7', '#3FE0B4'),
  amber: themed('--sc-amber', '#A66A05', '#B4790F'),
  fail: themed('--sc-fail', '#A3231A', '#C8442D'),
  info: themed('--sc-info', '#2B5C8A', '#3B6E9E'),
} as const satisfies Record<string, ThemedColor>;

export type ColorToken = keyof typeof colors;

/** The five swatches that lead the spec sheet, in display order. */
export const paletteSwatches = [
  { token: 'ink', name: 'Graphite', alias: '--ink' },
  { token: 'accent', name: 'Slate Blue', alias: '--action' },
  { token: 'pass', name: 'Pine', alias: '--pass' },
  { token: 'paper', name: 'Paper', alias: '--paper' },
  { token: 'rule', name: 'Rule', alias: '--rule' },
] as const satisfies readonly { token: ColorToken; name: string; alias: string }[];

/** 4pt grid. Every gap, pad and offset in the system is one of these. */
export const spacing = [4, 8, 12, 16, 24, 40, 64] as const;

export const radii = {
  surface: 0,
  chip: 3,
  control: 6,
} as const;

export const controlHeights = {
  sm: 32,
  md: 40,
  lg: 52,
} as const;

export interface TypeSpec {
  readonly label: string;
  readonly size: number;
  readonly lineHeight: number;
  readonly weight: number;
  readonly tracking: string;
}

export const typeScale = [
  {
    label: 'DISPLAY / 60·62 / 800 / -0.045EM',
    size: 60,
    lineHeight: 62,
    weight: 800,
    tracking: '-0.045em',
  },
  { label: 'H1 / 38·44 / 800', size: 38, lineHeight: 44, weight: 800, tracking: '-0.035em' },
  { label: 'H2 / 26·34 / 600', size: 26, lineHeight: 34, weight: 600, tracking: '-0.025em' },
  { label: 'BODY / 17·27 / 400', size: 17, lineHeight: 27, weight: 400, tracking: '0' },
  { label: 'SMALL / 14·21 / 400', size: 14, lineHeight: 21, weight: 400, tracking: '0' },
] as const satisfies readonly TypeSpec[];

export const fonts = {
  sans: 'Manrope',
  mono: 'Martian Mono',
} as const;

/** Google Fonts stylesheet the system expects to be loaded. */
export const fontHref =
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;800&family=Martian+Mono:wght@400;500&display=swap';
