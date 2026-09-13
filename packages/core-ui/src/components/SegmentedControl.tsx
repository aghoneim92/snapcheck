import { cn } from '../lib/cn';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Hard-edged toggle group: one graphite outline around the set, hairline
 * dividers between segments, filled ink for the active one.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex overflow-hidden rounded-control border border-ink', className)}
      {...props}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'cursor-pointer px-3.5 py-[9px] text-small font-bold',
              'transition-colors duration-[110ms] ease-out motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              index < options.length - 1 && 'border-r border-ink',
              selected ? 'bg-ink text-paper' : 'bg-transparent text-ink hover:bg-surface-2',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
