import type { Meta, StoryObj } from '@storybook/react-vite';

import { Select } from './Select';

const meta = {
  title: 'Forms/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    label: 'ENVIRONMENT',
    hint: 'Native select, restyled. No custom popover.',
    children: (
      <>
        <option>Production</option>
        <option>Staging</option>
        <option>Preview</option>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[320px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
