import { cn } from '../lib/cn';

export interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * The mark: a browser chrome holding a picture, with a check struck through it.
 * Fixed brand colors — it sits on a paper plaque in dark mode rather than
 * recoloring.
 */
export function LogoMark({ size = 34, className }: LogoMarkProps) {
  return (
    <span className={cn('inline-flex rounded-[5px] bg-logo-plaque p-1', className)}>
      <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect x="1.6" y="3.6" width="26" height="22" rx="4.4" stroke="#0F172A" strokeWidth="3.2" />
        <rect x="1.6" y="3.6" width="26" height="6" fill="#0F172A" />
        <circle cx="6" cy="6.6" r="1.1" fill="#FFFFFF" />
        <circle cx="9.6" cy="6.6" r="1.1" fill="#FFFFFF" />
        <circle cx="13.2" cy="6.6" r="1.1" fill="#FFFFFF" />
        <circle cx="10.4" cy="15" r="2.4" fill="#CBD5E1" />
        <path d="M6.2 22.2 L12.4 15.4 L17.6 22.2 Z" fill="#CBD5E1" />
        <path
          d="M17.4 20.4 L23 26.6 L32.4 13.6"
          stroke="#10B981"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export interface WordmarkProps {
  className?: string;
  /** Hide the mark and show type only. */
  markless?: boolean;
}

export function Wordmark({ className, markless = false }: WordmarkProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {!markless && <LogoMark />}
      <div className="text-[27px] font-extrabold tracking-[-0.03em] text-ink">
        Snap<span className="text-accent">check</span>
      </div>
    </div>
  );
}
