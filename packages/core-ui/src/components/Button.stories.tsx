import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';
import { CheckIcon } from './Icons';

const meta = {
  title: 'Controls/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Review changes' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'outline', 'quiet', 'destructive', 'approve'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    icon: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };

export const Outline: Story = { args: { variant: 'outline', children: 'View build' } };

export const Quiet: Story = { args: { variant: 'quiet', children: 'View details' } };

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete build' },
};

export const Approve: Story = {
  args: { variant: 'approve', children: 'Approve', icon: <CheckIcon /> },
};

export const Sizes: Story = {
  args: { children: 'Start reviewing' },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg" />
    </div>
  ),
};

export const Loading: Story = { args: { loading: true } };

export const Disabled: Story = { args: { disabled: true } };

/** Every variant against every state, as printed on the spec sheet. */
export const AllVariants: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(['primary', 'outline', 'quiet', 'destructive', 'approve'] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2.5">
          <span className="w-24 font-mono text-mono text-label">{variant.toUpperCase()}</span>
          <Button {...args} variant={variant} />
          <Button {...args} variant={variant} disabled />
          <Button {...args} variant={variant} loading />
        </div>
      ))}
    </div>
  ),
};
