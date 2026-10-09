import {
  creativeSheetInternalStatuses,
  creativeSheetStatuses,
  creativeSheetWinning,
  type CreativeSheetInternalStatusesKey,
  type CreativeSheetStatusesKey,
  type CreativeSheetWinningKey,
} from '@tas/db/schema';
import type { ChipTone } from '@tas/domain/state';

import type {
  CreativeSheetCheck,
  CreativeSheetFieldName,
  CreativeSheetKanbanField,
} from './actions';

/**
 * How the Creative Sheet route presents what it stores (Airtable `tblGC0TxnHI7lKaNQ`). One module,
 * so the grid, the board, the panel and the `/design-system` story cannot drift: every label, every
 * chip tone, the em dash and the checkbox wording are stated exactly once.
 *
 * Nothing here invents a vocabulary. The three selects come from `@tas/db/schema`
 * (`creativeSheetInternalStatuses`, `creativeSheetStatuses`, `creativeSheetWinning`): a component
 * renders their LABELS and stores their KEYS, and never writes `'ad_submitted'` or `'Denied'`.
 * The schema barrel is pure Drizzle table definitions (the same import `personas/fields.ts`
 * makes), so it is safe in a client bundle; `@tas/db` itself — the driver — is not imported here.
 *
 * The three field-name unions are re-exported from `actions.ts` rather than declared a second
 * time: the actions own the unions their zod schema validates. A type-only re-export is erased,
 * so this module stays importable from a client component.
 */
export type { CreativeSheetCheck, CreativeSheetFieldName, CreativeSheetKanbanField };

/** The dash an empty cell shows, so a null value is never just a gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** The `?creative-sheet=` parameter the open row lives in, and the `?q=` the filter lives in. */
export const SELECTION_PARAM = 'creative-sheet';
export const SEARCH_PARAM = 'q';

/** The `?creative-sheet=` value that means "the panel is open on a row that does not exist yet". */
export const NEW_ITEM = 'new';

