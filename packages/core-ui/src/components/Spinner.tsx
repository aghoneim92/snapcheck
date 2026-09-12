import { cn } from '../lib/cn';

export interface SpinnerProps {
  /** Diameter in pixels. Defaults to 12, the size used inside controls. */
  size?: number;
  className?: string;
}

/** Indeterminate progress ring. Borders only — no glow, per the spec sheet. */
export function Spinner({ size = 12, className }: SpinnerProps) {
  return (
    <output
      aria-label="Loading"
      style={{ width: size, height: size }}
      className={cn(
        'inline-block flex-none rounded-full border-2 border-border-strong',
        'animate-sc-spin border-t-accent motion-reduce:animate-none',
        className,
      )}
    />
  );
}
