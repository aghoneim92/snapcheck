import { Checkbox } from '../../components/Checkbox';
import { SearchIcon } from '../../components/Icons';
import { Input, Kbd } from '../../components/Input';
import { Radio, RadioGroup } from '../../components/Radio';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Select } from '../../components/Select';
import { SpecLabel, SpecSection } from '../../components/SpecSection';
import { Switch } from '../../components/Switch';
import { Textarea } from '../../components/Textarea';

export type DiffMode = 'side' | 'overlay';
export type ReviewScope = 'all' | 'visual';

const diffModes = [
  { value: 'side', label: 'Side by side' },
  { value: 'overlay', label: 'Overlay' },
] as const satisfies readonly { value: DiffMode; label: string }[];

export interface InputSectionProps {
  snapshots: boolean;
  onSnapshotsChange: (value: boolean) => void;
  notify: boolean;
  onNotifyChange: (value: boolean) => void;
  scope: ReviewScope;
  onScopeChange: (value: ReviewScope) => void;
  diff: DiffMode;
  onDiffChange: (value: DiffMode) => void;
}

export function InputSection({
  snapshots,
  onSnapshotsChange,
  notify,
  onNotifyChange,
  scope,
  onScopeChange,
  diff,
  onDiffChange,
}: InputSectionProps) {
  return (
    <SpecSection
      id="inputs"
      index="05"
      title="Inputs"
      description="White fields on paper so entry points are obvious. Labels in mono, values in Manrope. All live."
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(258px,1fr))] gap-x-8 gap-y-[26px]">
        <Input
          label="PROJECT NAME"
          placeholder="web-app"
          hint="Appears in build URLs. Lowercase, no spaces."
        />

        <Input
          label="SEARCH"
          type="search"
          placeholder="Search components…"
          leadingIcon={<SearchIcon />}
          trailing={<Kbd>/</Kbd>}
          hint="Slash focuses search anywhere."
        />

        <Select label="ENVIRONMENT" hint="Native select, restyled. No custom popover.">
          <option>Production</option>
          <option>Staging</option>
          <option>Preview</option>
        </Select>

        <Input
          label="BASELINE BRANCH"
          defaultValue="man"
          invalid
          hint={'No branch named “man”. Did you mean main?'}
        />

        <Textarea label="COMMENT" placeholder="Add a comment…" hint="Markdown supported." />

        <Input
          label="SNAPSHOT KEY / LOCKED"
          defaultValue="snap_live_••••••••"
          disabled
          mono
          hint="Read-only. Rotate from the CLI."
        />
      </div>

      <div className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(216px,1fr))] gap-x-8 gap-y-[26px] border-t border-rule pt-[26px]">
        <div>
          <SpecLabel>CHECKBOX</SpecLabel>
          <div className="flex flex-col gap-3.5">
            <Checkbox
              label="Include snapshots"
              checked={snapshots}
              onChange={(event) => onSnapshotsChange(event.target.checked)}
            />
            <Checkbox label="Include console logs" disabled />
          </div>
        </div>

        <div>
          <SpecLabel>RADIO</SpecLabel>
          <RadioGroup
            aria-label="Review scope"
            value={scope}
            onValueChange={(next) => onScopeChange(next as ReviewScope)}
          >
            <Radio value="all" label="All changes" />
            <Radio value="visual" label="Only visual changes" />
          </RadioGroup>
        </div>

        <div>
          <SpecLabel>SWITCH</SpecLabel>
          <Switch
            checked={notify}
            onCheckedChange={onNotifyChange}
            label="Notify on failed builds"
          />
          <p className="mt-3 text-small text-sec">Switches apply immediately. No save button.</p>
        </div>

        <div>
          <SpecLabel>SEGMENTED</SpecLabel>
          <SegmentedControl
            aria-label="Diff mode"
            options={diffModes}
            value={diff}
            onValueChange={onDiffChange}
          />
        </div>
      </div>
    </SpecSection>
  );
}
