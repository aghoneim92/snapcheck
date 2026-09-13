import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: the control shows no text, so it needs its own name. */
  'aria-label': string;
  icon: ReactNode;
}

/** 40px square control for toolbar actions that carry a glyph and no label. */
export function IconButton({ icon, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'size-control-md inline-flex flex-none items-center justify-center',
        'rounded-control border border-border-strong bg-transparent text-ink',
        'cursor-pointer transition-colors duration-[110ms] ease-out motion-reduce:transition-none',
        'hover:border-ink hover:bg-ink hover:text-paper',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:border-disabled-border disabled:text-disabled-ink',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
