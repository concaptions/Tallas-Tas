import {
  CLIENT_STATUS,
  canSubmitToClient,
  chipTone,
  EDITOR_STAGES,
  INTERNAL_ENTRY_STATUS,
  INTERNAL_STATUS,
  qaProgressLabel,
  type BriefQaTicks,
  type ChipTone,
  type CreativeTrack,
} from '@tas/domain/state';

import type {
  CreativeSheetCheck,
  CreativeSheetFieldName,
  CreativeSheetKanbanField,
  CreativeSheetStatusField,
} from './actions';
import type { SheetItemView } from './creative-sheet-workspace';

/**
 * How the Creative Sheet route presents what it stores. One module, so the grid, the board, the
 * panel and the `/design-system` story cannot drift: every label, every chip tone, the em dash and
 * the checkbox wording are stated exactly once.
 *
 * Nothing here invents a vocabulary. Since the single-source cutover (2026-10-09) a sheet row IS a
 * brief, so the two selects are the two tracks of the state machine in `@tas/domain/state`:
 * `INTERNAL_STATUS` (one list for both creative tracks since the Oct 12 consolidation, Ticket 5 /
 * 0067) and `CLIENT_STATUS`. A component renders their LABELS and stores their KEYS, and never writes
 * `'ad_submitted'` or `'Approved'` itself. The sheet's own Airtable vocabularies are gone with the
 * frozen `creative_sheet_items` table.
 *
 * The field-name unions are re-exported from `actions.ts` rather than declared a second time: the
 * actions own the unions their zod schema validates. A type-only re-export is erased, so this
 * module stays importable from a client component.
 */
export type {
  CreativeSheetCheck,
  CreativeSheetFieldName,
  CreativeSheetKanbanField,
  CreativeSheetStatusField,
};

/** The dash an empty cell shows, so a null value is never just a gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';
/** The trailing board column for a stored status outside the vocabulary (an imported oddity). */
export const OTHER_COLUMN = 'Other';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** The record type a creative's comments are filed under — the table's name, as the client portal files them, so Focus Mode's Feedback panel shows the client's comments too. */
export const CREATIVE_COMMENT_RECORD_TYPE = 'creative_briefs';

/** The `?creative-sheet=` parameter the open row lives in, and the `?q=` the filter lives in. */
export const SELECTION_PARAM = 'creative-sheet';
export const SEARCH_PARAM = 'q';

