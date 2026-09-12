import type { ReactNode } from 'react';

import { Button, type ButtonVariant } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { CheckIcon, EllipsisIcon } from '../../components/Icons';
import { SpecLabel, SpecSection } from '../../components/SpecSection';
import { StatusPill } from '../../components/StatusPill';
import { cn } from '../../lib/cn';

const columns = ['LIVE', 'HOVER', 'FOCUS', 'DISABLED'] as const;

interface Row {
  name: string;
  variant: ButtonVariant;
  label: string;
  /**
   * Classes that force the hover and focus appearance. The spec sheet has to
   * show all four states at once, which a real pointer cannot do — so the
   * middle two columns are frozen renders of the same component.
   */
  hover: string;
  focus: string;
}

const rows: Row[] = [
  {
    name: 'Primary',
    variant: 'primary',
    label: 'Review changes',
    hover: 'border-accent-hover bg-accent-hover',
    focus: 'outline-2 outline-offset-2 outline-ink',
  },
  {
    name: 'Outline',
    variant: 'outline',
    label: 'View build',
    hover: 'bg-ink text-paper',
    focus: 'outline-2 outline-offset-2 outline-accent',
  },
  {
    name: 'Quiet',
    variant: 'quiet',
    label: 'View details',
    hover: 'border-accent text-accent-hover',
    focus: 'outline-2 outline-offset-[3px] outline-accent',
  },
  {
    name: 'Destructive',
    variant: 'destructive',
    label: 'Delete build',
    hover: 'bg-fail text-on-accent',
    focus: 'outline-2 outline-offset-2 outline-ink',
  },
];

function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[104px_repeat(4,1fr)] items-center gap-4', className)}>
      {children}
    </div>
  );
}

export function ButtonSection() {
  return (
    <SpecSection
      id="buttons"
      index="04"
      title="Buttons"
      description="40px tall, 6px radius, 700 weight. One blue button per view; graphite carries the rest."
    >
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <Grid className="border-b border-ink pb-2.5">
            <div />
            {columns.map((column) => (
              <div key={column} className="font-mono text-mono-xs text-label">
                {column}
              </div>
            ))}
          </Grid>

          {rows.map((row, index) => (
            <Grid
              key={row.name}
              className={cn('py-[18px]', index < rows.length - 1 && 'border-b border-rule-soft')}
            >
              <div className="text-small font-semibold text-ink">{row.name}</div>
              <Button variant={row.variant} className="justify-self-start">
                {row.label}
              </Button>
              <Button
                variant={row.variant}
                tabIndex={-1}
                className={cn('pointer-events-none justify-self-start', row.hover)}
              >
                {row.label}
              </Button>
              <Button
                variant={row.variant}
                tabIndex={-1}
                className={cn('pointer-events-none justify-self-start', row.focus)}
              >
                {row.label}
              </Button>
              <Button variant={row.variant} disabled className="justify-self-start">
                {row.label}
              </Button>
            </Grid>
          ))}
        </div>
      </div>

      <div className="mt-[30px] flex flex-wrap gap-8 border-t border-rule pt-[26px]">
        <div className="flex-[1_1_240px]">
          <SpecLabel>SIZES / 32 · 40 · 52</SpecLabel>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Start reviewing</Button>
          </div>
          <p className="mt-3.5 text-small text-sec">
            52 is the landing-page size. 32 is for app toolbars only.
          </p>
        </div>

        <div className="flex-[1_1_240px]">
          <SpecLabel>ICON / SQUARE / WORKING</SpecLabel>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="approve" icon={<CheckIcon />}>
              Approve
            </Button>
            <IconButton aria-label="More actions" icon={<EllipsisIcon />} />
            <StatusPill>RUNNING</StatusPill>
          </div>
          <p className="mt-3.5 text-small text-sec">
            Pine is reserved for the approve action and pass states.
          </p>
        </div>
      </div>
    </SpecSection>
  );
}
