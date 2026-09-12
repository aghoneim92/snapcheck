import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconButton } from './IconButton';
import { EllipsisIcon, SearchIcon } from './Icons';

const meta = {
  title: 'Controls/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  args: { 'aria-label': 'More actions', icon: <EllipsisIcon /> },
  argTypes: { icon: { control: false } },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Search: Story = {
  args: { 'aria-label': 'Search', icon: <SearchIcon /> },
};

export const Disabled: Story = { args: { disabled: true } };
