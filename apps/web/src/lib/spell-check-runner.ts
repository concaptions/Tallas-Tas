import { updateBrief, type Db } from '@tas/db';

import { spellCheck, type SpellCheckOutcome } from './spell-check';

/**
 * The one place a brief's spelling is checked and stored, shared by the "Re-run AI spell check"
 * button (`spell-check-action.ts`) and the auto-fire on a Design File upload (`briefs/actions.ts`).
 * It reuses the existing `spellCheck` in `spell-check.ts` — the checker is TEXT-based (it reviews the
 * brief's copy: `script_content` + `brief_to_design`), not vision over the uploaded image; the
 * design-file upload is the TRIGGER, and the copy is what gets checked, exactly as Re-run does today.
 *
 * On success it overwrites `spelling_feedback`, so a fresh upload replaces the previous results. When
 * the checker cannot run — no `ANTHROPIC_API_KEY`, or the API is unreachable — it returns the failure
 * and writes NOTHING, so a save (or an upload) is never blocked or errored by a missing key.
 */

/** A brief's copy, as the spell checker reads it — the same two fields the Re-run button feeds. */
export interface BriefSpellCheckSubject {
  readonly id: string;
  readonly scriptContent: string | null;
  readonly briefToDesign: string | null;
}

/** The text the checker reviews: the script and the brief-to-design, blank parts dropped. */
export function briefSpellCheckText(brief: BriefSpellCheckSubject): string {
  return [brief.scriptContent, brief.briefToDesign].filter(Boolean).join('\n\n');
}

/**
 * True when `next` contains a design-file URL that `previous` did not — i.e. one was just uploaded.
 * A save that resubmits the same files (the dropzone always re-posts them as hidden inputs) is not a
 * new upload and must not re-fire the checker; nor may a change to another attachment field.
 */
export function hasNewDesignFile(
  previous: readonly string[] | null,
  next: readonly string[] | null,
): boolean {
  const before = new Set(previous ?? []);
  return (next ?? []).some((url) => !before.has(url));
}

/**
 * Runs the checker over a brief's copy and stores the result. Returns the outcome (so Re-run can show
 * it); persists `spelling_feedback` only when the check actually ran.
 */
export async function checkSpellingForBrief(
  db: Db,
  brandId: string,
  brief: BriefSpellCheckSubject,
  actorId: string,
): Promise<SpellCheckOutcome> {
  const result = await spellCheck(briefSpellCheckText(brief));
  if (result.ok) {
    await updateBrief(db, brandId, brief.id, { spellingFeedback: result.feedback }, actorId);
  }
  return result;
}

/** What the auto-fire needs to decide whether — and what — to check after a brief save. */
export interface DesignFileSpellCheckInput {
  readonly db: Db;
  readonly brandId: string;
  /** The just-saved brief (its `design_file` is the new value). */
  readonly brief: BriefSpellCheckSubject & { readonly designFile: readonly string[] | null };
  readonly actorId: string;
  /** The brief's `design_file` BEFORE this save, to tell a new upload from a resubmit. */
  readonly previousDesignFile: readonly string[] | null;
  /** Never auto-fire in demo mode (there is no key and no write). */
  readonly demo: boolean;
}

/**
 * The Design File auto-fire: after a brief is saved, if — and only if — a new design-file URL was
 * added (not in demo mode), check the brief's copy and store the result. Returns the outcome, or null
 * when nothing was checked. Best-effort by construction: `checkSpellingForBrief` swallows a missing
 * key into a returned failure, so the caller can ignore the result and the save still succeeds.
 */
export async function maybeSpellCheckDesignFile(
  input: DesignFileSpellCheckInput,
): Promise<SpellCheckOutcome | null> {
  if (input.demo || !hasNewDesignFile(input.previousDesignFile, input.brief.designFile)) {
    return null;
  }
  return checkSpellingForBrief(input.db, input.brandId, input.brief, input.actorId);
}
