import type { PromotionRequestRow, PropagationRun, PropagationTrigger } from '@tas/db';
import {
  PROMOTION_STATUS,
  PROMOTION_STATUS_INITIAL,
  isPromotionStatus,
  promotionStatusLabel,
  promotionStatusTone,
  type ChipTone,
  type PromotionStatusKey,
} from '@tas/domain/state';

import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { propagationPath } from '@/lib/routes';

/**
 * Everything the Propagation table shows about one promotion request, resolved once on the server
 * (PRD §5: "request comes in to the ADMIN dashboard to approve everything"; §14.1: "One template,
 * propagated").
 *
 * One module, so the page, the table, the design-system story and the e2e spec cannot drift: the
 * column headings, the seven cells, the filter's options and every sentence the empty state can say
 * are stated here and nowhere else.
 *
 * NO STATUS STRING IS WRITTEN IN THIS ROUTE (ticket criterion 7, CLAUDE.md non-negotiable 2). The
 * keys, the labels and the chip tones all come from `PROMOTION_STATUS` in `@tas/domain/state`; the
 * filter's options are that tuple plus one word that is deliberately NOT a status (`all`), and the
 * default is `PROMOTION_STATUS_INITIAL` rather than a `'pending'` typed here. A fourth state added
 * to the domain grows the filter without this file being edited.
 *
 * Only TYPES are imported from `@tas/db`, so the driver never reaches the browser bundle, and
 * nothing here reads the clock or the session: `toPromotionItem` takes `now` as a parameter for the
 * same reason every other timestamp column in this app does — a client that formatted the string
 * itself would disagree with the server and break hydration.
 */

/**
 * The columns, in the ticket's order: its six, then the decision cell every row ends with.
 *
 * The seventh is a cell rather than a seventh fact about the request. It carries the row's
 * `StatusChip` and, under it, the only two controls on the page for a pending row — or, for a row
 * somebody has already settled, who settled it and when. Buttons and their outcome belong in one
 * place because they are the same column of the reader's question: what happens to this request.
 */
export const PROMOTION_COLUMNS = [
  'Brand',
  'Table',
  'Field',
  'Requested by',
  'Requested at',
  'Change',
  'Decision',
] as const;

/** The filter option that is not a status: every state at once. Never stored, never queried. */
export const ALL_STATUSES = 'all';

/** What `?status=` may say: one of the domain's three states, or `all`. */
export type PromotionStatusFilter = PromotionStatusKey | typeof ALL_STATUSES;

/** The state the page opens in with no `?status=`: the pending queue the ticket describes. */
export const DEFAULT_STATUS_FILTER: PromotionStatusFilter = PROMOTION_STATUS_INITIAL;

export interface PromotionFilterOption {
  readonly key: PromotionStatusFilter;
  readonly label: string;
  /** Where the option points. The default state has a clean address with no query at all. */
  readonly href: string;
}

/** `?status=` for a filter, or the bare path for the default one, so a plain queue is a clean URL. */
export function statusFilterHref(filter: PromotionStatusFilter): string {
  return filter === DEFAULT_STATUS_FILTER ? propagationPath : `${propagationPath}?status=${filter}`;
}

/**
 * The filter, in the order the machine runs plus `All` last. Built from `PROMOTION_STATUS`, so the
 * options and the chips can never name different states.
 */
export const PROMOTION_FILTERS: readonly PromotionFilterOption[] = [
  ...PROMOTION_STATUS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    href: statusFilterHref(entry.key),
  })),
  { key: ALL_STATUSES, label: 'All', href: statusFilterHref(ALL_STATUSES) },
];

/**
 * What the address asked for, or the default. Total and deny-by-nonsense: a repeated parameter
 * (`string[]`), a missing one and a word this build does not recognise all fall back to the pending
 * queue rather than throwing or showing everything.
 */
export function resolveStatusFilter(value: string | string[] | undefined): PromotionStatusFilter {
  if (typeof value !== 'string') {
    return DEFAULT_STATUS_FILTER;
  }
  if (value === ALL_STATUSES) {
    return ALL_STATUSES;
  }
  return isPromotionStatus(value) ? value : DEFAULT_STATUS_FILTER;
}

/**
 * The state to read, in the vocabulary the data source takes: `undefined` is "every state", which
 * is how `@tas/db` already spells it. The filter word `all` stops here and never reaches a query.
 */
export function statusQuery(filter: PromotionStatusFilter): PromotionStatusKey | undefined {
  return filter === ALL_STATUSES ? undefined : filter;
}

/** A brand that has been soft-deleted still raised the request; the cell says so instead of blank. */
export const REMOVED_BRAND_LABEL = 'Brand removed';

