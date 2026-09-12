import { SpecLabel, SpecSection } from '../../components/SpecSection';
import { radii, spacing } from '../../tokens';

const radiusSamples = [
  { value: radii.surface, label: '0 SURFACE' },
  { value: radii.chip, label: '3 CHIP' },
  { value: radii.control, label: '6 CONTROL' },
] as const;

export function GridSection() {
  return (
    <SpecSection
      id="grid"
      index="03"
      title="Grid & edges"
      description="4pt spacing. Layout corners stay square; only controls get a 6px radius. Rules instead of shadows."
      contentClassName="flex flex-wrap gap-8"
    >
      <div className="flex-[1_1_240px]">
        <SpecLabel ruled>SPACING</SpecLabel>
        <div className="flex flex-wrap items-end gap-2.5">
          {spacing.map((step) => (
            <div key={step}>
              <div style={{ width: step, height: step }} className="bg-ink" />
              <div className="mt-2 font-mono text-mono-xs tracking-[-0.03em] text-label">
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-[1_1_240px]">
        <SpecLabel ruled>RADIUS &amp; FOCUS</SpecLabel>
        <div className="flex flex-wrap items-end gap-3.5">
          {radiusSamples.map((sample) => (
            <div key={sample.label}>
              <div
                style={{ borderRadius: sample.value }}
                className="h-11 w-[52px] border border-border-soft bg-surface-2"
              />
              <div className="mt-2 font-mono text-mono-xs tracking-[-0.03em] text-label">
                {sample.label}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-[22px] flex items-center gap-3.5">
          <div className="h-10 w-24 rounded-control border border-border-strong bg-surface outline-2 outline-offset-2 outline-accent" />
          <p className="flex-1 text-small text-sec">
            Focus is a 2px blue outline offset 2px. No glow.
          </p>
        </div>
      </div>
    </SpecSection>
  );
}
