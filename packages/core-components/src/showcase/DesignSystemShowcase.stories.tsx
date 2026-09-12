import type { Meta, StoryObj } from '@storybook/react-vite';

import { DesignSystemShowcase } from './DesignSystemShowcase';

const meta = {
  title: 'Design system/Core spec sheet',
  component: DesignSystemShowcase,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The entire system on one page — colour, type, grid, buttons, inputs and small ' +
          'parts. Every specimen is the real exported component, so this page breaks the ' +
          'moment a primitive drifts from the spec.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="-m-6 min-h-screen bg-paper">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DesignSystemShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Without the CSS custom property printed under each swatch. */
export const WithoutTokenNames: Story = { args: { showTokens: false } };
