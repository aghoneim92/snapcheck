import { createContext, use, useId, useMemo, type ReactNode } from 'react';

import { cn } from '../lib/cn';

interface RadioGroupContextValue {
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps {
  /** Shared form name. Generated when omitted. */
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function RadioGroup({
  name,
  value,
  onValueChange,
  children,
  className,
  ...props
}: RadioGroupProps) {
  const generatedName = useId();
  const context = useMemo<RadioGroupContextValue>(
    () => ({
      name: name ?? generatedName,
      value,
      onChange: (next) => onValueChange?.(next),
    }),
    [name, generatedName, value, onValueChange],
  );

  return (
    <RadioGroupContext value={context}>
      <div role="radiogroup" className={cn('flex flex-col gap-3.5', className)} {...props}>
        {children}
      </div>
    </RadioGroupContext>
  );
}

export interface RadioProps {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** The selected dot is drawn as a 6px ring, not a nested circle. */
export function Radio({ value, label, disabled, className }: RadioProps) {
  const group = use(RadioGroupContext);
  if (!group) throw new Error('<Radio> must be used inside a <RadioGroup>');

  const inputId = `${group.name}-${value}`;

  return (
    <div className={cn('flex items-center gap-[11px]', className)}>
      <span className="relative flex size-5 flex-none">
        <input
          id={inputId}
          type="radio"
          name={group.name}
          value={value}
          checked={group.value === value}
          disabled={disabled}
          onChange={() => group.onChange(value)}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none size-5 rounded-full border border-border-strong bg-surface',
            'peer-checked:border-[6px] peer-checked:border-ink',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
            'peer-disabled:border-dashed peer-disabled:border-border-soft peer-disabled:bg-disabled-bg-2',
          )}
        />
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
