import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

export interface StatusPillProps {
  children: ReactNode;
  /** Show the spinner. Off by default so the pill can report settled states. */
  busy?: boolean;
  className?: string;
}

/**
 * Read-only counterpart to a button: same 40px height and border, mono label,
 * no affordance. Used for "RUNNING" and other machine states.
 */
export function StatusPill({ children, busy = true, className }: StatusPillProps) {
  return (
    <div
      className={cn(
        'inline-flex h-control-md items-center gap-2.5 rounded-control px-4',
        'border border-border-strong font-mono text-mono text-body',
        className,
      )}
    >
      {busy && <Spinner />}
      {children}
    </div>
  );
}
