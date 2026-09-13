import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface FieldProps {
  /** Mono label above the control. Rendered uppercase by the caller's copy. */
  label?: ReactNode;
  htmlFor?: string;
  /** Helper text below the control; turns red when `invalid` is set. */
  hint?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Label + control + hint, stacked. Every input in the system uses this so the
 * mono-label-over-Manrope-value rhythm stays identical across forms.
 */
export function Field({
  label,
  htmlFor,
  hint,
  invalid = false,
  disabled = false,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className={cn(
            'font-mono text-mono',
            invalid ? 'text-fail-ink' : disabled ? 'text-disabled-ink' : 'text-label',
          )}
        >
          {label}
        </label>
      )}
      {children}
      {hint && (
        <div
          className={cn(
            'text-small leading-5',
            invalid ? 'text-fail-ink' : disabled ? 'text-label' : 'text-sec',
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/** Shared control skin: white field on paper, so entry points stay obvious. */
export const controlSkin = cn(
  'w-full rounded-control border border-border-strong bg-surface text-ink outline-none',
  'transition-colors duration-[110ms] ease-out motion-reduce:transition-none',
  'hover:border-border-hover',
  'focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent',
  'disabled:cursor-not-allowed disabled:border-dashed disabled:border-border-soft',
  'disabled:bg-disabled-bg-2 disabled:text-border-hover',
);

/** Inset red rail + red border for the invalid state. */
export const invalidSkin = cn(
  'border-fail shadow-[inset_3px_0_0_var(--sc-fail)]',
  'hover:border-fail focus:border-fail focus:outline-fail',
);
