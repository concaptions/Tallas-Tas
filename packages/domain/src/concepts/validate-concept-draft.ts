/**
 * The rules for a saveable concept (PRD §5.7). One implementation, two callers: the detail page
 * disables its save and shows the field messages from here, and the Server Action re-runs the same
 * function before it writes — because a disabled button is a courtesy, not a guarantee. Neither
 * restates a rule of its own.
 *
 * The rules exist because of the name. A concept IS the pairing of one Angle and one Theme, and its
 * name is `Batch-Angle-Theme` (PRD §7) — so a concept missing any of those three has no name to be
 * stored under, only the preview `conceptName` renders. That is why Batch, Angle and Theme are
 * required and why the hook examples, the script idea and the ad inspiration are not: those are
 * notes on a concept that already exists.
 *
 * WHICH fields are required is `CONCEPT_REQUIRED_FIELDS` below, and that list is the only one in
 * the repository. The form reads it to draw its markers instead of keeping a list of its own, so a
 * label cannot promise something the save does not enforce (action item 37).
 *
 * Pure: it reads a draft and returns messages. It never looks up an angle, never touches a database
 * and never throws.
 */

import { isHttpUrl } from '../angles/inspo-links';
import { BATCH_COUNT, CONCEPT_CATEGORY_KEYS, isBatch, isConceptCategory } from './vocabulary';

/** What the detail page holds while it is being edited. Fields with no rule are not here. */
export interface ConceptDraft {
  /** `null` while nothing is chosen — the Batch `<select>`'s empty option. */
  readonly batch: string | null;
  /** The angle(s) this concept is built on; at least one required. */
  readonly angleIds: readonly string[];
  /** The theme(s) this concept pairs with — the GLOBAL library, so no brand is involved. */
  readonly themeIds: readonly string[];
  readonly category: string | null;
  /**
   * Raw pasted ad-inspiration URLs. Optional because a draft that has not opened the field yet
   * carries no array at all; a blank row is an empty input, not a broken link.
   */
  readonly adInspoLinks?: readonly string[];
}

export type ConceptDraftField = keyof ConceptDraft;

export interface ConceptDraftValidation {
  readonly ok: boolean;
  /** Field → the one message to render under it. Empty when `ok`. */
  readonly fieldErrors: Readonly<Partial<Record<ConceptDraftField, string>>>;
}

/**
 * The fields a concept cannot be saved without, in the order the form lays them out (action item 36
 * and 37, Talal 2026-09-28). THIS LIST IS THE ONLY ONE: the form marks a field required by asking
 * `isConceptFieldRequired`, so a form cannot mark a field the validator lets through, and a field
 * added here starts being marked without the form being edited. A `Record<ConceptRequiredField, …>`
 * in the UI then fails to compile until that new field is given a label, which is what stops the
 * marker and the rule from drifting apart.
 *
 * Batch, Angle and Theme are here because they are the three segments of the generated name
 * (PRD §7): a concept missing one of them has no name to be stored under. Category is here because
 * the board and the filters treat it as a closed vocabulary, so a row without one is unreachable.
 */
export const CONCEPT_REQUIRED_FIELDS = ['batch', 'angleIds', 'themeIds', 'category'] as const;

export type ConceptRequiredField = (typeof CONCEPT_REQUIRED_FIELDS)[number];

/** The message a required field shows while it is still empty. */
const REQUIRED_MESSAGES: Readonly<Record<ConceptRequiredField, string>> = {
  batch: 'Pick the batch this concept belongs to.',
  angleIds: 'Pick at least one angle this concept is built on.',
  themeIds: 'Pick at least one theme this angle is paired with.',
  category: 'Pick whether this is new ground or an iteration.',
};

/** Whether the draft has nothing in that field yet. Whitespace counts as nothing. */
function isUnset(draft: ConceptDraft, field: ConceptRequiredField): boolean {
  switch (field) {
    case 'batch':
      return (draft.batch?.trim() ?? '') === '';
    case 'category':
      return (draft.category?.trim() ?? '') === '';
    case 'angleIds':
      return draft.angleIds.length === 0;
    case 'themeIds':
      return draft.themeIds.length === 0;
  }
}

/** Whether a field carries the "cannot be left empty" rule — what the form marks. */
export function isConceptFieldRequired(field: string): field is ConceptRequiredField {
  return (CONCEPT_REQUIRED_FIELDS as readonly string[]).includes(field);
}

/**
 * The required fields still empty in this draft, in `CONCEPT_REQUIRED_FIELDS` order.
 *
 * The form blocks its submit on this rather than on a list of its own, so "which fields are
 * required" is decided here and nowhere else. It answers only about emptiness: a batch outside
 * B1…B20 is a *wrong value*, not a missing one, and `validateConceptDraft` is what reports that.
 */
export function missingRequiredConceptFields(draft: ConceptDraft): readonly ConceptRequiredField[] {
  return CONCEPT_REQUIRED_FIELDS.filter((field) => isUnset(draft, field));
}

/**
 * Checks a draft.
 *
 * - Every field in `CONCEPT_REQUIRED_FIELDS` must be filled, each with its own message above.
 * - Batch must be one of `BATCHES` (B1…B20): a batch outside the vocabulary would name a concept
 *   nothing can group.
 * - Category must be `New` or `Iteration`: the board and the filters treat it as a closed
 *   vocabulary, so a row outside it would be unreachable.
 * - Concept Style carries no rule: the style is often undecided while the pairing is being drafted.
 * - Every ad-inspiration entry that has any text in it must be an `http(s)` URL, exactly as on an
 *   angle. Blank rows are ignored, because the panel keeps an empty input at the bottom of the list.
 */
export function validateConceptDraft(draft: ConceptDraft): ConceptDraftValidation {
  const fieldErrors: Partial<Record<ConceptDraftField, string>> = {};

  for (const field of missingRequiredConceptFields(draft)) {
    fieldErrors[field] = REQUIRED_MESSAGES[field];
  }

  const batch = draft.batch?.trim() ?? '';
  if (fieldErrors.batch === undefined && !isBatch(batch)) {
    fieldErrors.batch = `A batch is one of B1 to B${String(BATCH_COUNT)}.`;
  }

  const category = draft.category?.trim() ?? '';
  if (fieldErrors.category === undefined && !isConceptCategory(category)) {
    fieldErrors.category = `A concept is one of ${CONCEPT_CATEGORY_KEYS.join(', ')}.`;
  }

  const links = draft.adInspoLinks ?? [];
  const badLink = links.findIndex((entry) => entry.trim() !== '' && !isHttpUrl(entry.trim()));
  if (badLink !== -1) {
    fieldErrors.adInspoLinks = `Ad inspiration ${String(badLink + 1)} is not a valid link. Paste the full http(s) URL.`;
  }

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}
