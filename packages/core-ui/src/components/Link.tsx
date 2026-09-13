import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';
import { ArrowUpRightIcon } from './Icons';

export type LinkVariant = 'inline' | 'action' | 'mono';

const variants: Record<LinkVariant, string> = {
  inline: 'text-accent-text',
  action: 'inline-flex w-fit items-center gap-1.5 font-bold text-accent-text',
  mono: 'font-mono text-mono text-body',
};

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LinkVariant;
  children: ReactNode;
  /** Append the outbound arrow. Implied by `variant="action"`. */
  external?: boolean;
}

export function Link({
  variant = 'inline',
  external,
  className,
  children,
  target,
  rel,
  ...props
}: LinkProps) {
  const showArrow = external ?? variant === 'action';

  return (
    <a
      target={target}
      rel={target === '_blank' ? (rel ?? 'noreferrer noopener') : rel}
      className={cn(
        'transition-colors duration-[110ms] ease-out motion-reduce:transition-none',
        'hover:text-ink hover:underline hover:underline-offset-[3px]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
      {showArrow && <ArrowUpRightIcon />}
    </a>
  );
}
