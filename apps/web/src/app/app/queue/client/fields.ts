import { briefThumbnail } from '@tas/domain/creatives';
import {
  chipTone,
  clientQueueActionsFor,
  clientQueueColumnEntry,
  CLIENT_QUEUE_ACTIONS,
  isOnClientQueue as isOnClientQueueRule,
  type ChipTone,
  type ClientQueueActionKey,
  type ClientQueueRow,
  type StatusEntry,
} from '@tas/domain/state';

import { priorityView, type BriefPriorityView } from '@/app/app/briefs/fields';
import { assignedToViewer } from '@/app/app/queue/internal/fields';
import type { QueueFace } from '@/components/queue/queue-face';

/**
 * How the Client Queue presents what it reads (PRD §9, §10; ticket `client-queue`).
 *
 * One module, so the board, the card and the `/design-system` preview cannot drift: the URL
 * vocabulary, the filter labels, the several different empty sentences and the rule the board is
 * gated by are each stated exactly once.
 *
 * NOTHING HERE INVENTS A VOCABULARY. The columns, their order and their labels come from
 * `clientQueueColumns()` in `@tas/domain/state`; the chip tone from `chipTone`; the eligibility rule
 * from `isOnClientQueue` in the domain; the two write controls from `CLIENT_QUEUE_ACTIONS`, which is
 * where their labels and target statuses live. The priority chip is `priorityView` from the Creative
 * Briefs route and the thumbnail is `briefThumbnail`, both imported and never re-implemented. No
 * component on this route lists a client status, compares one to a literal or orders them.
 *
 * `@tas/db` is deliberately absent: the board is a client component (the filter rewrites the address
 * with the History API and must not cost a server round trip), so a runtime import of that package
 * would drag the database driver into the browser bundle. Everything the client needs is handed down
 * from `page.tsx` as plain data.
 */

/** The one URL parameter this board owns. `all` is the default and writes nothing. */
export const CLIENT_QUEUE_FILTER_PARAM = 'filter';

/** `?filter=mine`. */
export const CLIENT_QUEUE_MINE_FILTER = 'mine';

/**
 * The two things the filter can mean. A discriminated union rather than a bare string, so a
 * component can never read a name out of a filter that has none. The Internal Queue's third option
 * — `brand:<id>` — is deliberately absent: the client track is one brand's approvals by definition,
 * and an option that can only ever say "this brand" is a control that explains nothing.
 */
export type ClientQueueFilter = { readonly kind: 'all' } | { readonly kind: 'mine' };

/** The default: every eligible brief on the board, and no parameter in the address. */
export const ALL_FILTER: ClientQueueFilter = { kind: 'all' };

/**
 * The `?filter=` parameter, parsed.
 *
 * TOTAL BY CONSTRUCTION, exactly as `parseQueueView` is: a missing parameter, a repeated one, a word
 * from a later ticket or junk somebody typed into the address bar is the default board rather than a
 * throw or a blank page. A hand-edited URL is a thing that happens, and it must never be able to
 * break a page a client's approvals are read from. Matched case-insensitively because the address
 * bar lowercases nothing for the user.
 */
export function parseClientQueueFilter(
  param: string | readonly string[] | undefined,
): ClientQueueFilter {
  const raw = typeof param === 'string' ? param : (param?.[0] ?? '');
  return raw.trim().toLowerCase() === CLIENT_QUEUE_MINE_FILTER ? { kind: 'mine' } : ALL_FILTER;
}

/**
 * The parameter a filter is written back as, or `null` for the default — which is deleted from the
 * address rather than written as `?filter=all`, so the plain board has a clean, shareable URL.
 */
export function clientQueueFilterParam(filter: ClientQueueFilter): string | null {
  return filter.kind === 'mine' ? CLIENT_QUEUE_MINE_FILTER : null;
}

/** Two filters are the same filter. Used to mark the pressed button; no component compares parts. */
export function sameClientQueueFilter(a: ClientQueueFilter, b: ClientQueueFilter): boolean {
  return clientQueueFilterParam(a) === clientQueueFilterParam(b);
}

/**
 * PRD §9's eligibility rule, and nothing else (ticket criterion 4).
 *
 * It is `isOnClientQueue` from `@tas/domain/state` — `isClientTrackOpen(row.internalStatus)` and not
 * already finished on the client track — delegated rather than restated, so this route has no second
 * opinion about who may see a creative. `client-queue-source.ts` applies the same predicate at the
 * loader, so an ineligible row never reaches this module at all; re-applying it here is a deliberate
 * no-op that keeps the rule impossible to forget when a future caller builds an item list by hand.
 */
export function isOnClientQueue(row: ClientQueueRow): boolean {
  return isOnClientQueueRule(row);
}

