'use client';

import { StatusChip } from '@tas/ui';

import {
  BRIEF_QA_LABELS,
  briefDimensions,
  internalStatusView,
  priorityView,
  STANDALONE_CONCEPT_SLUG,
} from '@/app/app/briefs/fields';
import { BriefName } from '@/app/app/briefs/[briefId]/brief-name';
import { DimensionsGrid } from '@/app/app/briefs/[briefId]/dimensions-grid';
import { InspirationList } from '@/app/app/briefs/[briefId]/inspiration-list';
import { QaChecklist } from '@/app/app/briefs/[briefId]/qa-checklist';

/**
 * The four shapes the Creative Briefs route introduces, mounted as the product mounts them
 * (CLAUDE.md UI governance rule 4). A client module because three of them are interactive: the copy
 * button confirms in place, the QA checklist holds three ticks, and a server component cannot hand
 * either one a callback.
 *
 * Nothing is re-implemented and nothing is faked: these are the identical components
 * `/app/briefs/<id>` renders, fed plain data so this page never imports `@tas/db`. Every chip tone,
 * status label, ratio and SLA is resolved through the same `fields.ts` helpers the route uses, so a
 * tone shown here is the tone the page shows.
 */
const SAMPLE_NAME = 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2';

/** Four providers, so the embeddable preview and the card that cannot be framed are both here. */
const SAMPLE_LINKS = [
  'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1204339857741622',
  'https://www.youtube.com/watch?v=nm1TxQj9IsQ',
  'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
  'not a url at all',
];

/** The generated name: monospace, never an input, with the copy button that confirms in place. */
export function BriefNameStory() {
  return <BriefName name={SAMPLE_NAME} />;
}

/** The two cells that are chips: a brief with no concept, and the priority with its SLA. */
export function BriefChipsStory() {
  const high = priorityView('Static High');
  const average = priorityView('Video Average');
  const status = internalStatusView('static', 'images_revisions');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusChip tone="mute" label={STANDALONE_CONCEPT_SLUG} />
      {[high, average].map((priority) =>
        priority === null ? null : (
          <span key={priority.label} className="flex items-center gap-1.5">
            <StatusChip tone={priority.tone} label={priority.label} />
            <span className="font-mono text-[11px] text-text3">{priority.sla}</span>
          </span>
        ),
      )}
      <StatusChip tone={status.tone} label={status.label} />
    </div>
  );
}

/** The §8 ratio grid, for the two type sets: video's three and static's two. */
export function BriefDimensionsStory() {
  return (
    <div className="flex flex-col gap-3">
      <DimensionsGrid entries={briefDimensions([], 'Video')} />
      <DimensionsGrid entries={briefDimensions([], 'Static')} />
    </div>
  );
}

/** The inspiration previews, built from the URL alone — no embed dependency, no fetch. */
export function BriefInspirationStory() {
  return <InspirationList urls={SAMPLE_LINKS} />;
}

/** The QA checklist as the demo deployment renders it: three boxes, disabled, explaining why. */
export function BriefQaStory() {
  return (
    <div className="max-w-xs">
      <QaChecklist
        briefId="ds-brief-1"
        checks={{ qaVideoEditor: true, qaDesigner: false, qaStrategist: false }}
        demo
      />
      <p className="mt-2 font-mono text-[10px] text-text4">
        {Object.values(BRIEF_QA_LABELS).join(' · ')}
      </p>
    </div>
  );
}