/** The Decision cell of a settled row when the reviewer's name did not survive. Never blank. */
export const UNKNOWN_REVIEWER_LABEL = 'An agency Admin';

export interface PromotionBrandCell {
  readonly text: string;
  /** True for the removed-brand placeholder, which reads in the mute tone rather than the body one. */
  readonly muted: boolean;
}

/** One request, fully resolved: seven cells and nothing a component has to compute. */
export interface PromotionItem {
  readonly id: string;
  readonly brand: PromotionBrandCell;
  readonly tableName: string;
  readonly fieldName: string;
  readonly requestedBy: string;
  /** "2 days ago". Formatted on the server with one `now` for the whole table. */
  readonly requestedAt: string;
  /** The absolute timestamp behind it, for the cell's `title`. */
  readonly requestedAtTitle: string;
  /** The value the template holds today, struck through in the diff. */
  readonly currentValue: string;
  /** The value the brand is asking the template to take. */
  readonly proposedValue: string;
  readonly statusLabel: string;
  readonly statusTone: ChipTone;
  /** True while the request is still waiting on an admin: the only rows with buttons. */
  readonly pending: boolean;
  /** "Marguerite Alaoui, 8 days ago" for a settled row, null while it is still pending. */
  readonly decidedBy: string | null;
  /** The admin's reason, when they left one. */
  readonly reviewNote: string | null;
}

/** The Brand cell: the name the join carried, or words for a brand that is no longer there. */
export function brandCell(row: PromotionRequestRow): PromotionBrandCell {
  return row.brandName === null
    ? { text: REMOVED_BRAND_LABEL, muted: true }
    : { text: row.brandName, muted: false };
}

/**
 * Who settled the request and how long ago, as one sentence — or null while nobody has.
 *
 * It reads the two review columns TOGETHER, because a row that carried a reviewer and no timestamp
 * (or the other way round) would otherwise print half a fact. A settled row whose reviewer is gone
 * still says an Admin decided it, which is the part that matters to the person reading.
 */
export function decidedByLabel(row: PromotionRequestRow, now: Date): string | null {
  if (row.status === PROMOTION_STATUS_INITIAL || row.reviewedAt === null) {
    return null;
  }
  return `${row.reviewedBy ?? UNKNOWN_REVIEWER_LABEL}, ${relativeTime(row.reviewedAt, now)}`;
}

/** One row, fully resolved. `now` is a parameter so the whole table shares a single instant. */
export function toPromotionItem(row: PromotionRequestRow, now: Date): PromotionItem {
  return {
    id: row.id,
    brand: brandCell(row),
    tableName: row.tableName,
    fieldName: row.fieldName,
    requestedBy: row.requestedBy,
    requestedAt: relativeTime(row.requestedAt, now),
    requestedAtTitle: absoluteTime(row.requestedAt),
    currentValue: row.currentValue,
    proposedValue: row.proposedValue,
    statusLabel: promotionStatusLabel(row.status),
    statusTone: promotionStatusTone(row.status),
    pending: row.status === PROMOTION_STATUS_INITIAL,
    decidedBy: decidedByLabel(row, now),
    reviewNote: row.reviewNote,
  };
}

/**
 * How each ledger `trigger` reads in the Run History tab. The keys are exhaustive over
 * `PropagationTrigger`, so a new trigger cannot be added to the engine without a label here.
 */
export const PROPAGATION_TRIGGER_LABELS: Record<PropagationTrigger, string> = {
  insert: 'Row added',
  update: 'Row updated',
  soft_delete: 'Row removed',
  seed: 'Brand seeded',
  interface: 'Interface config',
  sweep: 'Full re-sync',
};

/** A single propagation the engine ran, resolved for the Run History table. */
export interface PropagationRunItem {
  readonly id: string;
  /** The table the run touched, a system identifier — the cell renders it in `font-mono`. */
  readonly tableName: string;
  readonly triggerLabel: string;
  readonly childrenUpdated: number;
  readonly skipped: number;
  /** "2 hours ago", formatted on the server with one shared `now`. */
  readonly ranAt: string;
  readonly ranAtTitle: string;
  /** The actor who triggered it, or null when the engine ran it unattended. */
  readonly actor: string | null;
}

/** One ledger row, resolved. `now` is a parameter so the whole table shares one instant. */
export function toPropagationRunItem(run: PropagationRun, now: Date): PropagationRunItem {
  return {
    id: run.id,
    tableName: run.tableName,
    triggerLabel: PROPAGATION_TRIGGER_LABELS[run.trigger],
    childrenUpdated: run.childrenUpdated,
    skipped: run.skipped,
    ranAt: relativeTime(run.createdAt, now),
    ranAtTitle: absoluteTime(run.createdAt),
    actor: run.createdBy,
  };
}