/** A client status as its chip: the domain's own label, and the tone that label earns. */
export interface ClientStatusView {
  readonly key: string;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The chip for a stored client status. A value no column carries — one written by a newer build —
 * renders its own key on a muted chip rather than throwing or rendering an empty pill, which is the
 * same choice `groupByClientStatus` makes when it drops such a row into the "other" column.
 */
export function clientStatusView(status: string): ClientStatusView {
  const entry = clientQueueColumnEntry(status);
  return entry === undefined
    ? { key: status, label: status, tone: 'mute' }
    : { key: entry.key, label: entry.label, tone: chipTone(entry.label) };
}

/**
 * One brief as the client board renders it: everything a card shows, and nothing else. Built on the
 * server so the client component never imports `@tas/db` and never resolves a status, a tone or a
 * tile itself.
 *
 * `internalStatus` is carried but NEVER RENDERED (ticket criterion 4): it is what the domain's own
 * `groupByClientStatus` re-applies the eligibility gate with, so the grouping cannot be talked into
 * placing a row the internal track has not signed off. Nothing on this page draws it, and no
 * component compares it to anything — the only reader is the domain.
 */
export interface ClientQueueItem extends QueueFace {
  readonly id: string;
  readonly name: string;
  readonly internalStatus: string;
  readonly clientStatus: string;
  readonly assignee: string | null;
  readonly priority: BriefPriorityView | null;
  readonly status: ClientStatusView;
  /** `briefPath(id)` — the card's link goes to the real Creative Brief page. */
  readonly href: string;
}

/** The minimum a `BriefRow` has to carry for the board. Structural, so nothing is re-narrowed. */
export interface ClientQueueSourceRow {
  readonly id: string;
  readonly name: string;
  readonly internalStatus: string;
  readonly clientStatus: string;
  readonly assignee: string | null;
  readonly priority: string | null;
  readonly designFileUrl: string | null;
  readonly inspoLinks: readonly string[];
}

/** One loaded row, resolved once on the server into what the card draws. */
export function clientQueueItem(row: ClientQueueSourceRow, href: string): ClientQueueItem {
  return {
    id: row.id,
    name: row.name,
    internalStatus: row.internalStatus,
    clientStatus: row.clientStatus,
    assignee: row.assignee,
    priority: priorityView(row.priority),
    status: clientStatusView(row.clientStatus),
    thumbnail: briefThumbnail({
      name: row.name,
      designFileUrl: row.designFileUrl,
      inspoLinks: row.inspoLinks,
    }),
    href,
  };
}

/** Whether one card survives the current filter. `assignedToViewer` is the Internal Queue's. */
export function matchesClientQueueFilter(
  item: ClientQueueItem,
  filter: ClientQueueFilter,
  viewer: string,
): boolean {
  return filter.kind === 'mine' ? assignedToViewer(item.assignee, viewer) : true;
}

/** One column header, ready to render: the domain's own label and the tone that label earns. */
export interface ClientQueueColumnView {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly tone: ChipTone;
}

/** A column entry from `clientQueueColumns()` with its chip tone attached. Nothing is renamed. */
export function clientQueueColumnView(entry: StatusEntry): ClientQueueColumnView {
  return {
    key: entry.key,
    label: entry.label,
    description: entry.description,
    tone: chipTone(entry.label),
  };
}

/** How the header counts what is on the board. Singular at one, never "1 creatives". */
export function clientQueueCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'creative' : 'creatives'}`;
}

/** The count line while a filter is narrowing the board, so "3 creatives" never contradicts 1 card. */
export function filteredClientQueueCountLabel(visible: number, total: number): string {
  return `${String(Math.max(Math.floor(visible), 0))} of ${clientQueueCountLabel(total)}`;
}

/**
 * One of the two write controls, with the `data-slot` its board renders it under.
 *
 * The label and the description are `CLIENT_QUEUE_ACTIONS`', never retyped: the button that says
 * "Approve" and the Server Action that moves the row to `approved` read the same row of the same
 * table, so a control cannot drift from what it actually does. The slot is the only thing this
 * module adds, because a test handle is a page concern and not a domain one.
 */
export interface ClientQueueControl {
  readonly key: ClientQueueActionKey;
  readonly label: string;
  readonly description: string;
  readonly slot: string;
}

const CONTROL_SLOTS: Readonly<Record<ClientQueueActionKey, string>> = {
  approve: 'client-queue-approve',
  request_revisions: 'client-queue-request-revisions',
};

/** Both controls, in `CLIENT_QUEUE_ACTIONS` order, so the card renders them left to right as listed. */
export const CLIENT_QUEUE_CONTROLS: readonly ClientQueueControl[] = CLIENT_QUEUE_ACTIONS.map(
  (action) => ({
    key: action.key,
    label: action.label,
    description: action.description,
    slot: CONTROL_SLOTS[action.key],
  }),
);

/**
 * The control for a key. Total over `ClientQueueActionKey` by construction — `CLIENT_QUEUE_CONTROLS`
 * is built from the domain's own table — and the throw is the unreachable branch a type cannot
 * express, never a runtime path a user reaches.
 */
export function clientQueueControl(key: ClientQueueActionKey): ClientQueueControl {
  const found = CLIENT_QUEUE_CONTROLS.find((control) => control.key === key);
  if (found === undefined) {
    throw new Error(`no client queue control for ${key}`);
  }
  return found;
}

/**
 * The controls ONE card may draw: the domain's `clientQueueActionsFor` for the row's own statuses,
 * mapped to their slots. Never the whole table.
 *
 * A button whose move the state machine refuses cannot succeed, so drawing it is drawing a lie — the
 * client presses Approve on something they already approved and gets an error that reads like a bug.
 * The decision of WHICH moves are legal is the domain's; this function only attaches the `data-slot`
 * each one is tested by, which is the same split `CLIENT_QUEUE_CONTROLS` already makes.
 */
export function clientQueueControlsFor(item: ClientQueueItem): readonly ClientQueueControl[] {
  return clientQueueActionsFor(item.internalStatus, item.clientStatus).map((action) =>
    clientQueueControl(action.key),
  );
}

/** The subtitle under the heading. */
export const CLIENT_QUEUE_INTRO_NOTE =
  'Every creative waiting on the client, by where it sits on their track. Internal status is team-only and never appears here.';

/**
 * PRD §9's rule, in words, under the heading. The board is deliberately smaller than the Creative
 * Briefs list, and a page that is smaller than the data without saying why reads as broken.
 */
export const CLIENT_QUEUE_RULE_NOTE =
  'A creative reaches this board only once its internal status is Approved, and it leaves again once it is Launched.';

/**
 * Why the board is short (ticket criterion 5), counted from what the loader withheld rather than
 * from rows this page never receives. Silent when nothing is being held back, because a line that
 * says "0 creatives are waiting" is noise.
 */
export function withheldNote(withheld: number, total: number): string | null {
  if (withheld <= 0) {
    return null;
  }
  const verb = withheld === 1 ? 'is' : 'are';
  return `${String(withheld)} of the ${clientQueueCountLabel(total)} in this workspace ${verb} not here yet: internal sign-off gates this board, so they stay on the Internal Queue until the team marks them Approved.`;
}

/** A column with nothing in it. It keeps its place; the work that is not moving stays visible. */
export const EMPTY_COLUMN_NOTE = 'Nothing here';

/** The default filter's label. A constant so the button and the empty state's way out agree. */
export const ALL_FILTER_LABEL = 'All';

/**
 * The "Mine" option, naming the viewer. The board must never imply whose queue it is showing: in
 * demo mode there is no session, so "Mine" is a seeded team member and the label says so.
 */
export function mineFilterLabel(viewer: string): string {
  const name = viewer.trim();
  return name === '' ? 'Mine' : `Mine · ${name}`;
}

/**
 * The empty state's two sentences, which say different things and must never be collapsed into one.
 * A board with nothing on it at all is a different problem from a filter that matched nothing, and
 * they have different ways out.
 */
export const NO_CLIENT_WORK_NOTE =
  'Nothing is waiting on the client right now. Creatives arrive here on their own the moment the internal track approves them — there is nothing to do to fill this board.';

/** What "Mine" says when the viewer genuinely owns nothing here. A legitimate state, not an error. */
export function noMineNote(viewer: string): string {
  const name = viewer.trim();
  return name === ''
    ? 'Nothing on the client track is assigned to you right now.'
    : `Nothing on the client track is assigned to ${name} right now. That is an empty filter, not a missing board.`;
}

/** The empty state's way back, and the label of the button that takes it. */
export const SHOW_ALL_LABEL = 'Show every creative';

/** Where a genuinely empty board points instead: the queue the creatives are still sitting on. */
export const OPEN_INTERNAL_QUEUE_LABEL = 'Go to Internal Queue';

/** What a card says once a write has landed, so a save is visible without a reload. */
export const SAVED_NOTE = 'Saved';

/**
 * What a card says instead of buttons when the client track has no move open from where the creative
 * sits — it is already approved, or it is back with the team for changes. One sentence, because a
 * card with an empty control row and no explanation reads as a component that failed to render.
 */
export const NO_CLIENT_DECISION_NOTE = 'No decision is open on this creative right now.';
