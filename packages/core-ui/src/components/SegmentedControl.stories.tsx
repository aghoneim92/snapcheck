import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SegmentedControl } from './SegmentedControl';

const diffModes = [
  { value: 'side', label: 'Side by side' },
  { value: 'overlay', label: 'Overlay' },
];

const meta = {
  title: 'Controls/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  args: {
    'aria-label': 'Diff mode',
    options: diffModes,
    value: 'side',
    onValueChange: () => undefined,
  },
  argTypes: { options: { control: false }, onValueChange: { control: false } },
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onValueChange={setValue} />;
  },
};

export const ThreeUp: Story = {
  args: {
    'aria-label': 'Filter',
    value: 'all',
    options: [
      { value: 'all', label: 'All' },
      { value: 'changed', label: 'Changed' },
      { value: 'failed', label: 'Failed' },
    ],
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onValueChange={setValue} />;
  },
};
