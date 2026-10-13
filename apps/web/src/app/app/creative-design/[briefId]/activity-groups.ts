import {
  BRIEF_QA_CHECK_LABELS,
  BRIEF_QA_CHECKS,
  CLIENT_STATUS,
  chipTone,
  internalStatusLabel,
  type ChipTone,
} from '@tas/domain/state';

import type { BriefActivityItem } from '@/lib/briefs-source';

/**
 * The Activity section's pure half (Oct 12 UI overhaul, board 5 — B5.V4 / B5.V2 / B5.V3 / B5.V5).
 *
 * One status write logs several rows — the status itself and, on a move into a revision state, the
 * three QA ticks it clears — as separate statements outside a transaction, so they share the actor
 * and a `created_at` within milliseconds, never to the millisecond. Grouping by actor and the
 * timestamp truncated to the SECOND (ruling 19) is what lets the page show the reset as the board
 * draws it: ONE event, the status chip pair above the ticks that went to `false`, with the shut
 * gate named once underneath. Everything here is derived from the logged rows; nothing is read
 * back from the brief.
 */

/** A logged value's tone: a tick set is ok, a tick cleared is bad, anything else is quiet. */
export type ActivityValueTone = Extract<ChipTone, 'ok' | 'bad' | 'mute'>;

export interface ActivityGroup {
  /** The first row's id, stable for a React key. */
  readonly id: string;
  readonly actorId: string | null;
  readonly actorName: string | null;
  /** The newest row's ISO timestamp; the rows of a group differ by milliseconds at most. */
  readonly at: string;
  /** The rows in display order: the two statuses first, then the ticks in checklist order, then the rest. */
  readonly entries: readonly BriefActivityItem[];
  /** The write cleared a QA tick while moving a status into a revision state — the gate re-shut. */
  readonly reset: boolean;
}

/** The two status columns, named by their Drizzle keys as the log stores them. */
const STATUS_FIELDS = ['internalStatus', 'clientStatus'] as const;

/** Human labels for the fields the log carries (B5.V3); an unknown field falls back to its key. */
export const ACTIVITY_FIELD_LABELS: Readonly<Partial<Record<string, string>>> = {
  internalStatus: 'Internal status',
  clientStatus: 'Client status',
  ...BRIEF_QA_CHECK_LABELS,
  assignee: 'Assignee',
  priority: 'Priority',
  dueDate: 'Due date',
  type: 'Type',
  funnel: 'Funnel',
  version: 'Version',
  conceptId: 'Concept',
};

export function activityFieldLabel(field: string): string | null {
  return ACTIVITY_FIELD_LABELS[field] ?? null;
}

export function isQaTickField(field: string): boolean {
  return (BRIEF_QA_CHECKS as readonly string[]).includes(field);
}

/** The tone a logged value renders in (B5.V2): only the three ticks are toned, by `true` / `false`. */
export function activityValueTone(field: string, value: string | null): ActivityValueTone {
  if (!isQaTickField(field)) return 'mute';
  if (value === 'true') return 'ok';
  if (value === 'false') return 'bad';
  return 'mute';
}

/** The label a logged STATUS key renders as, through the right vocabulary; null for any other field. */
export function activityStatusLabel(field: string, value: string | null): string | null {
  if (value === null) return null;
  if (field === 'internalStatus') return internalStatusLabel(value);
  if (field === 'clientStatus') {
    return CLIENT_STATUS.find((entry) => entry.key === value)?.label ?? value;
  }
  return null;
}

/** ISO `2026-10-12T10:11:12.345Z` → `2026-10-12T10:11:12`: the grouping key's precision. */
function toSecond(at: string): string {
  return at.slice(0, 19);
}

function sameWrite(a: BriefActivityItem, b: BriefActivityItem): boolean {
  return a.actorId === b.actorId && toSecond(a.at) === toSecond(b.at);
}

/** Display rank inside a group: statuses, then the ticks in checklist order, then everything else. */
function rank(field: string): number {
  const status = (STATUS_FIELDS as readonly string[]).indexOf(field);
  if (status !== -1) return status;
  const tick = (BRIEF_QA_CHECKS as readonly string[]).indexOf(field);
  if (tick !== -1) return STATUS_FIELDS.length + tick;
  return STATUS_FIELDS.length + BRIEF_QA_CHECKS.length;
}

/**
 * Whether a group IS a QA reset (B5.V5): a tick went to `false` in the same write as a status
 * moving to a `warn`-toned key. The key is never typed — `chipTone(label) === 'warn'` is the
 * same rule `qaResetFor` derives the invalidating keys from.
 */
function isReset(entries: readonly BriefActivityItem[]): boolean {
  const cleared = entries.some((entry) => isQaTickField(entry.field) && entry.newValue === 'false');
  const sentBack = entries.some((entry) => {
    const label = activityStatusLabel(entry.field, entry.newValue);
    return label !== null && chipTone(label) === 'warn';
  });
  return cleared && sentBack;
}

/** Consecutive rows by the same actor within the same second form one group, in the log's order. */
export function groupActivity(items: readonly BriefActivityItem[]): readonly ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  let open: BriefActivityItem[] = [];

  const close = () => {
    const [first] = open;
    if (first === undefined) return;
    // A stable sort keeps the log's order among rows of the same rank; the copy is what the
    // app's other lists do rather than `toSorted`, so no browser baseline moves.
    const entries = [...open].sort((a, b) => rank(a.field) - rank(b.field));
    groups.push({
      id: first.id,
      actorId: first.actorId,
      actorName: first.actorName,
      at: first.at,
      entries,
      reset: isReset(entries),
    });
    open = [];
  };

  for (const item of items) {
    const [first] = open;
    if (first !== undefined && !sameWrite(first, item)) close();
    open.push(item);
  }
  close();
  return groups;
}
