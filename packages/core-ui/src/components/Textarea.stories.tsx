import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from './Textarea';

const meta = {
  title: 'Forms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: { label: 'COMMENT', placeholder: 'Add a comment…', hint: 'Markdown supported.' },
  decorators: [
    (Story) => (
      <div className="max-w-[320px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: 'oops', hint: 'Comments cannot be empty.' },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: 'Locked thread.' } };
