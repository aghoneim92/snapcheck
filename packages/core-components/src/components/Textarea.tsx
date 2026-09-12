import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { cn } from '../lib/cn';
import { controlSkin, Field, invalidSkin } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
}

export function Textarea({
  label,
  hint,
  invalid = false,
  className,
  id,
  rows = 3,
  disabled,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={textareaId} hint={hint} invalid={invalid} disabled={disabled}>
      <textarea
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          controlSkin,
          'resize-y px-3 py-[11px] text-base leading-[23px]',
          invalid && invalidSkin,
          className,
        )}
        {...props}
      />
    </Field>
  );
}
