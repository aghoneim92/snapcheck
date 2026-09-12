import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface SpecSectionProps {
  /** Two-digit index shown in accent mono, e.g. `01`. */
  index: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  /** Close with the heavy 3px ink rule instead of a hairline. */
  last?: boolean;
  className?: string;
  /** Extra classes on the right-hand specimen column. */
  contentClassName?: string;
  id?: string;
}

/**
 * The spec-sheet row: a narrow captioned column on the left, specimens on the
 * right, closed by a rule. Wraps to a single column under ~590px.
 */
export function SpecSection({
  index,
  title,
  description,
  children,
  last = false,
  className,
  contentClassName,
  id,
}: SpecSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'flex flex-wrap gap-x-10 gap-y-6 py-11',
        last ? 'border-b-[3px] border-ink' : 'border-b border-rule',
        className,
      )}
    >
      <div className="max-w-[190px] flex-[1_1_150px]">
        <div className="mb-3 font-mono text-[11px] tracking-[-0.02em] text-accent-text">
          {index}
        </div>
        <h2 className="mb-2 text-h3 font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="text-small text-sec">{description}</p>
      </div>
      <div className={cn('min-w-0 flex-[1_1_440px]', contentClassName)}>{children}</div>
    </section>
  );
}

export interface SpecLabelProps {
  children: ReactNode;
  /** Draw the hairline under the label that separates it from its specimens. */
  ruled?: boolean;
  className?: string;
}

/** Uppercase mono caption used above every specimen cluster. */
export function SpecLabel({ children, ruled = false, className }: SpecLabelProps) {
  return (
    <div
      className={cn(
        'font-mono text-mono text-label',
        ruled ? 'mb-4 border-b border-rule pb-3' : 'mb-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The ink rule + blue/pine/neutral ratio bar that opens the sheet. */
export function BrandRule({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="h-[3px] bg-ink" />
      <div className="flex h-[9px]">
        <div className="flex-[7] bg-accent" />
        <div className="flex-[2] bg-pass" />
        <div className="flex-[1] bg-surface-2" />
      </div>
    </div>
  );
}
