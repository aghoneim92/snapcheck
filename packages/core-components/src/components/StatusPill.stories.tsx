import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusPill } from './StatusPill';

const meta = {
  title: 'Controls/StatusPill',
  component: StatusPill,
  tags: ['autodocs'],
  args: { children: 'RUNNING' },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};

export const Settled: Story = { args: { busy: false, children: 'QUEUED' } };
