/**
 * The three closed vocabularies a concept carries (PRD §5.7): the Batch it belongs to, its Category
 * and its Concept Style.
 *
 * `@tas/db` stores all three as plain `text` on `concepts` (`batch`, `category`, `concept_style`),
 * so this module owns the whole vocabulary — the allowed values, the fixed render order and the
 * human label. The keys are the stored values verbatim, exactly as `ANGLE_FORMATS` and
 * `THEME_CATEGORIES` do it, so a row read out of the database indexes straight into these tables
 * with no mapping layer in between and a `<select>` is just `CONCEPT_CATEGORIES.map(...)`.
 *
 * A component imports these constants and never writes `'Iteration'` or `'B2'` itself, exactly as
 * it never writes a status string. The fourth vocabulary a concept needs, Formats to create, is
 * `ANGLE_FORMATS` in `../angles/vocabulary`: the concept inherits the angle's format vocabulary
 * rather than owning a second copy of Static / Video / Carousel / Motion Graphic.
 *
 * None of this is a state. Category and Style are kinds, Batch is a grouping; the workflow states a
 * concept moves through live in `../state`, and nothing here participates in the state machine.
 */

export interface ConceptApprovalStatusEntry {
  readonly key: ConceptApprovalStatusKey;
  readonly label: string;
}

export const CONCEPT_APPROVAL_STATUSES = [
  { key: 'draft', label: 'Draft' },
  { key: 'pending_client', label: 'Pending Client' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'revision_needed', label: 'Revision Needed' },
] as const satisfies readonly { key: string; label: string }[];

export type ConceptApprovalStatusKey = (typeof CONCEPT_APPROVAL_STATUSES)[number]['key'];

export const CONCEPT_APPROVAL_STATUS_KEYS: readonly ConceptApprovalStatusKey[] =
  CONCEPT_APPROVAL_STATUSES.map((entry) => entry.key);

export function isConceptApprovalStatus(value: string): value is ConceptApprovalStatusKey {
  return CONCEPT_APPROVAL_STATUS_KEYS.includes(value as ConceptApprovalStatusKey);
}

export function conceptApprovalStatusLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return CONCEPT_APPROVAL_STATUSES.find((entry) => entry.key === value)?.label ?? value;
}

export interface ConceptProductionStatusEntry {
  readonly key: ConceptProductionStatusKey;
  readonly label: string;
}

export const CONCEPT_PRODUCTION_STATUSES = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'scripting', label: 'Scripting' },
  { key: 'filming', label: 'Filming' },
  { key: 'in_edit', label: 'In Edit' },
  { key: 'ready', label: 'Ready' },
] as const satisfies readonly { key: string; label: string }[];

export type ConceptProductionStatusKey = (typeof CONCEPT_PRODUCTION_STATUSES)[number]['key'];

export const CONCEPT_PRODUCTION_STATUS_KEYS: readonly ConceptProductionStatusKey[] =
  CONCEPT_PRODUCTION_STATUSES.map((entry) => entry.key);

export function isConceptProductionStatus(value: string): value is ConceptProductionStatusKey {
  return CONCEPT_PRODUCTION_STATUS_KEYS.includes(value as ConceptProductionStatusKey);
}

export function conceptProductionStatusLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return CONCEPT_PRODUCTION_STATUSES.find((entry) => entry.key === value)?.label ?? value;
}

export interface ConceptCategoryEntry {
  /** The value stored in `concepts.category`, verbatim. */
  readonly key: ConceptCategoryKey;
  readonly label: string;
}

export interface ConceptStyleEntry {
  /** The value stored in `concepts.concept_style`, verbatim. */
  readonly key: ConceptStyleKey;
  readonly label: string;
}

/**
 * B1 through B20 (PRD §5.7: "Batch — B1…B20"), written out rather than generated so the type is a
 * real union of twenty literals and a typo in a caller is a compile error, not a runtime miss. The
 * order is the dropdown's order: ascending, because a strategist reaches for the batch she is
 * currently briefing and batches are filled in order.
 */
export const BATCHES = [
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'B9',
  'B10',
  'B11',
  'B12',
  'B13',
  'B14',
  'B15',
  'B16',
  'B17',
  'B18',
  'B19',
  'B20',
] as const satisfies readonly string[];

export type BatchKey = (typeof BATCHES)[number];

/** How many batches the vocabulary holds. Exported so a test can check the list without retyping it. */
export const BATCH_COUNT = BATCHES.length;

/**
 * Is this concept new ground or another swing at something that already ran? Two values only
 * (PRD §5.7), and `New` is first because a fresh concept is overwhelmingly the common case.
 */
export const CONCEPT_CATEGORIES = [
  { key: 'New', label: 'New' },
  { key: 'Iteration', label: 'Iteration' },
] as const satisfies readonly { key: string; label: string }[];

export type ConceptCategoryKey = (typeof CONCEPT_CATEGORIES)[number]['key'];

/**
 * How the concept gets made (PRD §5.7). The order is the production order it implies: `Filming`
 * needs a creator and a shoot, `Editing` only needs existing footage, `AI Concept` needs neither.
 */
export const CONCEPT_STYLES = [
  { key: 'Filming', label: 'Filming' },
  { key: 'Editing', label: 'Editing' },
  { key: 'AI Concept', label: 'AI Concept' },
] as const satisfies readonly { key: string; label: string }[];

export type ConceptStyleKey = (typeof CONCEPT_STYLES)[number]['key'];

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const CONCEPT_CATEGORY_KEYS: readonly ConceptCategoryKey[] = CONCEPT_CATEGORIES.map(
  (entry) => entry.key,
);
export const CONCEPT_STYLE_KEYS: readonly ConceptStyleKey[] = CONCEPT_STYLES.map(
  (entry) => entry.key,
);

export function isBatch(value: string): value is BatchKey {
  return (BATCHES as readonly string[]).includes(value);
}

export function isConceptCategory(value: string): value is ConceptCategoryKey {
  return CONCEPT_CATEGORY_KEYS.includes(value as ConceptCategoryKey);
}

export function isConceptStyle(value: string): value is ConceptStyleKey {
  return CONCEPT_STYLE_KEYS.includes(value as ConceptStyleKey);
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function conceptCategoryEntry(value: string): ConceptCategoryEntry | undefined {
  return CONCEPT_CATEGORIES.find((entry) => entry.key === value);
}

export function conceptStyleEntry(value: string): ConceptStyleEntry | undefined {
  return CONCEPT_STYLES.find((entry) => entry.key === value);
}

/**
 * The human label for a stored category. Total on purpose, exactly as `themeCategoryLabel` is: a
 * row written by a newer build renders its own value back rather than an empty cell, so the page
 * never shows a blank where a label belongs.
 */
export function conceptCategoryLabel(value: string): string {
  return conceptCategoryEntry(value)?.label ?? value;
}

/** The human label for a stored concept style; total for the same reason as `conceptCategoryLabel`. */
export function conceptStyleLabel(value: string): string {
  return conceptStyleEntry(value)?.label ?? value;
}