/** The Run History tab's empty state, shown when no propagation has been logged yet. */
export const RUN_HISTORY_EMPTY =
  'No propagations have run yet. They appear here as the template fans changes out to its brands.';

/** "3 requests", or "1 request" — the count the heading states for the state being shown. */
export function promotionCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'request' : 'requests'}`;
}

/**
 * The rest of the count sentence: what the state the reader is looking at MEANS, not its name.
 *
 * "3 requests — pending" would be the filter button read back at them. The page's whole job is to
 * explain that a promotion moves a value into the template every brand inherits, so each state says
 * what it did to the change rather than repeating its own label.
 *
 * Keyed by the domain's type for the reason `EMPTY_TITLES` below is: a renamed state is a build
 * error here rather than a sentence that quietly stops matching.
 */
const FILTER_NOTES: Readonly<Record<PromotionStatusFilter, string>> = {
  pending: 'waiting on an agency Admin.',
  approved: 'promoted into the template every brand inherits.',
  rejected: 'declined — the change stayed local to the brand that asked.',
  [ALL_STATUSES]: 'every request this agency has raised, in any state.',
};

export function filterNote(filter: PromotionStatusFilter): string {
  return FILTER_NOTES[filter];
}

/**
 * The empty state's heading, in words and never a blank panel (criterion c of the page brief).
 *
 * Each state is empty for a different reason, so each says its own: no queue is good news, no
 * approvals or rejections is a history that has not happened yet, and nothing at all means no brand
 * has ever asked. A reader must be able to tell "you are up to date" from "this is broken".
 *
 * A `Record<PromotionStatusFilter, string>` rather than a switch on a string: the keys are the
 * domain's type, so renaming a state in `PROMOTION_STATUS` is a BUILD error here — the arrangement
 * `state/copy-status` and `schema/copy.ts` use, applied to copy instead of to a column. This is the
 * only place in the route where a state key is written down, and the compiler is what keeps it
 * honest.
 */
const EMPTY_TITLES: Readonly<Record<PromotionStatusFilter, string>> = {
  pending: 'Nothing is waiting for a decision.',
  approved: 'No change has been promoted to the template yet.',
  rejected: 'No request has been rejected.',
  [ALL_STATUSES]: 'No brand has asked to promote a change yet.',
};

export function emptyTitle(filter: PromotionStatusFilter): string {
  return EMPTY_TITLES[filter];
}

/** The second line of the empty state: what would put a row here, in the product's own terms. */
export const EMPTY_BODY =
  'A request appears here when somebody edits a field in one brand and asks for that value to ' +
  'become the template every brand inherits. Nothing is promoted automatically, so this page stays ' +
  'empty until a brand asks.';

/** The way out of a state that has nothing in it: the queue, which is where the work is. */
export const SEE_PENDING_LABEL = 'See pending requests';

/** The way out of the pending queue when it is empty: the full history, which may not be. */
export const SEE_ALL_LABEL = 'See every request';

/** The primary action the empty state offers, and where it goes. Never a blank panel. */
export function emptyAction(filter: PromotionStatusFilter): PromotionFilterOption {
  return filter === DEFAULT_STATUS_FILTER
    ? { key: ALL_STATUSES, label: SEE_ALL_LABEL, href: statusFilterHref(ALL_STATUSES) }
    : {
        key: DEFAULT_STATUS_FILTER,
        label: SEE_PENDING_LABEL,
        href: statusFilterHref(DEFAULT_STATUS_FILTER),
      };
}

/**
 * The second line under the heading (the page brief's "only an Admin can approve, and the check runs
 * on the server").
 *
 * It is a SECOND sentence rather than a longer `PROPAGATION_ADMIN_NOTE`, because the domain's note
 * says what the page is FOR and this says how it is ENFORCED, and the second one is about this
 * codebase rather than about the product. Hiding a button is not a control: `canSeePropagationPage`
 * decides the page on the server before a row is read, and both Server Actions ask
 * `canReviewPromotion` again before they write.
 */
export const PROPAGATION_ENFORCEMENT_NOTE =
  'Only an agency Admin can approve or reject. The check runs on the server — canSeePropagationPage ' +
  'before the table is read, and again in the action before anything is written, not by hiding a ' +
  'button.';

/** The label of the box a rejection's reason is typed into, and the reason it is required. */
export const NOTE_LABEL = 'Reason';

export const NOTE_PLACEHOLDER = 'Why this stays local to the brand that asked';

/** What the Reject control says before a reason has been given. */
export const REJECT_PROMPT = 'A rejection needs a reason. The person who raised it reads this.';
