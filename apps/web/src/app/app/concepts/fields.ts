import {
  BATCHES,
  CONCEPT_APPROVAL_STATUSES,
  CONCEPT_CATEGORIES,
  CONCEPT_PRODUCTION_STATUSES,
  CONCEPT_STYLES,
  conceptApprovalStatusLabel,
  conceptProductionStatusLabel,
  INHERITED_ANGLE_FIELDS,
  type BatchKey,
  type ConceptApprovalStatusKey,
  type ConceptCategoryKey,
  type ConceptProductionStatusKey,
  type ConceptStyleKey,
} from '@tas/domain/concepts';
import { ANGLE_FORMATS, type AngleFormatEntry, type AngleFormatKey } from '@tas/domain/angles';
import {
  chipTone,
  internalStatusFor,
  type ChipTone,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';

import type { ConceptFieldName } from './actions';

/**
 * How the Concepts route presents what it stores (PRD §5.7). One module, so the table, the board,
 * the detail page and the `/design-system` preview cannot drift: the view vocabulary, the labels a
 * strategist reads, the "from Angle" caption, the em dash and the status-to-chip mapping are each
 * stated exactly once.
 *
 * Nothing here invents a vocabulary. `BATCHES`, `CONCEPT_CATEGORIES` and `CONCEPT_STYLES` come from
 * `@tas/domain/concepts`, the four formats from `@tas/domain/angles` (a concept shares the angle's
 * format list rather than owning a second copy of it), and every status label and chip tone from
 * `@tas/domain/state`. No component writes `'Iteration'`, `'B2'` or `'ad_submitted'`.
 *
 * `@tas/db` is deliberately absent: the workspace, the board and the detail form are client
 * components, and a runtime import of that package would drag the database driver into the browser
 * bundle. The one value that does live next to the database — which internal track a concept runs
 * on — is read once on the server (`CONCEPT_TRACK` in `@/lib/concepts-source`) and handed down as a
 * prop, which is why every function below takes the track rather than naming it.
 */
export type { ConceptFieldName };
export {
  BATCHES,
  CONCEPT_APPROVAL_STATUSES,
  CONCEPT_CATEGORIES,
  CONCEPT_PRODUCTION_STATUSES,
  CONCEPT_STYLES,
  conceptApprovalStatusLabel,
  conceptProductionStatusLabel,
  ANGLE_FORMATS,
  INHERITED_ANGLE_FIELDS,
};
export type {
  AngleFormatEntry,
  AngleFormatKey,
  BatchKey,
  ConceptApprovalStatusKey,
  ConceptCategoryKey,
  ConceptProductionStatusKey,
  ConceptStyleKey,
};

/** The dash an unlinked row or an empty field shows, so a blank cell is never just a gap. */
export const EM_DASH = '—';

/** The placeholder a `<select>` shows before anything is chosen. */
export const NOT_SET = 'Not set';

/** The `<select>` value that means "nothing chosen". Empty, never the string `'none'`. */
export const NONE_VALUE = '';

/** The caption over the five fields a concept reads off its angle (ticket criterion 8). */
export const FROM_ANGLE = 'from Angle';

/**
 * The one quiet line that explains why there is no name field. A concept's name is generated
 * (CLAUDE.md non-negotiable 6), so the page has to say so rather than leave a reader hunting for an
 * input that was deliberately never built.
 */
export const NAME_GENERATED_NOTE =
  'Generated from Batch, Angle and Theme. This name is never typed, and changes with its parts.';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/**
 * The `[conceptId]` segment that means "a concept that does not exist yet". A uuid can never be the
 * word `new`, so the create form and a real row can share one route.
 */
export const NEW_CONCEPT = 'new';

/** The two ways the list renders the same rows. Table is first because it is the default. */
export const CONCEPT_VIEWS = ['table', 'board'] as const;

export type ConceptView = (typeof CONCEPT_VIEWS)[number];

export interface ConceptViewOption {
  readonly value: ConceptView;
  readonly label: string;
}

/** The toggle's two controls, in order. */
export const CONCEPT_VIEW_OPTIONS: readonly ConceptViewOption[] = [
  { value: 'table', label: 'Table' },
  { value: 'board', label: 'Board' },
];

/** The URL parameter the view lives in, so nothing re-types the key. */
export const VIEW_PARAM = 'view';

/** The URL parameter the search lives in, the same `?q=` the Products, Angles and Themes pages use. */
export const SEARCH_PARAM = 'q';

/**
 * The view a `?view=` value asks for. Anything absent or unrecognised is the table, which is the
 * default the ticket fixes — so a stale link never lands a reader on a blank screen.
 */
export function conceptViewFromParam(value: string | null | undefined): ConceptView {
  return (CONCEPT_VIEWS as readonly string[]).includes(value ?? '')
    ? (value as ConceptView)
    : 'table';
}

/** One internal status, ready to render: the stored key, its label and the chip tone it carries. */
export interface ConceptStatusView {
  readonly key: InternalStatusKey;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * Every internal step of a track, in the order `internalStatusFor` returns — which is the order the
 * board's columns are in (ticket criterion 3). The tone is `chipTone` on the label, never a local
 * choice, so a status is the same colour in the table, on the board and on `/design-system`.
 */
export function internalStatusViews(track: CreativeTrack): readonly ConceptStatusView[] {
  return internalStatusFor(track).map((entry) => ({
    key: entry.key,
    label: entry.label,
    tone: chipTone(entry.label),
  }));
}

/**
 * The view of one stored status. Total on purpose: a key this build's track does not list renders
 * its own value in the muted tone rather than an empty cell, exactly as `conceptCategoryLabel` does.
 */
export function internalStatusView(
  track: CreativeTrack,
  key: InternalStatusKey,
): ConceptStatusView {
  return (
    internalStatusViews(track).find((entry) => entry.key === key) ?? {
      key,
      label: key,
      tone: 'mute',
    }
  );
}

/**
 * One concept as the list renders it: everything the table and the board show, and nothing else.
 *
 * Built on the server in `page.tsx` so the client components never import `@tas/db` and never
 * compute a status label of their own. `href` is `conceptPath(id)` — a real route segment, because
 * the detail is a page and not a panel (ticket criterion 5).
 */
export interface ConceptItem {
  readonly id: string;
  readonly name: string;
  readonly batch: string | null;
  readonly angleName: string | null;
  readonly themeName: string | null;
  readonly status: ConceptStatusView;
  readonly href: string;
}

/** The table's five columns, in the one order the ticket fixes. */
export const CONCEPT_COLUMNS = ['Name', 'Batch', 'Angle', 'Theme', 'Internal Status'] as const;

/** How the header counts what is on screen. Singular at one, never "1 concepts". */
export function conceptCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'concept' : 'concepts'}`;
}

/** The count line while the search is narrowing the list, so "4 concepts" never contradicts 1 row. */
export function filteredConceptCountLabel(visible: number, total: number): string {
  return `${String(Math.max(Math.floor(visible), 0))} of ${conceptCountLabel(total)}`;
}

/**
 * The search reads everything the table shows: the generated name, the batch, the two halves of
 * the pairing and the internal status LABEL — so "revisions" finds the row whose chip says
 * `Videos Revisions`, without this module ever writing that string.
 *
 * A plain substring match, exactly as the Angles table does it, rather than the word-start match
 * the Themes grid needs: a concept carries no prose here. Every field is a name, a batch code or a
 * status label, so there is no long note in which an accidental mid-word hit would leave a reader
 * unable to see why a row is on screen. `query` arrives already lowercased and trimmed.
 */
export function matchesQuery(item: ConceptItem, query: string): boolean {
  if (query === '') {
    return true;
  }
  return [
    item.name,
    item.batch ?? '',
    item.angleName ?? '',
    item.themeName ?? '',
    item.status.label,
  ].some((value) => value.toLowerCase().includes(query));
}

/**
 * The empty state's two sentences, which say different things and must never be collapsed into one.
 *
 * `NO_CONCEPTS_NOTE` is a brand with nothing in it yet, and its way out is to create the first
 * concept. `NO_MATCH_NOTE` is a pipeline that is full and a search that is too narrow, and its way
 * out is to clear the search — offering "New concept" there would answer a question nobody asked.
 */
export const NO_CONCEPTS_NOTE =
  'No concepts yet. Pair an angle with a theme and the name writes itself.';

export const NO_MATCH_NOTE = 'No concept matches this search. Clear it to see the whole pipeline.';

/** One board column: the status it heads and the rows that sit in it, already counted. */
export interface ConceptColumn {
  readonly status: ConceptStatusView;
  readonly items: readonly ConceptItem[];
}

/**
 * The rows grouped into one column per internal status, in track order and always all of them — an
 * empty column is a real statement about the pipeline, so it is kept and shown with its zero.
 */
export function conceptColumns(
  track: CreativeTrack,
  items: readonly ConceptItem[],
): readonly ConceptColumn[] {
  return internalStatusViews(track).map((status) => ({
    status,
    items: items.filter((item) => item.status.key === status.key),
  }));
}

/** The three parts of the generated name, as the detail page labels its three dropdowns. */
export const NAME_PART_LABELS = {
  batch: 'Batch',
  angleName: 'Angle',
  themeName: 'Theme',
} as const;

export interface ConceptFieldGroup {
  readonly heading: string;
  readonly note?: string;
}

/**
 * The detail page's three blocks, in this order: the pairing that names the concept, the five
 * fields it inherits from its angle, and the fields a strategist actually writes.
 */
export const CONCEPT_GROUPS: readonly ConceptFieldGroup[] = [
  { heading: 'Pairing', note: 'One angle, one theme. Together they name the concept.' },
  { heading: 'Inherited', note: 'Read-only. These come from the angle and change when it does.' },
  { heading: 'Brief', note: 'What the editor reads: how it is made, and what goes in it.' },
];

/** Just the headings, for the page's section list and for the E2E assertion. */
export const CONCEPT_GROUP_HEADINGS: readonly string[] = CONCEPT_GROUPS.map(
  (group) => group.heading,
);
