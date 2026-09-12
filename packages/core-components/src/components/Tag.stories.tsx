import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tag } from './Tag';

const meta = {
  title: 'Content/Tag',
  component: Tag,
  tags: ['autodocs'],
  args: { children: 'PASS', tone: 'pass' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['pass', 'review', 'fail', 'running', 'neutral'] },
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pass: Story = {};
export const Review: Story = { args: { tone: 'review', children: 'REVIEW' } };
export const Fail: Story = { args: { tone: 'fail', children: 'FAIL' } };
export const Running: Story = { args: { tone: 'running', children: 'RUNNING' } };
export const Neutral: Story = { args: { tone: 'neutral', children: 'MAIN' } };
export const CommitSha: Story = { args: { tone: 'neutral', dense: true, children: 'A1F09C4' } };

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[7px]">
      <Tag tone="pass">PASS</Tag>
      <Tag tone="review">REVIEW</Tag>
      <Tag tone="fail">FAIL</Tag>
      <Tag tone="running">RUNNING</Tag>
      <Tag tone="neutral">MAIN</Tag>
      <Tag tone="neutral" dense>
        A1F09C4
      </Tag>
    </div>
  ),
};
