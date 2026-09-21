/**
 * The rules for a saveable copy row (PRD §5.11). One implementation, two callers: the detail panel
 * disables its save and shows the field messages from here, and the Server Action re-runs the same
 * function before it writes — because a disabled button is a courtesy, not a guarantee. Neither
 * restates a rule of its own.
 *
 * There are only three blocking rules, and the shortness is the point. "Keep this table lean": a
 * copy row is a headline plus three optional pieces of text around it, so the only things that can
 * make it unsaveable are the headline itself and the two closed vocabularies the row stores keys
 * from. Everything else is guidance:
 *
 *  - The character limits are tildes in the PRD (Meta truncates past them, it does not reject), so
 *    an over-long field comes back as a typed WARNING with the exact overage and leaves `ok` true.
 *    A copywriter who wants 130 characters of Primary Copy gets 130 characters and a counter that
 *    says so; nothing here silently truncates their words.
 *  - Linked Creative carries no rule at all. `creative_brief_id` is nullable on purpose (CLAUDE.md
 *    non-negotiable 5): copy is routinely written before anyone picks the static it runs on.
 *  - Client's Comment carries no rule: the client writes it, not us.
 *
 * Pure: it reads a draft and returns messages. It never looks up a brief, never touches a database
 * and never throws.
 */

import { COPY_STATUS_KEYS, isCopyStatus } from '../state/copy-status';
import {
  COPY_FIELD_LABELS,
  COPY_LIMITS,
  COPY_LIMIT_FIELDS,
  overBy,
  type CopyLimitField,
} from './limits';
import { COPY_CTA_KEYS, isCopyCta } from './vocabulary';

/** What the panel holds while it is being edited. The nullable fields are nullable columns. */
export interface CopyDraft {
  readonly primaryCopy: string | null;
  readonly headline: string | null;
  readonly linkDescription: string | null;
  /** A `COPY_CTAS` key — the panel's `<select>`, never free text. */
  readonly cta: string;
  /** A `COPY_STATUS` key. */
  readonly status: string;
  /** `null` is the "No creative" option, and a legitimate saved value. */
  readonly creativeBriefId: string | null;
  /** `null` is the "No concept" option, and a legitimate saved value. */
  readonly conceptId: string | null;
}

export type CopyDraftField = keyof CopyDraft;

export interface CopyDraftValidation {
  /** `true` when nothing BLOCKS the save. Length warnings never move it. */
  readonly ok: boolean;
  /** Field → the one message to render under it. Empty when `ok`. */
  readonly fieldErrors: Readonly<Partial<Record<CopyDraftField, string>>>;
  /** Field → the one non-blocking message to render under it, for a field past its guidance. */
  readonly fieldWarnings: Readonly<Partial<Record<CopyLimitField, string>>>;
  /** Field → how many characters past its limit, for the counter that is already on screen. */
  readonly overLimits: Readonly<Partial<Record<CopyLimitField, number>>>;
}

/** Shortest headline that still reads as a headline. Below this a save is almost certainly a slip. */
export const COPY_HEADLINE_MIN_LENGTH = 2;

function text(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/**
 * Checks a draft.
 *
 * - Headline is required and needs at least two characters once trimmed. It is the one field that is
 *   always rendered wherever the ad appears, and a row without one has nothing to review.
 * - Status is required and must be one of `COPY_STATUS`. The column is plain `text` carrying a key,
 *   so a value outside the vocabulary would render as a chip nothing can tone and sit in a state no
 *   transition leads out of.
 * - CTA is required and must be one of `COPY_CTAS`, for the same reason: it is a closed vocabulary
 *   with a `pgEnum` behind it.
 * - Primary Copy and the Link Description carry no requirement, only their guidance.
 */
export function validateCopyDraft(draft: CopyDraft): CopyDraftValidation {
  const fieldErrors: Partial<Record<CopyDraftField, string>> = {};

  const headline = text(draft.headline);
  if (headline === '') {
    fieldErrors.headline = 'A copy row needs a headline.';
  } else if (headline.length < COPY_HEADLINE_MIN_LENGTH) {
    fieldErrors.headline = `A headline needs at least ${String(COPY_HEADLINE_MIN_LENGTH)} characters.`;
  }

  const status = text(draft.status);
  if (status === '') {
    fieldErrors.status = 'Pick the status this copy is in.';
  } else if (!isCopyStatus(status)) {
    fieldErrors.status = `A copy status is one of ${COPY_STATUS_KEYS.join(', ')}.`;
  }

  const cta = text(draft.cta);
  if (cta === '') {
    fieldErrors.cta = 'Pick the call to action this copy runs with.';
  } else if (!isCopyCta(cta)) {
    fieldErrors.cta = `A CTA is one of ${COPY_CTA_KEYS.join(', ')}.`;
  }

  const fieldWarnings: Partial<Record<CopyLimitField, string>> = {};
  const overLimits: Partial<Record<CopyLimitField, number>> = {};

  for (const field of COPY_LIMIT_FIELDS) {
    const over = overBy(draft[field], COPY_LIMITS[field]);
    if (over > 0) {
      overLimits[field] = over;
      fieldWarnings[field] =
        `${COPY_FIELD_LABELS[field]} is ${String(over)} character${over === 1 ? '' : 's'} over the ~${String(COPY_LIMITS[field])} guide. It will be cut short in the feed.`;
    }
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    fieldWarnings,
    overLimits,
  };
}
