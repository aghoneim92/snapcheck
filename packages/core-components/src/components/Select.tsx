import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

import { cn } from '../lib/cn';
import { controlSkin, Field, invalidSkin } from './Field';
import { ChevronDownIcon } from './Icons';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
}

/**
 * The native `<select>`, restyled. No custom popover — the platform menu is
 * better on touch, in high contrast, and with a keyboard.
 */
export function Select({
  label,
  hint,
  invalid = false,
  className,
  id,
  children,
  disabled,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={selectId} hint={hint} invalid={invalid} disabled={disabled}>
      <div className="relative">
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            controlSkin,
            'h-control-md appearance-none py-0 pr-9 pl-3 text-base',
            invalid && invalidSkin,
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-3 right-[11px] text-ink" />
      </div>
    </Field>
  );
}
