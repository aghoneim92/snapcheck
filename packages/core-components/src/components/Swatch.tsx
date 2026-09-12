import { colors, type ColorToken } from '@snapcheck/tokens';

import { cn } from '../lib/cn';

export interface SwatchProps {
  token: ColorToken;
  name: string;
  /** Semantic alias printed under the hex pair, e.g. `--action`. */
  alias?: string;
  /** Print the alias. The spec sheet exposes this as a toggle. */
  showToken?: boolean;
  className?: string;
}

/**
 * One colour chip: a solid block over its name, the light/dark hex pair, and
 * optionally the token that names it. The block renders the *live* value, so it
 * follows the active theme while the caption lists both.
 */
export function Swatch({ token, name, alias, showToken = true, className }: SwatchProps) {
  const color = colors[token];
  // Paper-on-paper needs a hairline or the chip disappears into the page.
  const needsEdge = token === 'paper';

  return (
    <div className={cn('bg-paper', className)}>
      <div
        style={{ background: `var(${color.cssVar})` }}
        className={cn('h-[104px]', needsEdge && 'border-b border-rule')}
      />
      <div className="px-2.5 pt-2.5 pb-3">
        <div className="text-[13px] font-semibold text-ink">{name}</div>
        <div className="mt-[5px] font-mono text-mono-xs text-label">
          L {color.light}
          <br />D {color.dark}
        </div>
        {showToken && alias && (
          <div className="mt-1.5 font-mono text-mono tracking-[-0.03em] text-label">{alias}</div>
        )}
      </div>
    </div>
  );
}
