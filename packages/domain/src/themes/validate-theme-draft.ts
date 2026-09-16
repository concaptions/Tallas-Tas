/**
 * The rules for a saveable theme (PRD §5.5). One implementation, two callers: the New theme dialog
 * disables its save and shows the field messages from here, and `createTheme` re-runs the same
 * function before it writes — because a disabled button is a courtesy, not a guarantee. Neither
 * restates a rule of its own.
 *
 * A theme name is the one name in the platform a strategist types (non-negotiable 4 covers
 * *generated* names: a concept is Batch-Angle-Theme, and the Theme half has to have been named by
 * a human for that formula to have anything to read), so the name rule lives here rather than a
 * naming formula living here.
 *
 * Pure: it reads a draft and returns messages. It never looks up a theme, never touches a database
 * and never throws.
 */

import { isHttpUrl } from '../angles/inspo-links';
import { THEME_CATEGORY_KEYS, isThemeCategory } from './vocabulary';

/** What the dialog holds while it is being filled in. Fields with no rule are not here. */
export interface ThemeDraft {
  readonly name: string;
  /** `null` while nothing is chosen — the `<select>`'s empty option. */
  readonly category: string | null;
  /**
   * Raw reference URLs. Editing them is out of scope for this ticket, so the dialog leaves this
   * off entirely; the rule exists because the column already carries links from the seed and a
   * later caller must not be able to write a broken one.
   */
  readonly referenceLinks?: readonly string[];
}

export type ThemeDraftField = keyof ThemeDraft;

export interface ThemeDraftValidation {
  readonly ok: boolean;
  /** Field → the one message to render under it. Empty when `ok`. */
  readonly fieldErrors: Readonly<Partial<Record<ThemeDraftField, string>>>;
}

/** Shortest name that still reads as a name. Below this a save is almost certainly a slip. */
export const THEME_NAME_MIN_LENGTH = 2;

/**
 * Checks a draft.
 *
 * - Name is required and needs at least two characters once trimmed.
 * - Category is required and must be one of the three stored values: the grid's filter chips are a
 *   closed vocabulary, so a row outside it would be unreachable by every chip including "All"'s
 *   siblings.
 * - Every reference link that has any text in it must be an `http(s)` URL. Blank rows are ignored,
 *   the way the angle panel keeps an empty input at the bottom of its list.
 * - Notes carry no rule: a theme with no notes is a perfectly good theme.
 */
export function validateThemeDraft(draft: ThemeDraft): ThemeDraftValidation {
  const fieldErrors: Partial<Record<ThemeDraftField, string>> = {};

  const name = draft.name.trim();
  if (name === '') {
    fieldErrors.name = 'A theme needs a name.';
  } else if (name.length < THEME_NAME_MIN_LENGTH) {
    fieldErrors.name = `A theme name needs at least ${String(THEME_NAME_MIN_LENGTH)} characters.`;
  }

  const category = draft.category?.trim() ?? '';
  if (category === '') {
    fieldErrors.category = 'Pick the kind of theme this is.';
  } else if (!isThemeCategory(category)) {
    fieldErrors.category = `A theme is one of ${THEME_CATEGORY_KEYS.join(', ')}.`;
  }

  const links = draft.referenceLinks ?? [];
  const badLink = links.findIndex((entry) => entry.trim() !== '' && !isHttpUrl(entry.trim()));
  if (badLink !== -1) {
    fieldErrors.referenceLinks = `Reference link ${String(badLink + 1)} is not a valid link. Paste the full http(s) URL.`;
  }

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}
