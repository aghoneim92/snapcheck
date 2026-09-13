import { cn } from '../lib/cn';
import { useTheme } from '../theme/ThemeProvider';

export interface ThemeToggleProps {
  className?: string;
}

/** Mono chip that flips `data-theme`. Names the theme it switches *to*. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'h-[30px] rounded-control border border-border-strong bg-transparent px-[11px]',
        'font-mono text-mono-xs text-ink',
        'cursor-pointer transition-colors duration-[110ms] ease-out motion-reduce:transition-none',
        'hover:border-ink hover:bg-ink hover:text-paper',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
    </button>
  );
}
