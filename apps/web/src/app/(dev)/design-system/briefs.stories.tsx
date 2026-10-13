'use client';

import { useState } from 'react';
import { StatusChip } from '@tas/ui';
import {
  BRIEF_QA_CHECKS,
  qaChecklistFor,
  type BriefQaTicks,
  type ClientStatusKey,
  type InternalStatusKey,
} from '@tas/domain/state';

import {
  PERFORMANCE_OPTIONS,
  briefDimensions,
  internalStatusView,
  priorityView,
  STANDALONE_CONCEPT_SLUG,
} from '@/app/app/creative-design/fields';
import { BriefActivity } from '@/app/app/creative-design/[briefId]/brief-activity';
import { BriefName } from '@/app/app/creative-design/[briefId]/brief-name';
import { DimensionsGrid } from '@/app/app/creative-design/[briefId]/dimensions-grid';
import { BriefDimensionsPicker } from '@/app/app/creative-design/[briefId]/dimensions-picker';
import { InspirationList } from '@/app/app/creative-design/[briefId]/inspiration-list';
import { QaChecklist } from '@/app/app/creative-design/[briefId]/qa-checklist';
import { notApplicableTag } from '@/app/app/creative-sheet/focus-mode';
import { QaCheckRow } from '@/components/status/qa-check-row';
import type { BriefActivityItem } from '@/lib/briefs-source';

/**
 * The shapes the Creative Briefs route introduces, mounted as the product mounts them
 * (CLAUDE.md UI governance rule 4). A client module because several are interactive: the copy
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

/**
 * The cells that are chips: a brief with no concept, the priority with its SLA, a status, and the
 * three Performance grades the detail page shows beside its select — each in the tone
 * `PERFORMANCE_OPTIONS` carries, so the story and the page cannot disagree.
 */
export function BriefChipsStory() {
  const high = priorityView('Static High');
  const average = priorityView('Video Average');
  const status = internalStatusView('revisions_needed');

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
      {PERFORMANCE_OPTIONS.map((grade) => (
        <StatusChip key={grade.key} tone={grade.tone} label={grade.label} />
      ))}
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

/**
 * The brief page's save-on-tick Dimensions picker (2026-10-10), in its three save states. The
 * story's handler is inert: on the page, a tick dispatches `changeBriefDimensionAction`.
 */
export function BriefDimensionsPickerStory() {
  const inert = () => undefined;
  return (
    <div className="flex flex-col gap-3">
      <BriefDimensionsPicker
        selected={['4:5', '1:1', '9:16']}
        disabled={false}
        saveState={{ status: 'idle' }}
        onToggle={inert}
      />
      <BriefDimensionsPicker
        selected={['1:1']}
        disabled={false}
        saveState={{ status: 'saved' }}
        onToggle={inert}
      />
      <BriefDimensionsPicker
        selected={[]}
        disabled={false}
        saveState={{ status: 'error', error: 'That is not one of the delivery ratios.' }}
        onToggle={inert}
      />
    </div>
  );
}

/** The inspiration previews, built from the URL alone — no embed dependency, no fetch. */
export function BriefInspirationStory() {
  return <InspirationList urls={SAMPLE_LINKS} />;
}

/**
 * The brief page's QA checklist with a track (B4.V14): a video brief with the strategist's tick
 * still missing — the designer's row struck through as N/A, `Required` on the open tick, the
 * gate line in warn — and a static brief with every required tick set, so the line turns ok.
 * Demo mode, as the deployment renders it: the boxes are disabled with the reason on hover.
 */
export function BriefQaChecklistStory() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <QaChecklist
        briefId="ds-brief-1"
        checks={{ qaVideoEditor: true, qaDesigner: false, qaStrategist: false }}
        track="video"
        demo
      />
      <QaChecklist
        briefId="ds-brief-2"
        checks={{ qaVideoEditor: false, qaDesigner: true, qaStrategist: true }}
        track="static"
        demo
      />
    </div>
  );
}

/**
 * The one QA row every surface draws (B4.V3 / B4.V17), in its states: a required tick still
 * unset (the `Required` tag), the N/A tick of the other track (dashed box, struck label), a tick
 * set (no tag), and the same three disabled. The rows come from `qaChecklistFor`, so which tick is
 * N/A is the domain's answer for the video track, never a flag typed here. The live rows toggle.
 */
