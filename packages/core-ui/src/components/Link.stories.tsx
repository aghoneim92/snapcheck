import type { Meta, StoryObj } from '@storybook/react-vite';

import { Link } from './Link';

const meta = {
  title: 'Content/Link',
  component: Link,
  tags: ['autodocs'],
  args: { href: '#', children: 'Inline text link' },
  argTypes: { variant: { control: 'inline-radio', options: ['inline', 'action', 'mono'] } },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const Action: Story = { args: { variant: 'action', children: 'Open in review' } };

export const Mono: Story = { args: { variant: 'mono', children: 'DOCS / SELF-HOSTING' } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3.5 text-[16px] leading-6">
      <Link href="#">Inline text link</Link>
      <Link href="#" variant="action">
        Open in review
      </Link>
      <Link href="#" variant="mono">
        DOCS / SELF-HOSTING
      </Link>
    </div>
  ),
};
