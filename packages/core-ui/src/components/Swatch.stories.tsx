import type { Meta, StoryObj } from '@storybook/react-vite';

import { paletteSwatches } from '../tokens';
import { Swatch } from './Swatch';

const meta = {
  title: 'Foundations/Swatch',
  component: Swatch,
  tags: ['autodocs'],
  args: { token: 'accent', name: 'Slate Blue', alias: '--action' },
} satisfies Meta<typeof Swatch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  decorators: [
    (Story) => (
      <div className="w-[140px] border border-rule">
        <Story />
      </div>
    ),
  ],
};

/** The five swatches that lead the spec sheet. */
export const Palette: Story = {
  render: (args) => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-px border border-rule bg-rule">
      {paletteSwatches.map((swatch) => (
        <Swatch
          key={swatch.token}
          token={swatch.token}
          name={swatch.name}
          alias={swatch.alias}
          showToken={args.showToken}
        />
      ))}
    </div>
  ),
};
