import {
  CLIENT_STATUS,
  chipTone,
  EDITOR_STAGES,
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
  ON_HOLD,
  type ChipTone,
} from '@tas/domain/state';

import type {
  CreativeSheetCheck,
  CreativeSheetFieldName,
  CreativeSheetKanbanField,
  CreativeSheetStatusField,
} from './actions';

/**
 * How the Creative Sheet route presents what it stores. One module, so the grid, the board, the
 * panel and the `/design-system` story cannot drift: every label, every chip tone, the em dash and
 * the checkbox wording are stated exactly once.
 *
 * Nothing here invents a vocabulary. Since the single-source cutover (2026-10-09) a sheet row IS a
 * brief, so the two selects are the two tracks of the state machine in `@tas/domain/state`:
 * `INTERNAL_VIDEO_STATUS` / `INTERNAL_STATIC_STATUS` (plus the `ON_HOLD` branch) and
 * `CLIENT_STATUS`. A component renders their LABELS and stores their KEYS, and never writes
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
 * The tone of each internal status, keyed on the KEY: in-progress steps are `info`, a hold is
 * `warn`, a submission waiting on review is `accent`, the hand-offs rest at `mute`, Approved is
 * `ok` and Launched `accent`. Where the domain's `chipTone` has a rule for the label the two
 * agree, and `fields.test.ts` pins that.
 */
const INTERNAL_STATUS_TONE: Readonly<Record<string, ChipTone>> = {
  sent_to_designer: 'mute',
  sent_to_video_editor: 'mute',
  static_design_in_progress: 'info',
  video_editing_in_progress: 'info',
  on_hold: 'warn',
  ad_submitted: 'accent',
  approved: 'ok',
  images_revisions: 'warn',
  videos_revisions: 'warn',
  revisions_submitted: 'mute',
  launched: 'accent',
};

/**
 * Every internal status a brief can hold, both tracks merged in ladder order (the video track, then
 * the static track's own three steps) and the `on_hold` branch last; the panel narrows this to the
 * open row's own track.
 */
const INTERNAL_ENTRIES: readonly { readonly key: string; readonly label: string }[] = [
  ...INTERNAL_VIDEO_STATUS,
  ...INTERNAL_STATIC_STATUS,
  ON_HOLD,
].filter((entry, index, all) => all.findIndex((other) => other.key === entry.key) === index);

/** The two dropdowns' options, in vocabulary order, each already carrying its tone. */
export const INTERNAL_STATUS_OPTIONS: readonly SheetStatusView[] = INTERNAL_ENTRIES.map(
  (entry) => ({
    key: entry.key,
    label: entry.label,
    tone: INTERNAL_STATUS_TONE[entry.key] ?? 'mute',
  }),
);
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
  status: 'Status',
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

/** The panel's section headings, in order. */
export const SHEET_GROUPS = {
  creative: 'Creative',
  approval: 'Approval',
  qa: 'QA checklist',
  spelling: 'Spelling',
} as const;

/** The link from the panel's header to the creative's own page, where the rest is edited. */
export const OPEN_CREATIVE_LABEL = 'Open the creative’s page';

/** The read-only lookups the panel shows beneath the ratios, all read from the brief itself. */
export const BRIEF_LOOKUP_LABELS = {
  briefType: 'Type',
  briefPlatform: 'Platform',
  briefFunnel: 'Funnel',
  briefPerformance: 'Performance',
  briefDesignFileUrl: 'Design Link URL',
} as const;

/** The quiet line under the name: it is a formula, never an input. */
export const NAME_GENERATED_NOTE =
  'Generated from the month the creative was created and its name. Never typed.';

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
