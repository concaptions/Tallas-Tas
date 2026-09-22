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
 * Checks a draft.
 *
 * - Batch is required and must be one of `BATCHES` (B1…B20): it is the first segment of the name,
 *   and a batch outside the vocabulary would name a concept nothing can group.
 * - At least one angle is required, and at least one theme is required. A concept with neither is
 *   not a concept yet.
 * - Category is required and must be `New` or `Iteration`: the board and the filters treat it as a
 *   closed vocabulary, so a row outside it would be unreachable.
 * - Concept Style carries no rule: the style is often undecided while the pairing is being drafted.
 * - Every ad-inspiration entry that has any text in it must be an `http(s)` URL, exactly as on an
 *   angle. Blank rows are ignored, because the panel keeps an empty input at the bottom of the list.
 */
export function validateConceptDraft(draft: ConceptDraft): ConceptDraftValidation {
  const fieldErrors: Partial<Record<ConceptDraftField, string>> = {};

  const batch = draft.batch?.trim() ?? '';
  if (batch === '') {
    fieldErrors.batch = 'Pick the batch this concept belongs to.';
  } else if (!isBatch(batch)) {
    fieldErrors.batch = `A batch is one of B1 to B${String(BATCH_COUNT)}.`;
  }

  if (draft.angleIds.length === 0) {
    fieldErrors.angleIds = 'Pick at least one angle this concept is built on.';
  }

  if (draft.themeIds.length === 0) {
    fieldErrors.themeIds = 'Pick at least one theme this angle is paired with.';
  }

  const category = draft.category?.trim() ?? '';
  if (category === '') {
    fieldErrors.category = 'Pick whether this is new ground or an iteration.';
  } else if (!isConceptCategory(category)) {
    fieldErrors.category = `A concept is one of ${CONCEPT_CATEGORY_KEYS.join(', ')}.`;
  }

  const links = draft.adInspoLinks ?? [];
  const badLink = links.findIndex((entry) => entry.trim() !== '' && !isHttpUrl(entry.trim()));
  if (badLink !== -1) {
    fieldErrors.adInspoLinks = `Ad inspiration ${String(badLink + 1)} is not a valid link. Paste the full http(s) URL.`;
  }

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}
