import type { Meta, StoryObj } from '@storybook/react-vite';

import { SearchIcon } from './Icons';
import { Input, Kbd } from './Input';

const meta = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  args: { label: 'PROJECT NAME', placeholder: 'web-app' },
  argTypes: { leadingIcon: { control: false }, trailing: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[320px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { hint: 'Appears in build URLs. Lowercase, no spaces.' },
};

export const Search: Story = {
  args: {
    label: 'SEARCH',
    type: 'search',
    placeholder: 'Search components…',
    leadingIcon: <SearchIcon />,
    trailing: <Kbd>/</Kbd>,
    hint: 'Slash focuses search anywhere.',
  },
};

export const Invalid: Story = {
  args: {
    label: 'BASELINE BRANCH',
    defaultValue: 'man',
    invalid: true,
    hint: 'No branch named “man”. Did you mean main?',
  },
};

export const Locked: Story = {
  args: {
    label: 'SNAPSHOT KEY / LOCKED',
    defaultValue: 'snap_live_••••••••',
    disabled: true,
    mono: true,
    hint: 'Read-only. Rotate from the CLI.',
  },
};
