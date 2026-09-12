import { colors, paletteSwatches } from '@snapcheck/tokens';

import { SpecLabel, SpecSection } from '../../components/SpecSection';
import { Swatch } from '../../components/Swatch';

const textRoles = [
  { name: 'Primary ink', token: 'ink', className: 'text-base font-semibold text-ink' },
  { name: 'Body', token: 'body', className: 'text-base text-body' },
  { name: 'Secondary', token: 'sec', className: 'text-base text-sec' },
  { name: 'MONO LABEL', token: 'label', className: 'font-mono text-mono text-label' },
] as const;

const statuses = [
  { name: 'Pass', token: 'pass' },
  { name: 'Review', token: 'amber' },
  { name: 'Fail', token: 'fail' },
  { name: 'Info', token: 'info' },
] as const;

function HexPair({ token }: { token: keyof typeof colors }) {
  const color = colors[token];
  return (
    <span className="font-mono text-mono-xs text-label">
      {color.light} / {color.dark}
    </span>
  );
}

export function ColorSection({ showTokens }: { showTokens: boolean }) {
  return (
    <SpecSection
      id="color"
      index="01"
      title="Color"
      description="Warm paper, graphite ink, two brand hues. Blue acts, pine confirms. Chips show the active theme; captions list light / dark."
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-px border border-rule bg-rule">
        {paletteSwatches.map((swatch) => (
          <Swatch
            key={swatch.token}
            token={swatch.token}
            name={swatch.name}
            alias={swatch.alias}
            showToken={showTokens}
          />
        ))}
      </div>

      <div className="mt-[26px] flex flex-wrap gap-7">
        <div className="flex-[1_1_220px]">
          <SpecLabel ruled className="mb-0">
            TEXT ON PAPER
          </SpecLabel>
          <div className="flex flex-col">
            {textRoles.map((role, index) => (
              <div
                key={role.name}
                className={`flex justify-between gap-3 py-2.5 ${
                  index < textRoles.length - 1 ? 'border-b border-rule-soft' : ''
                }`}
              >
                <span className={role.className}>{role.name}</span>
                <HexPair token={role.token} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex-[1_1_220px]">
          <SpecLabel ruled className="mb-0">
            STATUS
          </SpecLabel>
          <div className="flex flex-col">
            {statuses.map((status, index) => (
              <div
                key={status.name}
                className={`flex items-center gap-3 py-2.5 ${
                  index < statuses.length - 1 ? 'border-b border-rule-soft' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  style={{ background: `var(${colors[status.token].cssVar})` }}
                  className="size-3.5 flex-none"
                />
                <span className="flex-1 text-base text-ink">{status.name}</span>
                <HexPair token={status.token} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SpecSection>
  );
}
