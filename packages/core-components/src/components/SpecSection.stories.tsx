import type { Meta, StoryObj } from '@storybook/react-vite';

import { BrandRule, SpecLabel, SpecSection } from './SpecSection';
import { Tag } from './Tag';

const meta = {
  title: 'Layout/SpecSection',
  component: SpecSection,
  subcomponents: { SpecLabel: SpecLabel as never, BrandRule: BrandRule as never },
  tags: ['autodocs'],
  args: {
    index: '01',
    title: 'Color',
    description: 'Warm paper, graphite ink, two brand hues. Blue acts, pine confirms.',
  },
} satisfies Meta<typeof SpecSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <SpecLabel ruled>SPECIMENS</SpecLabel>
        <div className="flex flex-wrap gap-[7px]">
          <Tag tone="pass">PASS</Tag>
          <Tag tone="fail">FAIL</Tag>
        </div>
      </>
    ),
  },
};

export const LastSection: Story = {
  args: {
    index: '06',
    title: 'Small parts',
    last: true,
    children: <p className="text-small text-sec">Closed by the heavy 3px ink rule.</p>,
  },
};

export const Brand: Story = {
  args: { children: null },
  render: () => <BrandRule />,
};
