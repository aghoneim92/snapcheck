import type { Meta, StoryObj } from '@storybook/react-vite';

import { LogoMark, Wordmark } from './Logo';

const meta = {
  title: 'Content/Logo',
  component: Wordmark,
  subcomponents: { LogoMark: LogoMark as never },
  tags: ['autodocs'],
} satisfies Meta<typeof Wordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};

export const TypeOnly: Story = { args: { markless: true } };

export const MarkSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <LogoMark size={24} />
      <LogoMark size={34} />
      <LogoMark size={56} />
    </div>
  ),
};
