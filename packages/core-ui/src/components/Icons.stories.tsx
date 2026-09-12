import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  EllipsisIcon,
  icons,
  SearchIcon,
} from './Icons';

const meta = {
  title: 'Foundations/Icons',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** 24px set, 1.7px strokes, round caps — matching the wordmark. */
export const Set: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6 text-ink">
      {Object.entries(icons).map(([name, Glyph]) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Glyph />
          <span className="font-mono text-mono-xs text-label">{name}</span>
        </div>
      ))}
    </div>
  ),
};

/** 16px glyphs that live inside controls. */
export const ControlGlyphs: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6 text-ink">
      <CheckIcon />
      <EllipsisIcon />
      <SearchIcon />
      <ChevronDownIcon />
      <ArrowUpRightIcon />
    </div>
  ),
};
