import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'outline' | 'quiet' | 'destructive' | 'approve';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold ' +
  'tracking-[-0.01em] cursor-pointer transition-colors duration-[110ms] ease-out ' +
  'disabled:cursor-not-allowed disabled:pointer-events-none';

const variants: Record<ButtonVariant, string> = {
  primary: cn(
    'rounded-control border border-accent bg-accent text-on-accent',
    'hover:border-accent-hover hover:bg-accent-hover',
    'active:border-accent-press active:bg-accent-press',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    'disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-disabled-ink',
  ),
  outline: cn(
    'rounded-control border border-ink bg-transparent text-ink',
    'hover:bg-ink hover:text-paper active:bg-ink active:text-paper',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:border-disabled-border disabled:bg-transparent disabled:text-disabled-ink',
  ),
  quiet: cn(
    'rounded-none border-0 border-b-2 border-border-strong bg-transparent text-ink',
    'hover:border-accent hover:text-accent-text-hover',
    'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent',
    'disabled:border-disabled-bg disabled:text-disabled-ink',
  ),
  destructive: cn(
    'rounded-control border border-fail bg-transparent text-fail-ink',
    'hover:bg-fail hover:text-on-accent active:bg-fail-press active:text-on-accent',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    'disabled:border-fail-dis-border disabled:bg-transparent disabled:text-fail-dis-ink',
  ),
  approve: cn(
    'rounded-control border border-pass bg-pass text-on-pass',
    'hover:border-pass-hover hover:bg-pass-hover hover:text-on-accent',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    'disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-disabled-ink',
  ),
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-3 text-[13px]',
  md: 'h-control-md px-[18px] text-small',
  lg: 'h-control-lg px-[26px] text-base tracking-[-0.015em]',
};

/** `quiet` is a rule, not a box — it keeps its own tight padding at every size. */
const quietSizes: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-1 text-[13px]',
  md: 'h-control-md px-1 text-small',
  lg: 'h-control-lg px-1 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Glyph rendered before the label. Sized by the caller; 16px is standard. */
  icon?: ReactNode;
  /** Swap the icon for a spinner and block interaction. */
  loading?: boolean;
}

/**
 * The system's action control. One `primary` per view — graphite `outline`
 * carries everything else, and `approve` (pine) is reserved for approving a
 * build.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const leading = loading ? <Spinner /> : icon;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        variants[variant],
        variant === 'quiet' ? quietSizes[size] : sizes[size],
        leading && variant !== 'quiet' && 'pl-[13px]',
        className,
      )}
      {...props}
    >
      {leading}
      {children}
    </button>
  );
}