export function QaCheckRowStory() {
  const [ticks, setTicks] = useState<BriefQaTicks>({
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: true,
  });
  const rows = qaChecklistFor('video', ticks);
  return (
    <div className="grid gap-4 rounded-card border border-line bg-surface p-4 md:grid-cols-2">
      <ul className="flex flex-col gap-1.5">
        {rows.map((check) => (
          <QaCheckRow
            key={check.key}
            id={`ds-qa-row-${check.key}`}
            checkKey={check.key}
            inputSlot="story-qa-check"
            label={check.label}
            required={check.required}
            checked={check.checked}
            notApplicableTag={notApplicableTag('video')}
            onCheckedChange={(next) => {
              setTicks((current) => ({ ...current, [check.key]: next }));
            }}
          />
        ))}
      </ul>
      <ul className="flex flex-col gap-1.5">
        {rows.map((check) => (
          <QaCheckRow
            key={check.key}
            id={`ds-qa-row-disabled-${check.key}`}
            checkKey={check.key}
            inputSlot="story-qa-check-disabled"
            label={check.label}
            required={check.required}
            checked={check.checked}
            disabled
            notApplicableTag={notApplicableTag('video')}
            onCheckedChange={() => undefined}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Typed against the vocabularies, so a retired key cannot sit in a fixture: these are the stored
 * values the Activity log carries, not labels.
 */
const INTERNAL = {
  adSubmitted: 'ad_submitted',
  revisionsNeeded: 'revisions_needed',
} as const satisfies Record<string, InternalStatusKey>;

const CLIENT = {
  pending: 'pending_for_approval',
  revisionsNeeded: 'revisions_needed',
} as const satisfies Record<string, ClientStatusKey>;

const [EDITOR_TICK, , STRATEGIST_TICK] = BRIEF_QA_CHECKS;

const MIA = { actorId: 'user_mia', actorName: 'Mia D.' } as const;
const TALAL = { actorId: 'user_talal', actorName: 'Talal' } as const;

/**
 * Three writes, newest first, as `listActivity` returns them: the client sent the creative back
 * and the two ticks cleared in the same second (the post-approval reset is the CLIENT move,
 * B5.A6 — internal stays Approved); a plain edit; the internal reviewer's Request Changes
 * (`ad_submitted → revisions_needed`) with the same two ticks going to `false` (B5.V19).
 */
const ACTIVITY: readonly BriefActivityItem[] = [
  {
    id: 'ds-act-1',
    field: 'clientStatus',
    oldValue: CLIENT.pending,
    newValue: CLIENT.revisionsNeeded,
    ...MIA,
    at: '2026-10-11T14:02:08.410Z',
  },
  {
    id: 'ds-act-2',
    field: EDITOR_TICK,
    oldValue: 'true',
    newValue: 'false',
    ...MIA,
    at: '2026-10-11T14:02:08.412Z',
  },
  {
    id: 'ds-act-3',
    field: STRATEGIST_TICK,
    oldValue: 'true',
    newValue: 'false',
    ...MIA,
    at: '2026-10-11T14:02:08.414Z',
  },
  {
    id: 'ds-act-4',
    field: 'assignee',
    oldValue: 'Sarah K.',
    newValue: 'Jon P.',
    ...TALAL,
    at: '2026-10-10T09:15:00.000Z',
  },
  {
    id: 'ds-act-5',
    field: 'internalStatus',
    oldValue: INTERNAL.adSubmitted,
    newValue: INTERNAL.revisionsNeeded,
    ...MIA,
    at: '2026-10-09T16:40:31.100Z',
  },
  {
    id: 'ds-act-6',
    field: EDITOR_TICK,
    oldValue: 'true',
    newValue: 'false',
    ...MIA,
    at: '2026-10-09T16:40:31.103Z',
  },
  {
    id: 'ds-act-7',
    field: STRATEGIST_TICK,
    oldValue: 'true',
    newValue: 'false',
    ...MIA,
    at: '2026-10-09T16:40:31.105Z',
  },
];

/**
 * The Activity section (B5.V19): one card per write, the status pair as chips, the cleared ticks
 * in `bad`, and the shut-gate line under a reset — then the empty state the demo deployment shows.
 */
export function BriefActivityStory() {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <BriefActivity items={ACTIVITY} />
      <BriefActivity items={[]} />
    </div>
  );
}
