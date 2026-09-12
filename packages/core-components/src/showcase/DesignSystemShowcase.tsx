import { useState } from 'react';

import { Wordmark } from '../components/Logo';
import { BrandRule } from '../components/SpecSection';
import { ThemeToggle } from '../components/ThemeToggle';
import { cn } from '../lib/cn';
import { ButtonSection } from './sections/ButtonSection';
import { ColorSection } from './sections/ColorSection';
import { GridSection } from './sections/GridSection';
import { InputSection, type DiffMode, type ReviewScope } from './sections/InputSection';
import { SmallPartsSection } from './sections/SmallPartsSection';
import { TypeSection } from './sections/TypeSection';

export interface DesignSystemShowcaseProps {
  /**
   * Print the CSS custom property under each colour swatch. On in the spec
   * sheet, off when the page is used as a plain brand reference.
   */
  showTokens?: boolean;
  className?: string;
}

/**
 * The whole of Snapcheck Core on one page — the live counterpart to the design
 * file. Every specimen below is the real exported component, so this page fails
 * the moment a primitive drifts.
 *
 * Must be rendered inside a `<ThemeProvider>`; the header's toggle drives it.
 */
export function DesignSystemShowcase({ showTokens = true, className }: DesignSystemShowcaseProps) {
  const [snapshots, setSnapshots] = useState(true);
  const [notify, setNotify] = useState(true);
  const [scope, setScope] = useState<ReviewScope>('all');
  const [diff, setDiff] = useState<DiffMode>('side');

  return (
    <div className={cn('mx-auto max-w-[1200px] px-7 pb-[120px] text-ink', className)}>
      <header className="flex flex-wrap items-start justify-between gap-7 pt-11 pb-[22px]">
        <div className="flex flex-col gap-3.5">
          <Wordmark />
          <p className="max-w-[46ch] text-lead text-pretty text-body">
            The primitives shared by the marketing site and the review app. Everything downstream is
            built from this page.
          </p>
        </div>

        <div className="flex flex-col items-end gap-[7px] pt-1 text-right font-mono text-mono text-label">
          <div>CORE / V0.2</div>
          <div>MANROPE + MARTIAN&nbsp;MONO</div>
          <div>SELF-HOSTED / OSS</div>
          <ThemeToggle className="mt-1.5" />
        </div>
      </header>

      <BrandRule />

      <ColorSection showTokens={showTokens} />
      <TypeSection />
      <GridSection />
      <ButtonSection />
      <InputSection
        snapshots={snapshots}
        onSnapshotsChange={setSnapshots}
        notify={notify}
        onNotifyChange={setNotify}
        scope={scope}
        onScopeChange={setScope}
        diff={diff}
        onDiffChange={setDiff}
      />
      <SmallPartsSection />

      <footer className="flex flex-wrap items-center justify-between gap-4 pt-5 font-mono text-mono text-label">
        <div>SNAPCHECK CORE / SHARED BY SITE + APP</div>
        <div>GITHUB.COM/SNAPCHECK</div>
      </footer>
    </div>
  );
}
