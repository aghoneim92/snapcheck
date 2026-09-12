import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { CheckIcon } from './Icons';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  label: ReactNode;
}

/**
 * A real `<input type="checkbox">` kept visually hidden behind a drawn box, so
 * focus, form submission and assistive tech all behave natively.
 */
export function Checkbox({ label, className, id, disabled, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex items-center gap-[11px]', className)}>
      <span className="relative flex size-5 flex-none">
        <input
          id={inputId}
          type="checkbox"
          disabled={disabled}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none flex size-5 items-center justify-center rounded-chip',
            'border border-border-strong bg-surface text-transparent',
            'peer-checked:border-ink peer-checked:bg-ink peer-checked:text-pass-bright',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
            'peer-disabled:border-dashed peer-disabled:border-border-soft',
            'peer-disabled:bg-disabled-bg-2 peer-disabled:text-transparent',
          )}
        >
          <CheckIcon size={12} strokeWidth={2.4} />
        </span>
      </span>
      <label
        htmlFor={inputId}
        className={cn(
          'text-base select-none',
          disabled ? 'text-disabled-ink' : 'cursor-pointer text-ink',
        )}
      >
        {label}
      </label>
    </div>
  );
}
