import { briefThumbnail, type BriefThumbnail } from '@tas/domain/creatives';
import { chipTone, type ChipTone, type StatusEntry } from '@tas/domain/state';

import { priorityView, type BriefPriorityView } from '@/app/app/briefs/fields';

/**
 * How the Internal Queue presents what it reads (PRD §9, §13; ticket `internal-queue`).
 *
 * One module, so the board, the card and the `/design-system` preview cannot drift: the URL
 * vocabulary, the filter labels, the two different empty sentences and the read-only note are each
 * stated exactly once.
 *
 * NOTHING HERE INVENTS A VOCABULARY. The columns, their order and their labels come from
 * `internalQueueColumns()` in `@tas/domain/state`; the chip tone from `chipTone`; the priority chip
 * from `priorityView` in the Creative Briefs route, imported and never re-implemented (criterion 4);
 * the thumbnail from `briefThumbnail` in `@tas/domain/creatives` (criterion 5). No component on this
 * route lists a status, compares one to a literal or orders them.
 *
 * `@tas/db` is deliberately absent: the board is a client component (the filter rewrites the address
 * with the History API and must not cost a server round trip), so a runtime import of that package
 * would drag the database driver into the browser bundle. Everything the client needs is handed down
 * from `page.tsx` as plain data.
 */

/** The dash an empty field shows, so a blank line is never just a gap. */
export const EM_DASH = '—';

/** The one URL parameter this board owns. `all` is the default and writes nothing. */
export const QUEUE_VIEW_PARAM = 'view';

/** `?view=brand:<brandId>`. The id follows the prefix verbatim. */
export const QUEUE_BRAND_VIEW_PREFIX = 'brand:';

/** `?view=mine`. */
export const QUEUE_MINE_VIEW = 'mine';

/**
 * The three things the filter can mean. A discriminated union rather than a bare string, so a
 * component can never read a brand id out of a view that has none.
 */
export type QueueView =
  | { readonly kind: 'all' }
  | { readonly kind: 'mine' }
  | { readonly kind: 'brand'; readonly brandId: string };

/** The default view: every brief on the board, and no parameter in the address. */
export const ALL_VIEW: QueueView = { kind: 'all' };

/**
 * The `?view=` parameter, parsed (criterion 7).
 *
 * TOTAL BY CONSTRUCTION: anything this build does not recognise — a missing parameter, a repeated
 * one, an empty `brand:`, a word from a later ticket, junk somebody typed into the address bar —
 * is the default `all` board rather than a throw or a blank page. A hand-edited URL is a thing that
 * happens, and it must never be able to break a read-only view.
 *
 * `mine` and the `brand:` prefix are matched case-insensitively because the address bar lowercases
 * nothing for the user, but the brand id itself is taken VERBATIM: it is a uuid the row carries, not
 * a word, and lowercasing an identifier is how a filter silently matches nothing.
 */
export function parseQueueView(param: string | readonly string[] | undefined): QueueView {
  const raw = typeof param === 'string' ? param : (param?.[0] ?? '');
  const value = raw.trim();
  const lower = value.toLowerCase();

  if (lower === QUEUE_MINE_VIEW) {
    return { kind: 'mine' };
  }
  if (lower.startsWith(QUEUE_BRAND_VIEW_PREFIX)) {
    const brandId = value.slice(QUEUE_BRAND_VIEW_PREFIX.length).trim();
    return brandId === '' ? ALL_VIEW : { kind: 'brand', brandId };
  }
  return ALL_VIEW;
}

/**
 * The parameter a view is written back as, or `null` for the default — which is deleted from the
 * address rather than written as `?view=all`, so the plain board has a clean, shareable URL.
 */
export function queueViewParam(view: QueueView): string | null {
  if (view.kind === 'mine') {
    return QUEUE_MINE_VIEW;
  }
  if (view.kind === 'brand') {
    return `${QUEUE_BRAND_VIEW_PREFIX}${view.brandId}`;
  }
  return null;
}

/** Two views are the same view. Used to mark the pressed filter button; no component compares parts. */
export function sameQueueView(a: QueueView, b: QueueView): boolean {
  return queueViewParam(a) === queueViewParam(b);
}

/**
 * Whether a brief belongs to the viewer (criterion 9).
 *
 * `creative_briefs.assignee` is a NAME, not a user id — there is no membership table behind the
 * board yet — so the comparison is trimmed and case-insensitive, which is the most a name comparison
 * can honestly promise. An unassigned brief belongs to nobody, and an empty viewer owns nothing:
 * both return false rather than matching everything, because a filter that silently widens is worse
 * than one that shows an empty board and says so.
 */
export function assignedToViewer(assignee: string | null | undefined, viewerName: string): boolean {
  const owner = (assignee ?? '').trim().toLowerCase();
  const viewer = viewerName.trim().toLowerCase();
  return owner !== '' && viewer !== '' && owner === viewer;
}