/** One select value, ready to render: the stored key, its label and the chip tone it carries. */
export interface SheetStatusView {
  readonly key: string;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The two dropdowns' options, in vocabulary order, each already carrying its tone — the domain's
 * `chipTone(label)` for BOTH tracks (B6.V11, ruling 16). The sheet once kept its own key-based map
 * that drew Ad Submitted `accent` and Under Editing `info`, so the same brief wore one tone on the
 * sheet and another on its own page; board 6's rule ("everything else → mute") and the brief rail
 * are the one source now. A richer working-step tone, if ever wanted, is a domain function, never
 * a second map here.
 */
export const INTERNAL_STATUS_OPTIONS: readonly SheetStatusView[] = INTERNAL_STATUS.map((entry) => ({
  key: entry.key,
  label: entry.label,
  tone: chipTone(entry.label),
}));
export const STATUS_OPTIONS: readonly SheetStatusView[] = CLIENT_STATUS.map((entry) => ({
  key: entry.key,
  label: entry.label,
  tone: chipTone(entry.label),
}));

/**
 * The view of one stored key, or null for an unset select. Total on purpose: a key this build does
 * not list renders its own value in the muted tone rather than an empty cell.
 */
function viewOf(options: readonly SheetStatusView[], key: string | null): SheetStatusView | null {
  if (key === null) return null;
  return options.find((option) => option.key === key) ?? { key, label: key, tone: 'mute' };
}

export function internalStatusView(key: string | null): SheetStatusView | null {
  return viewOf(INTERNAL_STATUS_OPTIONS, key);
}

export function statusView(key: string | null): SheetStatusView | null {
  return viewOf(STATUS_OPTIONS, key);
}

/** One checkbox: the column it writes and the Airtable wording a strategist reads. */
export interface SheetCheckField {
  readonly name: CreativeSheetCheck;
  readonly label: string;
}

/** The three QA ticks, in the checklist's order — the grid's "QA" column shows exactly these. */
export const QA_CHECKS: readonly SheetCheckField[] = [
  { name: 'qaVideoEditor', label: 'Video Editor QA' },
  { name: 'qaDesigner', label: 'Graphic Designer QA' },
  { name: 'qaStrategist', label: 'Creative Strategist QA' },
];

/** The spell-check trigger, Airtable's "Click for AI Spell Checker Again". */
export const SPELL_CHECK_FIELD: SheetCheckField = {
  name: 'spellCheckRequested',
  label: 'Click for AI Spell Checker Again',
};

/** Every checkbox, flattened, so the panel's state and the hidden inputs are built from one list. */
export const SHEET_CHECKS: readonly SheetCheckField[] = [...QA_CHECKS, SPELL_CHECK_FIELD];

/** The labels of the non-checkbox fields, so the panel and the E2E assertion read one string. */
export const SHEET_LABELS = {
  internalStatus: 'Internal Status',
  status: 'Client Approval',
  qaChecklistDoc: 'QA Checklist Doc',
  spellingFeedback: 'Spelling Feedback',
  dimensions: 'Dimensions',
} as const;

/** The Dimensions field's add-select placeholder. */
export const DIMENSIONS_ADD_PLACEHOLDER = 'Add a ratio';

/**
 * What the Dimensions field says around its immediate save: it writes on every pick, with no Save
 * button in between, so the field itself reports where that write got to.
 */
export const DIMENSIONS_SAVE_LABELS = {
  hint: 'saves on pick',
  none: 'No ratios yet',
  pending: 'Saving…',
  saved: 'Saved',
} as const;

/**
 * The panel's six section headings, in order (decision 2, SHEET-02, B2.A4): the Dimensions picker
 * and the brief lookups live under Identity, the spell-check controls under QA.
 */
export const SHEET_GROUPS = {
  identity: 'Identity',
  approval: 'Status',
  content: 'Content',
  qa: 'QA',
  assets: 'Assets',
  meta: 'Meta',
} as const;

/**
 * The read-only lookups the panel lists under Identity, all read from the brief itself. Type and
 * Funnel are Identity rows already, so they are not repeated here (B2.A7).
 */
export const BRIEF_LOOKUP_LABELS = {
  briefPlatform: 'Platform',
  briefPerformance: 'Performance',
  briefDesignFileUrl: 'Design Link URL',
} as const;

/**
 * The asset row's mono sub-line (B2.V20): the file's own name when the field holds exactly one
 * link, else how many it holds. The name is the URL's last path segment, decoded, without a query
 * or fragment — the storage keys R2 and Airtable hand back are ordinary paths.
 */
export function assetSubline(urls: readonly string[]): string {
  const [only] = urls;
  if (only !== undefined && urls.length === 1) return fileBasename(only);
  return `${String(urls.length)} files`;
}

function fileBasename(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  const last =
    path
      .split('/')
      .filter((segment) => segment !== '')
      .at(-1) ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** The live gate line under the QA ticks (B4.A12): the progress sentence and whether the gate is open. */
export interface SheetQaGate {
  readonly label: string;
  readonly open: boolean;
}

/**
 * Read from the panel's LOCAL ticks, not the stored row, so the line moves as a tick is set and
 * before Save — the gate the action re-runs reads the ticks that same save stores, so ticking and
 * approving in one Save is legal and the line says so ahead of the round trip.
 */
export function sheetQaGate(track: CreativeTrack | null, ticks: BriefQaTicks): SheetQaGate {
  return { label: qaProgressLabel(track, ticks), open: canSubmitToClient(track, ticks) };
}

/** The checklist textarea's helper line. */
export const QA_DOC_HINT = 'One link per line.';

/** The checklist as the textarea shows it, and the inverse of the action's line parsing. */
export function joinUrlLines(urls: readonly string[] | null): string {
  return urls === null ? '' : urls.join('\n');
}

/** How the header counts what is on screen. Singular at one, never "1 rows". */
export function countLabel(total: number, visible: number): string {
  const noun = total === 1 ? 'row' : 'rows';
  return total === visible
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}

/** What the search reads: the generated name, the brief, and the two select LABELS. */
export interface SheetSearchable {
  readonly name: string;
  readonly briefName: string | null;
  readonly internalStatus: string | null;
  readonly status: string | null;
}

/** `query` arrives lowercased and trimmed; "denied" finds the row whose chip says Denied. */
export function matchesSearch(item: SheetSearchable, query: string): boolean {
  if (query === '') return true;
  return [
    item.name,
    item.briefName ?? '',
    internalStatusView(item.internalStatus)?.label ?? '',
    statusView(item.status)?.label ?? '',
  ].some((value) => value.toLowerCase().includes(query));
}

/** One Kanban column: the stored key (`''` for the unset column) and its header. */
export interface SheetKanbanColumn {
  readonly key: string;
  readonly label: string;
}

/**
 * The board's columns for a group-by field. For the two status tracks: the vocabulary in its own
 * order, empties kept, plus a trailing "Other" column so a brief whose stored status is outside the
 * vocabulary (an imported oddity) is on the board rather than silently gone. For the editor board:
 * exactly the three `EDITOR_STAGES`, in mapping order and nothing after them — a brief with no
 * stage is OFF the board, counted in one line, never a fourth column.
 */
export function kanbanColumnsFor(field: CreativeSheetKanbanField): readonly SheetKanbanColumn[] {
  if (field === 'editorStage') {
    return EDITOR_STAGES.map(({ key, label }) => ({ key, label }));
  }
  const options = field === 'internalStatus' ? INTERNAL_STATUS_OPTIONS : STATUS_OPTIONS;
  return [...options.map(({ key, label }) => ({ key, label })), { key: '', label: OTHER_COLUMN }];
}

/**
 * The view of the status track a card is grouped by, so the card's chip matches its column. The
 * editor board is not a status field: its cards are briefs, built by `editor-board.ts`.
 */
export function kanbanView(
  field: CreativeSheetStatusField,
  item: Pick<SheetSearchable, 'internalStatus' | 'status'>,
): SheetStatusView | null {
  return field === 'internalStatus'
    ? internalStatusView(item.internalStatus)
    : statusView(item.status);
}

/** The column a card lands in: its own key when the vocabulary has it, else the trailing Other. */
export function kanbanGroupValue(field: CreativeSheetStatusField, view: SheetStatusView | null) {
  if (view === null) return '';
  const options = field === 'internalStatus' ? INTERNAL_STATUS_OPTIONS : STATUS_OPTIONS;
  return options.some((option) => option.key === view.key) ? view.key : '';
}

/** True when the string names one of the two status tracks a drop writes on the brief. */
export function isSheetStatusField(value: string): value is CreativeSheetStatusField {
  return value === 'internalStatus' || value === 'status';
}

/** True when the string names one of the three groupable fields (`?groupBy=`). */
export function isKanbanField(value: string): value is CreativeSheetKanbanField {
  return isSheetStatusField(value) || value === 'editorStage';
}

/**
 * The board's cards with the drops the server has not confirmed yet applied (SMOKE-10,
 * 2026-10-10): a card dropped in another column moves THERE at once; the status write and the
 * `router.refresh()` that follows run in the background, and the override is dropped when fresh
 * rows arrive. Before this the board re-read every card from props, so a dropped card snapped back
 * to its old column and stayed there until the refresh landed — ten seconds on the production sheet.
 */
export function applyKanbanMoves<Card extends { readonly id: string; readonly groupValue: string }>(
  cards: readonly Card[],
  moves: Readonly<Record<string, string>>,
): readonly Card[] {
  return cards.map((card) => {
    const moved = moves[card.id];
    return moved === undefined || moved === card.groupValue ? card : { ...card, groupValue: moved };
  });
}

/** A creative the dialog has submitted and the sheet does not hold yet (SMOKE-14 / SMOKE-17). */
export interface PendingCreative {
  /** A provisional id until the server answers, then the real one. */
  readonly id: string;
  readonly name: string;
}

export const PENDING_ID_PREFIX = 'pending:';

/** The pending creative the moment the form is SUBMITTED — before the server has answered. */
export function pendingOnSubmit(previewName: string): PendingCreative {
  return { id: `${PENDING_ID_PREFIX}${previewName}`, name: previewName };
}

/** The pending creative once the server answered: the real id and the stored name. */
export function pendingOnCreated(created: PendingCreative): PendingCreative {
  return created;
}

/** The pending creative once rows arrived: gone when the rows carry its id, kept otherwise. */
export function pendingAfterRows(
  pending: PendingCreative | null,
  rowIds: readonly string[],
): PendingCreative | null {
  return pending !== null && rowIds.includes(pending.id) ? null : pending;
}

/**
 * The pending creative AS A GRID ROW (SMOKE-24): the sheet names the new creative in its own
 * first column within 500 ms of the submit, not only in the status line above the grid. The row
 * carries the creative name the dialog previewed, under the sheet's `Month-Name` spelling (the
 * same English UTC month `creativeSheetName` in `@tas/db` uses — a formatter, not a second table),
 * the two tracks at their starting states, and every lookup empty — exactly what the real row
 * will read as until the refresh brings it, at which point `rowsWithPendingCreative` drops it.
 */
const PENDING_MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });

