import type { Meta, StoryObj } from '@storybook/react-vite';

import { CodeBlock, CodeFlag, CodePrompt } from './Code';

const meta = {
  title: 'Content/CodeBlock',
  component: CodeBlock,
  tags: ['autodocs'],
  args: {
    children: (
      <>
        <CodePrompt /> npx snapcheck run <CodeFlag>--base main</CodeFlag>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShellCommand: Story = {};

export const MultiLine: Story = {
  args: {
    children: (
      <>
        {'snapcheck.config.ts\n'}
        {'  baseline: '}
        <CodeFlag>"main"</CodeFlag>
        {'\n  viewports: '}
        <CodeFlag>[375, 1280]</CodeFlag>
      </>
    ),
  },
};
