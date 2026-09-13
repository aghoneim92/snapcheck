import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { controlSkin, Field, invalidSkin } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
  /** Glyph pinned inside the left edge, e.g. the search magnifier. */
  leadingIcon?: ReactNode;
  /** Slot pinned inside the right edge, e.g. a `<Kbd>` shortcut hint. */
  trailing?: ReactNode;
  /** Render the value in Martian Mono. For keys, hashes and branch names. */
  mono?: boolean;
}

export function Input({
  label,
  hint,
  invalid = false,
  leadingIcon,
  trailing,
  mono = false,
  className,
  id,
  disabled,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const field = (
    <input
      id={inputId}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn(
        controlSkin,
        'h-control-md px-3 text-base',
        mono ? 'font-mono text-[11px] tracking-[-0.03em]' : '',
        leadingIcon && 'pl-9',
        trailing && 'pr-11',
        invalid && invalidSkin,
        className,
      )}
      {...props}
    />
  );

  return (
    <Field label={label} htmlFor={inputId} hint={hint} invalid={invalid} disabled={disabled}>
      {leadingIcon || trailing ? (
        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute top-3 left-3 text-label">
              {leadingIcon}
            </span>
          )}
          {field}
          {trailing && (
            <span className="absolute top-2 right-2.25 flex items-center justify-center">
              {trailing}
            </span>
          )}
        </div>
      ) : (
        field
      )}
    </Field>
  );
}

/** Keycap for inline shortcut hints. Square-ish, chip radius, mono. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'rounded-chip border border-rule bg-paper px-1.75 py-0.75',
        'font-mono text-mono text-body',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
