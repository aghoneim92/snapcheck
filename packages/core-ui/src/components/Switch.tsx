import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Square switch — chip radius, not a pill, so it reads as part of the same
 * family as tags and checkboxes. Switches apply immediately; there is no save.
 */
export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  const labelId = useId();

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'flex h-[22px] w-11 flex-none items-center rounded-chip p-0.5',
          'cursor-pointer transition-colors duration-[110ms] ease-out',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-60',
          checked ? 'justify-end bg-ink' : 'justify-start border border-border-strong bg-surface',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'size-[18px] rounded-[2px]',
            checked ? 'bg-pass-bright' : 'bg-border-strong',
          )}
        />
      </button>
      <span
        id={labelId}
        className={cn('text-base select-none', disabled ? 'text-disabled-ink' : 'text-ink')}
      >
        {label}
      </span>
    </div>
  );
}