/** One brand the filter can narrow to, with the number of briefs actually behind it. */
export interface QueueBrandChoice {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

/**
 * One brief as the board renders it: everything a card shows, and nothing else. Built on the server
 * so the client component never imports `@tas/db` and never resolves a status, a tone or a tile
 * itself.
 */
export interface QueueItem {
  readonly id: string;
  /** The §7 generated name. Rendered in `font-mono` because it is system output (CLAUDE.md). */
  readonly name: string;
  /** The stored internal status. Read only by `groupByInternalStatus`; never compared here. */
  readonly internalStatus: string;
  readonly brandId: string;
  readonly assignee: string | null;
  /** `null` for a brief nobody has prioritised: the card shows no chip, never a blank pill. */
  readonly priority: BriefPriorityView | null;
  readonly thumbnail: BriefThumbnail;
  /** `briefPath(id)` — the whole card is a link to the real Creative Brief page. */
  readonly href: string;
}

/** The minimum a `BriefRow` has to carry for the board. Structural, so nothing is re-narrowed. */
export interface QueueSourceRow {
  readonly id: string;
  readonly name: string;
  readonly internalStatus: string;
  readonly brandId: string;
  readonly assignee: string | null;
  readonly priority: string | null;
  readonly designFileUrl: string | null;
  readonly inspoLinks: readonly string[];
}

/** One loaded row, resolved once on the server into what the card draws. */
export function queueItem(row: QueueSourceRow, href: string): QueueItem {
  return {
    id: row.id,
    name: row.name,
    internalStatus: row.internalStatus,
    brandId: row.brandId,
    assignee: row.assignee,
    priority: priorityView(row.priority),
    thumbnail: briefThumbnail({
      name: row.name,
      designFileUrl: row.designFileUrl,
      inspoLinks: row.inspoLinks,
    }),
    href,
  };
}

/** Whether one card survives the current filter. */
export function matchesQueueView(item: QueueItem, view: QueueView, viewer: string): boolean {
  if (view.kind === 'mine') {
    return assignedToViewer(item.assignee, viewer);
  }
  if (view.kind === 'brand') {
    return item.brandId === view.brandId;
  }
  return true;
}

/** One column header, ready to render: the domain's own label and the tone that label earns. */
export interface QueueColumnView {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly tone: ChipTone;
}

/** A column entry from `internalQueueColumns()` with its chip tone attached. Nothing is renamed. */
export function queueColumnView(entry: StatusEntry): QueueColumnView {
  return {
    key: entry.key,
    label: entry.label,
    description: entry.description,
    tone: chipTone(entry.label),
  };
}

/** How the header counts what is on the board. Singular at one, never "1 briefs". */
export function queueCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'brief' : 'briefs'}`;
}

/** The count line while a filter is narrowing the board, so "6 briefs" never contradicts 2 cards. */
export function filteredQueueCountLabel(visible: number, total: number): string {
  return `${String(Math.max(Math.floor(visible), 0))} of ${queueCountLabel(total)}`;
}

/** The "All" option. A constant so the button and the empty state's way out say the same word. */
export const ALL_VIEW_LABEL = 'All';

/**
 * The "Mine" option, naming the viewer (criterion 9). The board must never imply whose queue it is
 * showing: in demo mode there is no session, so "Mine" is a seeded team member and the label says so.
 */
export function mineViewLabel(viewer: string): string {
  const name = viewer.trim();
  return name === '' ? 'Mine' : `Mine · ${name}`;
}

/** A brand option, with the number of briefs behind it — criterion 8's "says so". */
export function brandViewLabel(choice: QueueBrandChoice): string {
  return `${choice.name} · ${String(choice.count)}`;
}

/** The quiet line above the board when there is exactly one brand to offer. */
export const ONE_BRAND_NOTE =
  'One brand in this workspace, so the brand filter offers only it. The switcher arrives with multi-brand.';

/**
 * Why this page has no buttons to disable (criterion 11). Stated in one quiet line rather than
 * rendered as a row of dead controls: a disabled "Advance" whose tooltip promises a save that was
 * never built is a worse lie than an honest sentence.
 */
export const READ_ONLY_NOTE =
  'Read-only board. Nothing here moves a brief: a status changes on the brief’s own page, where the transition lives.';

/** The subtitle under the heading. */
export const QUEUE_INTRO_NOTE =
  'Every creative on the internal track, by the stage it is actually sitting at. The client never sees this board.';

/** A column with nothing in it. It keeps its place; the work that is not moving stays visible. */
export const EMPTY_COLUMN_NOTE = 'Nothing here';

/**
 * The empty state's three sentences, which say different things and must never be collapsed into
 * one. A workspace with no briefs at all is offered the place briefs are made; a filter that matches
 * nothing is offered its way back, because those are different problems with different ways out.
 */
export const NO_BRIEFS_NOTE =
  'No creative briefs yet. The queue fills itself as briefs are created — every card here is a brief, and its name writes itself.';

/** What "Mine" says when the viewer genuinely owns nothing. A legitimate state, not an error. */
export function noMineNote(viewer: string): string {
  const name = viewer.trim();
  return name === ''
    ? 'Nothing is assigned to you right now.'
    : `Nothing is assigned to ${name} right now. That is an empty queue, not a missing board.`;
}

/** What a brand filter says when that brand has nothing on the internal track. */
export function noBrandNote(name: string): string {
  return `No briefs on the internal track for ${name} right now.`;
}

/** The empty state's way back, and the label of the button that takes it. */
export const SHOW_ALL_LABEL = 'Show all briefs';

/** Where the empty board points instead: the list the briefs themselves live on. */
export const OPEN_BRIEFS_LABEL = 'Go to Creative Briefs';

/** The sentence a card's empty assignee shows, so an unassigned brief reads as unassigned. */
export const UNASSIGNED_LABEL = 'Unassigned';
