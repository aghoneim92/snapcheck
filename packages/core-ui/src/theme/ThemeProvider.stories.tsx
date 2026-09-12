import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../components/Button';
import { Tag } from '../components/Tag';
import { ThemeToggle } from '../components/ThemeToggle';
import { ThemeProvider, useTheme } from './ThemeProvider';

const meta = {
  title: 'Foundations/Theme',
  component: ThemeProvider,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Theming is one attribute: `data-theme="dark"` on the document element. ' +
          'Every token flips, no class rewriting and no second stylesheet.',
      },
    },
  },
} satisfies Meta<typeof ThemeProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

function ThemeReadout() {
  const { theme } = useTheme();
  return (
    <div className="flex flex-wrap items-center gap-4 bg-paper p-6">
      <ThemeToggle />
      <Tag tone="neutral">{theme.toUpperCase()}</Tag>
      <Button>Review changes</Button>
      <Button variant="outline">View build</Button>
    </div>
  );
}

/** The toolbar theme picker drives the decorator; this toggle drives the page. */
export const Toggle: Story = {
  args: { children: null },
  render: () => <ThemeReadout />,
};
