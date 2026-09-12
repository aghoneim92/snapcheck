import { CodeBlock, CodeFlag, CodePrompt } from '../../components/Code';
import { SpecSection } from '../../components/SpecSection';

function Specimen({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`py-[22px] ${last ? '' : 'border-b border-rule-soft'}`}>
      <div className="mb-3 font-mono text-mono-xs text-label">{label}</div>
      {children}
    </div>
  );
}

export function TypeSection() {
  return (
    <SpecSection
      id="type"
      index="02"
      title="Type"
      description="Manrope for everything readable. Martian Mono for machine facts: labels, hashes, branches."
    >
      <div className="flex flex-wrap items-end gap-8 border-b border-rule pb-[26px]">
        <div className="text-[76px] leading-[0.9] font-extrabold tracking-[-0.05em] text-ink">
          Manrope
        </div>
        <div className="pb-1.5 font-mono text-[19px] tracking-[-0.05em] text-ink">Martian</div>
        <p className="flex-[1_1_160px] text-[13px] leading-[19px] text-sec">
          400 / 500 / 600 / 800 · mono 400 / 500. Negative tracking on display, tight tracking on
          mono.
        </p>
      </div>

      <div className="flex flex-col">
        <Specimen label="DISPLAY / 60·62 / 800 / -0.045EM">
          <p className="text-display text-balance text-ink">Ship UI you have actually looked at</p>
        </Specimen>
        <Specimen label="H1 / 38·44 / 800">
          <p className="text-h1 text-ink">Visual review, self-hosted</p>
        </Specimen>
        <Specimen label="H2 / 26·34 / 600">
          <p className="text-h2 text-ink">Every component, every commit</p>
        </Specimen>
        <Specimen label="BODY / 17·27 / 400">
          <p className="max-w-[60ch] text-lead text-pretty text-body">
            Snapcheck renders your components, captures them, and shows you what moved. Run it on
            your own infrastructure, keep every snapshot, and review changes next to the code that
            caused them.
          </p>
        </Specimen>
        <Specimen label="SMALL / 14·21 / 400">
          <p className="max-w-[60ch] text-small text-sec">
            Metadata, helper copy, timestamps. Never smaller than 14 for anything a person has to
            read.
          </p>
        </Specimen>
        <Specimen label="LABEL / MONO 10 / -0.02EM / UPPER">
          <p className="font-mono text-mono text-ink">BUILD / REVIEW / SHIP / TOGETHER</p>
        </Specimen>
        <Specimen label="CODE / MONO 13·22" last>
          <CodeBlock>
            <CodePrompt /> npx snapcheck run <CodeFlag>--base main</CodeFlag>
          </CodeBlock>
        </Specimen>
      </div>
    </SpecSection>
  );
}