export function pendingSheetRow(pending: PendingCreative, now: Date): SheetItemView {
  const name = `${PENDING_MONTH.format(now)}-${pending.name}`;
  return {
    item: {
      id: pending.id,
      brandId: '',
      briefId: pending.id,
      createdAt: now,
      updatedAt: now,
      legacyAirtableId: null,
      name,
      internalStatus: INTERNAL_ENTRY_STATUS,
      status: CLIENT_STATUS[0].key,
      qaChecklistDoc: null,
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
      spellCheckRequested: false,
      spellingFeedback: null,
      dimensions: [],
      briefName: pending.name,
      briefType: null,
      briefPlatform: [],
      briefFunnel: null,
      briefPerformance: null,
      briefDesignFileUrl: null,
      detail: {
        conceptId: null,
        angleId: null,
        productId: null,
        collectionId: null,
        batch: null,
        source: 'TAS',
        version: 1,
        briefNumber: null,
        nameMode: 'auto',
        priority: null,
        assignee: null,
        dueDate: null,
        briefToDesign: null,
        scriptContent: null,
        adContent: null,
        elementsTested: null,
        inspiration: null,
        offer: null,
        language: null,
        inspoLinks: [],
        inspirationImage: null,
        designFile: null,
        scriptAndBriefBreakdown: null,
        clientStatusNote: null,
        clientStatusUpdatedAt: null,
        launchedAt: null,
        createdBy: null,
        updatedBy: null,
      },
    },
    comments: [],
    lookups: {
      concept: null,
      performance: null,
      internalProduct: null,
      angle: null,
      conceptsFromAngle: null,
      elementsWeAreTesting: null,
      designFiles: [],
      designLinkUrl: null,
      platform: null,
      funnel: null,
      type: null,
      proposedCopy: null,
      creativeModule: null,
    },
    createdLabel: 'just now',
    createdTitle: now.toISOString(),
    updatedLabel: 'just now',
    updatedTitle: now.toISOString(),
  };
}

/** What the grid renders: the pending creative's row first, until the rows carry its id. */
export function rowsWithPendingCreative(
  pendingRow: SheetItemView | null,
  rows: readonly SheetItemView[],
): readonly SheetItemView[] {
  if (pendingRow === null || rows.some(({ item }) => item.id === pendingRow.item.id)) return rows;
  return [pendingRow, ...rows];
}
