import { icons, type IconName } from '../../components/Icons';
import { Link } from '../../components/Link';
import { SpecLabel, SpecSection } from '../../components/SpecSection';
import { Tag } from '../../components/Tag';

const tags = [
  { label: 'PASS', tone: 'pass' },
  { label: 'REVIEW', tone: 'review' },
  { label: 'FAIL', tone: 'fail' },
  { label: 'RUNNING', tone: 'running' },
  { label: 'MAIN', tone: 'neutral' },
] as const;

const iconOrder: IconName[] = ['code', 'eye', 'layers', 'shieldCheck', 'snapshot', 'branch'];

export function SmallPartsSection() {
  return (
    <SpecSection
      id="small-parts"
      index="06"
      title="Small parts"
      description="Links, tags and icons. Tags are mono and square; they read as data, not decoration."
      contentClassName="flex flex-wrap gap-8"
      last
    >
      <div className="flex-[1_1_210px]">
        <SpecLabel ruled>LINKS</SpecLabel>
        <div className="flex flex-col gap-3.5 text-[16px] leading-6">
          <Link href="#color">Inline text link</Link>
          <Link href="#buttons" variant="action">
            Open in review
          </Link>
          <Link href="#grid" variant="mono">
            DOCS / SELF-HOSTING
          </Link>
        </div>
      </div>

      <div className="flex-[1_1_210px]">
        <SpecLabel ruled>TAGS</SpecLabel>
        <div className="flex flex-wrap gap-[7px]">
          {tags.map((tag) => (
            <Tag key={tag.label} tone={tag.tone}>
              {tag.label}
            </Tag>
          ))}
          <Tag dense>A1F09C4</Tag>
        </div>
      </div>

      <div className="flex-[1_1_210px]">
        <SpecLabel ruled>ICONS / 24 / 1.7PX</SpecLabel>
        <div className="flex flex-wrap gap-[18px] text-ink">
          {iconOrder.map((name) => {
            const Glyph = icons[name];
            return <Glyph key={name} />;
          })}
        </div>
        <p className="mt-4 text-small text-sec">
          Square joins where the shape allows, round caps on strokes, matching the mark.
        </p>
      </div>
    </SpecSection>
  );
}
