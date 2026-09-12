import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export type TagTone = 'pass' | 'review' | 'fail' | 'running' | 'neutral';

const tones: Record<TagTone, string> = {
  pass: 'bg-slab text-pass-bright',
  review: 'bg-amber text-on-accent',
  fail: 'bg-fail text-on-accent',
  running: 'bg-info text-on-accent',
  neutral: 'border border-border-strong text-body',
};

export interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  /**
   * Tighten tracking for dense machine strings like commit SHAs.
   */
  dense?: boolean;
  className?: string;
}

/** Mono, square, 24px tall. Tags read as data, not decoration. */
export function Tag({ children, tone = 'neutral', dense = false, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-chip px-2 font-mono text-mono',
        dense && 'tracking-[-0.03em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
