import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Switch } from './Switch';

const meta = {
  title: 'Forms/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: {
    label: 'Notify on failed builds',
    checked: true,
    onCheckedChange: () => undefined,
  },
  argTypes: { onCheckedChange: { control: false } },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {
  render: (args) => {
    const [checked, setChecked] = useState(args.checked);
    return <Switch {...args} checked={checked} onCheckedChange={setChecked} />;
  },
};

export const Off: Story = {
  args: { checked: false },
  render: (args) => {
    const [checked, setChecked] = useState(args.checked);
    return <Switch {...args} checked={checked} onCheckedChange={setChecked} />;
  },
};

export const Disabled: Story = { args: { disabled: true } };