/** One select value, ready to render: the stored key, its label and the chip tone it carries. */
export interface SheetStatusView {
  readonly key: string;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The tone of each Internal Status, keyed on the KEY. A local total map rather than
 * `chipTone(label)` because the sheet's vocabulary has words the domain's label map has no rule
 * for (in-progress and submitted steps all read as `mute` there); where a label IS one `chipTone`
 * rules on — Approved, the two Revisions, Revisions Submitted — the two agree, and
 * `fields.test.ts` pins that. In-progress steps are `info`, a hold is `warn`, a submission waiting
 * on review is `accent`, and the two hand-offs rest at `mute`.
 */
const INTERNAL_STATUS_TONE: Record<CreativeSheetInternalStatusesKey, ChipTone> = {
  sent_to_designer: 'mute',
  sent_to_video_editor: 'mute',
  static_design_in_progress: 'info',
  video_editing_in_progress: 'info',
  video_editing_on_hold: 'warn',
  ad_submitted: 'accent',
  design_submitted: 'accent',
  approved: 'ok',
  images_revisions: 'warn',
  videos_revisions: 'warn',
  revisions_submitted: 'mute',
};

/**
 * The tone of each client-facing Status. `denied` is `bad` — the sheet's one terminal refusal,
 * which `CLIENT_STATUS` does not carry and `chipTone` therefore has no word for; the rest agree
 * with the domain's reading of the same words.
 */
const STATUS_TONE: Record<CreativeSheetStatusesKey, ChipTone> = {
  pending_for_approval: 'info',
  approved: 'ok',
  launched: 'accent',
  revisions_needed: 'warn',
  denied: 'bad',
  revisions_submitted: 'mute',
};

const WINNING_TONE: Record<CreativeSheetWinningKey, ChipTone> = {
  best_performing: 'ok',
  average: 'mute',
};

function views<K extends string>(
  entries: readonly { readonly key: K; readonly label: string }[],
  tones: Record<K, ChipTone>,
): readonly SheetStatusView[] {
  return entries.map((entry) => ({ key: entry.key, label: entry.label, tone: tones[entry.key] }));
}

/** The three dropdowns' options, in vocabulary order, each already carrying its tone. */
export const INTERNAL_STATUS_OPTIONS = views(creativeSheetInternalStatuses, INTERNAL_STATUS_TONE);
export const STATUS_OPTIONS = views(creativeSheetStatuses, STATUS_TONE);
export const WINNING_OPTIONS = views(creativeSheetWinning, WINNING_TONE);

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

export function winningView(key: string | null): SheetStatusView | null {
  return viewOf(WINNING_OPTIONS, key);
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

/** The two client-side flags. */
export const TRACKING_CHECKS: readonly SheetCheckField[] = [
  { name: 'used', label: 'Used' },
  { name: 'deniedRevisionsNeeded', label: 'Denied / revisions needed' },
];

/** The spell-check trigger, Airtable's "Click for AI Spell Checker Again". */
export const SPELL_CHECK_FIELD: SheetCheckField = {
  name: 'spellCheckRequested',
  label: 'Click for AI Spell Checker Again',
};

/** Every checkbox, flattened, so the panel's state and the hidden inputs are built from one list. */
export const SHEET_CHECKS: readonly SheetCheckField[] = [
  ...QA_CHECKS,
  ...TRACKING_CHECKS,
  SPELL_CHECK_FIELD,
];

/** The labels of the non-checkbox fields, so the panel and the E2E assertion read one string. */
export const SHEET_LABELS = {
  briefId: 'Creative Name',
  internalStatus: 'Internal Status',
  status: 'Status',
  winning: 'Winning',
  clientComments: "Client's Comments",
  qaChecklistDoc: 'QA Checklist Doc',
  spellingFeedback: 'Spelling Feedback',
  dimensions: 'Dimensions',
} as const;

/** What a row that has no id yet reads where the Dimensions field will be. */
export const DIMENSIONS_AFTER_SAVE_NOTE =
  'Dimensions can be picked once the row is saved; they start as the linked creative’s.';

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

/** The panel's section headings, in order. */
export const SHEET_GROUPS = {
  creative: 'Creative',
  approval: 'Approval',
  qa: 'QA checklist',
  client: 'Client',
  spelling: 'Spelling',
} as const;

/** The read-only lookups the panel shows under the brief picker, all joined by the query layer. */
export const BRIEF_LOOKUP_LABELS = {
  briefType: 'Type',
  briefPlatform: 'Platform',
  briefFunnel: 'Funnel',
  briefPerformance: 'Performance',
  briefDesignFileUrl: 'Design Link URL',
} as const;

/** The quiet line under the name: it is a formula, never an input. */
export const NAME_GENERATED_NOTE =
  'Generated from the month this row was created and the linked creative’s name. Never typed.';

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

/** What the search reads: the generated name, the brief, and the three select LABELS. */
export interface SheetSearchable {
  readonly name: string;
  readonly briefName: string | null;
  readonly internalStatus: string | null;
  readonly status: string | null;
  readonly winning: string | null;
}

/** `query` arrives lowercased and trimmed; "denied" finds the row whose chip says Denied. */
export function matchesSearch(item: SheetSearchable, query: string): boolean {
  if (query === '') return true;
  return [
    item.name,
    item.briefName ?? '',
    internalStatusView(item.internalStatus)?.label ?? '',
    statusView(item.status)?.label ?? '',
    winningView(item.winning)?.label ?? '',
  ].some((value) => value.toLowerCase().includes(query));
}

/** One Kanban column: the stored key (`''` for the unset column) and its header. */
export interface SheetKanbanColumn {
  readonly key: string;
  readonly label: string;
}

/**
 * The board's columns for a group-by field: the vocabulary in its own order, empties kept, plus a
 * trailing "Not set" column so a row with a NULL status is on the board rather than silently gone.
 */
export function kanbanColumnsFor(field: CreativeSheetKanbanField): readonly SheetKanbanColumn[] {
  const options = field === 'internalStatus' ? INTERNAL_STATUS_OPTIONS : STATUS_OPTIONS;
  return [...options.map(({ key, label }) => ({ key, label })), { key: '', label: NOT_SET }];
}

/** The view of the field a card is grouped by, so the card's chip matches its column. */
export function kanbanView(
  field: CreativeSheetKanbanField,
  item: Pick<SheetSearchable, 'internalStatus' | 'status'>,
): SheetStatusView | null {
  return field === 'internalStatus'
    ? internalStatusView(item.internalStatus)
    : statusView(item.status);
}

/** True when the string names one of the two groupable fields. */
export function isKanbanField(value: string): value is CreativeSheetKanbanField {
  return value === 'internalStatus' || value === 'status';
}
