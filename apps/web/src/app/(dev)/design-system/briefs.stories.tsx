'use client';

import { useState, type ReactNode } from 'react';
import { formatCommentStamp, StatusChip } from '@tas/ui';
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

/**
 * The Ticket 6 Content section (migration 0069): the four strategist-authored fields the sidebar
 * and Focus Mode draw, rendered as three cards per state — empty (every field NULL), partial
 * (only `briefText` and `voiceoverType` set), full (every field set). Nothing here imports from a
 * runtime database; the "card" is the same Group shape the sidebar uses so a tone or a label
 * change on either side cannot drift. No hex colour literal.
 */
function ContentCard({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wider text-text4 uppercase">{label}</span>
      <p className="rounded-input border border-line bg-surface2 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-text2">
        {children}
      </p>
    </div>
  );
}

const CONTENT_SAMPLE = {
  briefText:
    'The strategist’s rich-text brief for the editor. Shot by shot, with the arc the pack hangs on.',
  music: 'Soft piano, 60 bpm; no cymbals.',
  voiceoverLabel: 'Human',
  voiceoverScript: 'LINE 1: Welcome back.\nLINE 2: Here is what you missed.',
} as const;

function ContentColumn({
  title,
  briefText,
  music,
  voiceover,
  voiceoverScript,
}: {
  readonly title: string;
  readonly briefText: string | null;
  readonly music: string | null;
  readonly voiceover: string | null;
  readonly voiceoverScript: string | null;
}) {
  const dash = <span className="text-text4">—</span>;
  return (
    <section
      data-slot="brief-content-column"
      data-state={title.toLowerCase()}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <h3 className="text-sm font-medium text-text">{title}</h3>
      <ContentCard label="Brief">{briefText ?? dash}</ContentCard>
      <ContentCard label="Music">{music ?? dash}</ContentCard>
      <ContentCard label="Voiceover type">{voiceover ?? dash}</ContentCard>
      <ContentCard label="Voiceover script">{voiceoverScript ?? dash}</ContentCard>
    </section>
  );
}

export function BriefContentFieldsStory() {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-slot="brief-content-fields">
      <ContentColumn
        title="Empty"
        briefText={null}
        music={null}
        voiceover={null}
        voiceoverScript={null}
      />
      <ContentColumn
        title="Partial"
        briefText={CONTENT_SAMPLE.briefText}
        music={null}
        voiceover={CONTENT_SAMPLE.voiceoverLabel}
        voiceoverScript={null}
      />
      <ContentColumn
        title="Full"
        briefText={CONTENT_SAMPLE.briefText}
        music={CONTENT_SAMPLE.music}
        voiceover={CONTENT_SAMPLE.voiceoverLabel}
        voiceoverScript={CONTENT_SAMPLE.voiceoverScript}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Ticket 10 — annotation overlay and the brief-scoped review thread. Mounted here as the Focus
 * Mode draws them; no Server Action is reached because the stories render static markup.
 * ---------------------------------------------------------------------------------------------- */

interface StoryPin {
  readonly id: string;
  readonly xPct: number;
  readonly yPct: number;
  readonly initial: string;
  readonly note: string;
}

function AnnotationFrame({
  pins,
  label,
}: {
  readonly pins: readonly StoryPin[];
  readonly label: string;
}) {
  return (
    <div
      data-slot="annotation-overlay-story"
      data-state={label.toLowerCase().replace(/\s+/g, '-')}
      className="relative aspect-video overflow-hidden rounded-card border border-line bg-linear-to-br from-surface3 via-surface2 to-bg-deep"
    >
      <span className="absolute left-2 top-2 rounded-input border border-line bg-bg-deep/70 px-1.5 py-0.5 font-mono text-[10px] text-text3">
        {label}
      </span>
      {pins.map((pin) => (
        <span
          key={pin.id}
          data-slot="story-pin"
          title={pin.note}
          className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-on-accent/40 bg-accent text-[10px] font-semibold text-on-accent"
          style={{ left: `${String(pin.xPct)}%`, top: `${String(pin.yPct)}%` }}
        >
          {pin.initial}
        </span>
      ))}
    </div>
  );
}

const PIN_NONE: readonly StoryPin[] = [];
const PIN_ONE: readonly StoryPin[] = [
  { id: 's-pin-1', xPct: 42, yPct: 32, initial: 'U', note: 'Slow this pour' },
];
const PIN_FOUR: readonly StoryPin[] = [
  { id: 's-pin-1', xPct: 20, yPct: 25, initial: 'U', note: 'Open on the pour' },
  { id: 's-pin-2', xPct: 55, yPct: 40, initial: 'S', note: 'Logo bump here' },
  { id: 's-pin-3', xPct: 70, yPct: 65, initial: 'A', note: 'Caption obscures CTA' },
  { id: 's-pin-4', xPct: 35, yPct: 80, initial: 'M', note: 'Trim the beat' },
];

export function BriefAnnotationOverlayStory() {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-slot="brief-annotation-overlay-states">
      <AnnotationFrame pins={PIN_NONE} label="Empty" />
      <AnnotationFrame pins={PIN_ONE} label="One pin" />
      <AnnotationFrame pins={PIN_FOUR} label="Four pins" />
    </div>
  );
}

