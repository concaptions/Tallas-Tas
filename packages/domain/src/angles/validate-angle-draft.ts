/**
 * The rules for a saveable angle (PRD §5.6). One implementation, two callers: the panel disables its
 * save and shows the field messages from here, and the Server Action re-runs the same function
 * before it writes — because a disabled button is a courtesy, not a guarantee. Neither restates a
 * rule of its own.
 *
 * Pure: it reads a draft and returns messages. It never looks up a persona, never touches a
 * database and never throws.
 */

import { isHttpUrl } from './inspo-links';

/** What the panel holds while it is being edited. Optional fields are the ones with no rule yet. */
export interface AngleDraft {
  readonly name: string;
  /** `null` while nothing is chosen — the `<select>`'s "None" option. */
  readonly personaId: string | null;
  readonly formats: readonly string[];
  /** Raw pasted strings. A blank row is an empty input, not a broken link. */
  readonly adInspoLinks: readonly string[];
}

export type AngleDraftField = keyof AngleDraft;

export interface AngleDraftValidation {
  readonly ok: boolean;
  /** Field → the one message to render under it. Empty when `ok`. */
  readonly fieldErrors: Readonly<Partial<Record<AngleDraftField, string>>>;
}

/** Shortest name that still reads as a name. Below this a save is almost certainly a slip. */
export const ANGLE_NAME_MIN_LENGTH = 2;

/**
 * Checks a draft.
 *
 * - Name is required and needs at least two characters once trimmed.
 * - Persona is required: an angle is a hypothesis *about somebody* (PRD §5.4). Product stays
 *   nullable, so it carries no rule.
 * - At least one format, otherwise nothing can be briefed from the angle.
 * - Every ad-inspiration entry that has any text in it must be an `http(s)` URL. Blank rows are
 *   ignored, because the panel keeps an empty input at the bottom of the list.
 */
export function validateAngleDraft(draft: AngleDraft): AngleDraftValidation {
  const fieldErrors: Partial<Record<AngleDraftField, string>> = {};

  const name = draft.name.trim();
  if (name === '') {
    fieldErrors.name = 'An angle needs a name.';
  } else if (name.length < ANGLE_NAME_MIN_LENGTH) {
    fieldErrors.name = `An angle name needs at least ${String(ANGLE_NAME_MIN_LENGTH)} characters.`;
  }

  if (draft.personaId === null || draft.personaId.trim() === '') {
    fieldErrors.personaId = 'Pick the persona this angle is written from.';
  }

  if (draft.formats.length === 0) {
    fieldErrors.formats = 'Pick at least one format to create.';
  }

  const badLink = draft.adInspoLinks.findIndex(
    (entry) => entry.trim() !== '' && !isHttpUrl(entry.trim()),
  );
  if (badLink !== -1) {
    fieldErrors.adInspoLinks = `Ad inspiration ${String(badLink + 1)} is not a valid link. Paste the full http(s) URL.`;
  }

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}
