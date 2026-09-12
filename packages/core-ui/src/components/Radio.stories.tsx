import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Radio, RadioGroup } from './Radio';

const meta = {
  title: 'Forms/RadioGroup',
  component: RadioGroup,
  subcomponents: { Radio: Radio as never },
  tags: ['autodocs'],
  args: { 'aria-label': 'Review scope', children: null },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [scope, setScope] = useState('all');
    return (
      <RadioGroup {...args} value={scope} onValueChange={setScope}>
        <Radio value="all" label="All changes" />
        <Radio value="visual" label="Only visual changes" />
      </RadioGroup>
    );
  },
};

export const WithDisabledOption: Story = {
  render: (args) => {
    const [scope, setScope] = useState('all');
    return (
      <RadioGroup {...args} value={scope} onValueChange={setScope}>
        <Radio value="all" label="All changes" />
        <Radio value="visual" label="Only visual changes" />
        <Radio value="a11y" label="Accessibility only" disabled />
      </RadioGroup>
    );
  },
};