interface StoryComment {
  readonly id: string;
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: Date;
  readonly parentCommentId: string | null;
}

function ThreadCardStory({ comment }: { readonly comment: StoryComment }) {
  const initials = comment.authorName
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return (
    <div className="flex items-start gap-2.5 rounded-input border border-line bg-surface2 px-3 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-line text-[10px] font-semibold text-on-accent">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-text2">{comment.authorName}</span>
          <span className="text-[10px] text-text4">{formatCommentStamp(comment.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-text2">{comment.body}</p>
      </div>
    </div>
  );
}

function ThreadFrame({
  comments,
  label,
}: {
  readonly comments: readonly StoryComment[];
  readonly label: string;
}) {
  const roots = comments.filter((c) => c.parentCommentId === null);
  const repliesByParent = new Map<string, StoryComment[]>();
  for (const c of comments) {
    if (c.parentCommentId !== null) {
      const list = repliesByParent.get(c.parentCommentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentCommentId, list);
    }
  }
  return (
    <section
      data-slot="brief-comment-thread-story"
      data-state={label.toLowerCase().replace(/\s+/g, '-')}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">{label}</h3>
        <StatusChip tone="mute" label={String(comments.length)} />
      </header>
      {roots.length === 0 ? (
        <span className="text-xs text-text4">No review notes on this version yet.</span>
      ) : (
        <div className="flex flex-col gap-3">
          {roots.map((root) => (
            <div key={root.id} className="flex flex-col gap-1.5">
              <ThreadCardStory comment={root} />
              {(repliesByParent.get(root.id) ?? []).length === 0 ? null : (
                <div className="flex flex-col gap-1.5 pl-8">
                  {(repliesByParent.get(root.id) ?? []).map((reply) => (
                    <ThreadCardStory key={reply.id} comment={reply} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const THREAD_FLAT: readonly StoryComment[] = [
  {
    id: 's-c-1',
    body: 'Open on the pour, not the pack.',
    authorName: 'Sonia Patel',
    createdAt: new Date('2026-10-14T14:45:00Z'),
    parentCommentId: null,
  },
  {
    id: 's-c-2',
    body: 'Lift the caption at 0:03 — covers the CTA.',
    authorName: 'Haroon Ali',
    createdAt: new Date('2026-10-14T15:12:00Z'),
    parentCommentId: null,
  },
  {
    id: 's-c-3',
    body: 'Trim four frames off the closing hold.',
    authorName: 'Mohammad Osama',
    createdAt: new Date('2026-10-14T15:40:00Z'),
    parentCommentId: null,
  },
];

const THREAD_REPLY: readonly StoryComment[] = [
  {
    id: 's-c-r-1',
    body: 'Logo bump at 0:12 — a frame earlier, please.',
    authorName: 'Sonia Patel',
    createdAt: new Date('2026-10-14T14:45:00Z'),
    parentCommentId: null,
  },
  {
    id: 's-c-r-2',
    body: 'Done — pushed V2.',
    authorName: 'Haroon Ali',
    createdAt: new Date('2026-10-14T16:02:00Z'),
    parentCommentId: 's-c-r-1',
  },
];

export function BriefCommentThreadStory() {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-slot="brief-comment-thread-states">
      <ThreadFrame comments={[]} label="Empty" />
      <ThreadFrame comments={THREAD_FLAT} label="Flat" />
      <ThreadFrame comments={THREAD_REPLY} label="With a reply" />
    </div>
  );
}
