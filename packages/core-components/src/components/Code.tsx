import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface CodeBlockProps {
  children: ReactNode;
  className?: string;
}

/** Ink slab with paper-toned mono text. Always full-bleed within its column. */
export function CodeBlock({ children, className }: CodeBlockProps) {
  return (
    <pre
      className={cn(
        'overflow-x-auto bg-slab px-4 py-3.5 font-mono text-code text-code-ink',
        className,
      )}
    >
      {children}
    </pre>
  );
}

/** Shell prompt marker, in pass-bright. */
export function CodePrompt({ children = '$' }: { children?: ReactNode }) {
  return <span className="text-pass-bright">{children}</span>;
}

/** Flag or argument highlight, in the muted code accent. */
export function CodeFlag({ children }: { children: ReactNode }) {
  return <span className="text-code-accent">{children}</span>;
}
