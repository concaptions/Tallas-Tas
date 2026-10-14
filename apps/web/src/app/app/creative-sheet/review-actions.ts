'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  briefBrandId,
  countActiveBriefComments,
  createBrief,
  findBriefAnnotationActor,
  findBriefCommentActor,
  getActiveBrandRole,
  getBriefById,
  getConceptById,
  insertActivity,
  insertBriefAnnotation,
  insertBriefComment,
  insertComment,
  listBriefsByIds,
  resolveUserIdByClerk,
  softDeleteBriefAnnotation,
  softDeleteBriefComment,
  softDeleteBriefs,
  updateBrief,
  updateBriefClientStatus,
  type BriefAnnotation,
  type BriefComment,
  type CreativeBrief,
  type Db,
} from '@tas/db';
import { diffFields } from '@tas/domain';
import { duplicateManualName, generateBriefName } from '@tas/domain/briefs';
import { conceptNameSegment } from '@tas/domain/creatives';
import {
  clientSubmissionTarget,
  INTERNAL_STATUS,
  internalMoveResetsQa,
  submitToClientRefusal,
  type InternalStatusKey,
} from '@tas/domain/state';
import {
  APPROVE_BRIEF_NOT_PERMITTED,
  REQUEST_CHANGES_NEEDS_COMMENT,
  REVIEW_BRIEF_NOT_PERMITTED,
  canApproveBrief,
  canReviewBrief,
  type ViewerRole,
} from '@tas/domain/team';
import { z } from 'zod';

import { currentActor } from '@/lib/actor';
import { withBrandScope } from '@/lib/creative-sheet-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { briefPath, creativeSheetPath } from '@/lib/routes';

import { duplicateValues } from './duplicate-values';
import { CREATIVE_COMMENT_RECORD_TYPE } from './fields';
import { BRIEF_ENTITY, GONE, moveBriefTrack } from './move-brief';
import { currentPosition, statusPatch, statusRefusal } from './status-guard';

/**
 * The Oct 12 client sync's writes on the Creative Sheet, beside `actions.ts`:
 *
 * - Focus Mode's three buttons (scopes 1 and 4): Request Changes, Approve and Submit to Client.
 *   Each is one track move through the same `status-guard.ts` checks the panel's save runs — the
 *   machine, the client gate, and the QA gate, which the Server Action RE-RUNS before it writes:
 *   a disabled button is a hint, not an authorisation boundary. Approve and Request Changes also
 *   run the Ticket 10 role gates (`canApproveBrief` / `canReviewBrief`) and the Request-Changes
 *   gate (`countActiveBriefComments >= 1` on the current submission version).
 * - Multi-select (scope 3): Duplicate, Change status and Delete over a selection, and the
 *   right-click menu's single-row versions of them.
 * - A comment on a creative (scope 1's Feedback panel), through the shared `comments` table AND
 *   through the brief-scoped `brief_comments` thread (Ticket 10).
 * - Ticket 10's annotation + comment writes on the brief-scoped tables: add/delete a pin, add a
 *   root comment or a reply, delete a comment the viewer wrote (or any if admin).
 *
 * Every action refuses in DEMO MODE first, then without a session; every write goes through the
 * scoped `@tas/db` writers; nothing throws to the client.
 */

export interface ReviewSuccess {
  readonly ok: true;
  readonly id: string;
  readonly internalStatus: string;
  readonly clientStatus: string;
  readonly savedAt: number;
}

export interface ReviewFailure {
  readonly ok: false;
  readonly error: string;
}

export type ReviewResult = ReviewSuccess | ReviewFailure;

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NOT_IDENTIFIED = 'This creative could not be identified.';
const NO_BRAND = 'This workspace has no brand yet.';
const SAVE_FAILED = 'The creative could not be saved. Try again.';
const NOTHING_SELECTED = 'Select at least one creative first.';
const NO_REVISION_STEP = 'This creative is not waiting on an internal review.';
const UNKNOWN_TRACK = 'That is not a status track.';
const UNKNOWN_BRIEF = 'That creative is no longer available.';
const UNKNOWN_ROW = 'That record is no longer available.';
const UNKNOWN_PARENT = 'That reply has no parent to attach to.';

interface Actor {
  readonly id: string;
  readonly name: string | null;
}

/** Who is writing: the Clerk id and the display name the activity log stores. */
async function writer(): Promise<Actor | null> {
  const { userId } = await auth();
  if (userId === null) return null;
  const { fullName } = await currentActor();
  return { id: userId, name: fullName };
}

/**
 * The viewer's role for the brief's brand, resolved from the Clerk id. `null` on the deny-by-default
 * branches — no row, no admin membership — so the two Ticket 10 predicates refuse.
 */
async function viewerRoleFor(
  db: Db,
  brandId: string,
  clerkUserId: string,
): Promise<ViewerRole | null> {
  return await getActiveBrandRole(db, brandId, clerkUserId);
}

function revalidateRow(id: string): void {
  revalidatePath(creativeSheetPath);
  revalidatePath(briefPath(id));
}

/** One brief's two tracks after a write, as every review action reports them. */
function reviewed(brief: CreativeBrief): ReviewSuccess {
  return {
    ok: true,
    id: brief.id,
    internalStatus: brief.internalStatus,
    clientStatus: brief.clientStatus,
    savedAt: Date.now(),
  };
}

/**
 * The one revision step of the internal track — `revisions_needed`, the same for both creative
 * tracks since the Oct 12 consolidation (Ticket 5 / 0067) — derived from the QA-reset rule the
 * write obeys, never typed.
 */
const REVISION_STEP: InternalStatusKey | null =
  INTERNAL_STATUS.find((entry) => internalMoveResetsQa(entry.key))?.key ?? null;

type Decision = { readonly ok: true; readonly saved: CreativeBrief } | ReviewFailure;

/** The shape of the three single-brief moves: refuse, load, decide and write, log, revalidate. */
async function reviewOne(
  id: string,
  decide: (db: Db, brandId: string, current: CreativeBrief, actor: Actor) => Promise<Decision>,
): Promise<ReviewResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  if (typeof id !== 'string' || id.trim() === '') return { ok: false, error: NOT_IDENTIFIED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getBriefById(db, brandId, id);
      if (current === null) return { ok: false as const, error: GONE };
      const result = await decide(db, brandId, current, actor);
      if (!result.ok) return result;
      await insertActivity(
        db,
        brandId,
        BRIEF_ENTITY,
        result.saved.id,
        diffFields(current, result.saved, [
          'internalStatus',
          'clientStatus',
          'qaVideoEditor',
          'qaDesigner',
          'qaStrategist',
        ]),
        actor,
      );
      return reviewed(result.saved);
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    if (outcome.ok) revalidateRow(outcome.id);
    return outcome;
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/**
 * Request Changes: the internal reviewer sends the cut back — `ad_submitted` /
 * `revisions_submitted` → `revisions_needed`. The three QA ticks are cleared in the same write
 * (scope 5). Ticket 10 adds TWO extra gates: the role must be a reviewer, and the current
 * submission must carry at least one comment (so the reviewer wrote down what they want changed
 * before the cut goes back).
 */
export async function requestChangesAction(id: string): Promise<ReviewResult> {
  return reviewOne(id, async (db, brandId, current, actor) => {
    const role = await viewerRoleFor(db, brandId, actor.id);
    if (!canReviewBrief(role)) return { ok: false, error: REVIEW_BRIEF_NOT_PERMITTED };
    const position = currentPosition(current);
    const target = REVISION_STEP;
    if (target === null) return { ok: false, error: NO_REVISION_STEP };
    const refusal = statusRefusal(position, target, position.client);
    if (refusal !== null) return { ok: false, error: refusal.message };
    // Ticket 10 lands before Ticket 11's brief_submissions table carries the version chip.
    // Until then, every write targets version 1 — the Focus Mode overlay and the comment panel
    // both file against the same number, so this gate matches what the viewer wrote.
    const version = 1;
    const comments = await countActiveBriefComments(db, current.id, version);
    if (comments < 1) return { ok: false, error: REQUEST_CHANGES_NEEDS_COMMENT };
    const saved = await updateBrief(
      db,
      brandId,
      current.id,
      statusPatch(position, target, position.client),
      actor.id,
    );
    return saved === null ? { ok: false, error: GONE } : { ok: true, saved };
  });
}

/**
 * Approve: internal sign-off, the step that OPENS the client track. First the Ticket 10 role gate
 * — only an admin or the assigned strategist (per the spec). The brief's `assignee` is a plain
 * text column holding the actor's full name, so the comparison today is name-based: an admin can
 * always approve, a strategist only when their current actor name equals `brief.assignee`.
 */
export async function approveBriefAction(id: string): Promise<ReviewResult> {
  return reviewOne(id, async (db, brandId, current, actor) => {
    const role = await viewerRoleFor(db, brandId, actor.id);
    if (!canApproveBrief(role, current.assignee, actor.name ?? '')) {
      return { ok: false, error: APPROVE_BRIEF_NOT_PERMITTED };
    }
    const position = currentPosition(current);
    const refusal = statusRefusal(position, 'approved', position.client);
    if (refusal !== null) return { ok: false, error: refusal.message };
    const saved = await updateBrief(
      db,
      brandId,
      current.id,
      statusPatch(position, 'approved', position.client),
      actor.id,
    );
    return saved === null ? { ok: false, error: GONE } : { ok: true, saved };
  });
}

/**
 * Submit to Client: both gates re-run here (`submitToClientRefusal`: the internal track first,
 * then QA), then the client-track resubmission the position allows — `revisions_needed` →
 * `revisions_submitted`. A creative already in the client's queue has nothing to submit.
 */
export async function submitToClientAction(id: string): Promise<ReviewResult> {
  return reviewOne(id, async (db, brandId, current, actor) => {
    const position = currentPosition(current);
    const reason = submitToClientRefusal(position);
    if (reason !== null) return { ok: false, error: reason };
    const target = clientSubmissionTarget(position.client);
    if (target === null) return { ok: false, error: 'This creative is already with the client.' };
    const saved = await updateBriefClientStatus(db, brandId, current.id, target, null, actor.id);
    return saved === null ? { ok: false, error: GONE } : { ok: true, saved };
  });
}

const idList = z.array(z.string().trim().min(1)).min(1);

export interface DuplicateSuccess {
  readonly ok: true;
  /** The copies, in the order of the ids given; an id that did not resolve is skipped. */
  readonly created: readonly { readonly id: string; readonly name: string }[];
  readonly skipped: number;
}

export type DuplicateResult = DuplicateSuccess | ReviewFailure;

/**
 * Duplicate (scope 3): one copy per selected creative, each created exactly as "New creative"
 * creates one — under the brand's number lock, named by the Oct 5 formula when the source is
 * auto-named (its concept's `Angle-Theme` segment, the new number) and by bumping the version
 * segment when the source's name is manual. `name_mode` stays as the source row had it.
 */
export async function duplicateCreativesAction(ids: readonly string[]): Promise<DuplicateResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const sources = await listBriefsByIds(db, brandId, parsed.data);
      const byId = new Map(sources.map((row) => [row.id, row]));
      const created: { id: string; name: string }[] = [];
      for (const id of parsed.data) {
        const source = byId.get(id);
        if (source === undefined) continue;
        const values = duplicateValues(source);
        const concept =
          source.conceptId === null ? null : await getConceptById(db, brandId, source.conceptId);
        const copy = await createBrief(
          db,
          brandId,
          values,
          (briefNumber) =>
            source.nameMode === 'manual'
              ? duplicateManualName(source.name, values.version ?? source.version + 1)
              : generateBriefName({
                  source: source.source,
                  funnel: source.funnel,
                  creativeType: source.type,
                  number: briefNumber,
                  concept: concept === null ? null : conceptNameSegment(concept),
                  batch: values.batch ?? null,
                }),
          source.nameMode,
          actor.id,
        );
        await insertActivity(
          db,
          brandId,
          BRIEF_ENTITY,
          copy.id,
          [{ field: 'duplicatedFrom', oldValue: null, newValue: source.name }],
          actor,
        );
        created.push({ id: copy.id, name: copy.name });
      }
      return { ok: true as const, created, skipped: parsed.data.length - created.length };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(creativeSheetPath);
    return outcome;
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

export interface DeleteSuccess {
  readonly ok: true;
  readonly deleted: readonly string[];
}

export type DeleteResult = DeleteSuccess | ReviewFailure;

/** Delete (scope 3): a SOFT delete of the brand's live rows among the selection, never `DELETE FROM`. */
export async function deleteCreativesAction(ids: readonly string[]): Promise<DeleteResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const deleted = await softDeleteBriefs(db, brandId, parsed.data, actor.id);
      for (const id of deleted) {
        await insertActivity(
          db,
          brandId,
          BRIEF_ENTITY,
          id,
          [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
          actor,
        );
      }
      return { ok: true as const, deleted };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(creativeSheetPath);
    for (const id of outcome.deleted) revalidatePath(briefPath(id));
    return outcome;
  } catch {
    return { ok: false, error: 'The creatives could not be deleted. Try again.' };
  }
}

export interface BulkMoveSuccess {
  readonly ok: true;
  readonly moved: readonly string[];
  /** The rows the machine refused, each with the reason, so the bar can say which and why. */
  readonly refused: readonly {
    readonly id: string;
    readonly name: string;
    readonly reason: string;
  }[];
}

export type BulkMoveResult = BulkMoveSuccess | ReviewFailure;

const trackField = z.enum(['internalStatus', 'status']);

/**
 * Change status (scope 3) over a selection: the same one-row move a Kanban drop makes, run per
 * row, so a bulk move is exactly as strict as a single one. A row the machine refuses is reported,
 * not written; the rest are moved.
 */
export async function bulkMoveCreativesAction(
  ids: readonly string[],
  field: string,
  value: string,
): Promise<BulkMoveResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsedIds = idList.safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: NOTHING_SELECTED };
  const parsedField = trackField.safeParse(field);
  if (!parsedField.success || value.trim() === '') return { ok: false, error: UNKNOWN_TRACK };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const moved: string[] = [];
      const refused: { id: string; name: string; reason: string }[] = [];
      for (const id of parsedIds.data) {
        const current = await getBriefById(db, brandId, id);
        if (current === null) continue;
        const result = await moveBriefTrack(db, brandId, current, parsedField.data, value, actor);
        if (result.ok) moved.push(result.id);
        else refused.push({ id, name: current.name, reason: result.error });
      }
      return { ok: true as const, moved, refused };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(creativeSheetPath);
    for (const id of outcome.moved) revalidatePath(briefPath(id));
    return outcome;
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

export interface CommentSuccess {
  readonly ok: true;
  readonly id: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
}

export type CommentResult = CommentSuccess | ReviewFailure;

const commentBody = z.string().trim().min(1).max(4000);

/** A top-level comment on a creative from Focus Mode's Feedback panel (scope 1). */
export async function postCreativeCommentAction(id: string, body: string): Promise<CommentResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  if (typeof id !== 'string' || id.trim() === '') return { ok: false, error: NOT_IDENTIFIED };
  const parsed = commentBody.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'Write a comment first.' };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getBriefById(db, brandId, id);
      if (current === null) return { ok: false as const, error: GONE };
      const saved = await insertComment(
        db,
        brandId,
        {
          recordType: CREATIVE_COMMENT_RECORD_TYPE,
          recordId: current.id,
          parentCommentId: null,
          authorId: actor.id,
          authorName: actor.name ?? 'Team member',
          body: parsed.data,
        },
        actor.id,
      );
      return {
        ok: true as const,
        id: saved.id,
        authorName: saved.authorName,
        body: saved.body,
        createdAt: saved.createdAt.toISOString(),
      };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    if (outcome.ok) revalidateRow(id);
    return outcome;
  } catch {
    return { ok: false, error: 'The comment could not be saved. Try again.' };
  }
}

/* ------------------------------------------------------------------------------------------------
 * TICKET 10 — annotations + comments on the brief-scoped tables (migration 0070)
 * ---------------------------------------------------------------------------------------------- */

export interface AnnotationSuccess {
  readonly ok: true;
  readonly annotation: BriefAnnotation;
}

export type AnnotationResult = AnnotationSuccess | ReviewFailure;

export interface BriefCommentSuccess {
  readonly ok: true;
  readonly comment: BriefComment;
}

export type BriefCommentResult = BriefCommentSuccess | ReviewFailure;

export interface IdSuccess {
  readonly ok: true;
  readonly id: string;
}

export type IdResult = IdSuccess | ReviewFailure;

const annotationInput = z.object({
  briefId: z.string().trim().min(1),
  submissionVersion: z.number().int().positive().nullable(),
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  note: z.string().trim().min(1).max(2000),
});

/**
 * Add a pin to a brief. Requires a reviewer role (not a video editor or designer — they are the
 * people BEING reviewed), the brief has to belong to a brand the viewer can resolve, and the
 * note cannot be blank. The write goes through the brief-scoped `brief_annotations` writer.
 */
export async function addAnnotationAction(
  briefId: string,
  submissionVersion: number | null,
  xPct: number,
  yPct: number,
  note: string,
): Promise<AnnotationResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = annotationInput.safeParse({ briefId, submissionVersion, xPct, yPct, note });
  if (!parsed.success) return { ok: false, error: 'That annotation is not valid.' };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db) => {
      const brandId = await briefBrandId(db, parsed.data.briefId);
      if (brandId === null) return { ok: false as const, error: UNKNOWN_BRIEF };
      const role = await viewerRoleFor(db, brandId, actor.id);
      if (!canReviewBrief(role)) return { ok: false as const, error: REVIEW_BRIEF_NOT_PERMITTED };
      const userRowId = await resolveUserIdByClerk(db, actor.id);
      if (userRowId === null) return { ok: false as const, error: SESSION_EXPIRED };
      const annotation = await insertBriefAnnotation(db, {
        briefId: parsed.data.briefId,
        submissionVersion: parsed.data.submissionVersion,
        xPct: parsed.data.xPct,
        yPct: parsed.data.yPct,
        note: parsed.data.note,
        createdBy: userRowId,
      });
      return { ok: true as const, annotation };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    if (outcome.ok) revalidateRow(briefId);
    return outcome;
  } catch {
    return { ok: false, error: 'The annotation could not be saved. Try again.' };
  }
}

/**
 * Delete a pin. Allowed to the author (looked up via `users.clerk_user_id`) or an admin on the
 * brand. Any other role is refused.
 */
export async function deleteAnnotationAction(id: string): Promise<IdResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  if (typeof id !== 'string' || id.trim() === '') return { ok: false, error: NOT_IDENTIFIED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db) => {
      const row = await findBriefAnnotationActor(db, id);
      if (row === null) return { ok: false as const, error: UNKNOWN_ROW };
      const brandId = await briefBrandId(db, row.briefId);
      if (brandId === null) return { ok: false as const, error: UNKNOWN_BRIEF };
      const role = await viewerRoleFor(db, brandId, actor.id);
      const userRowId = await resolveUserIdByClerk(db, actor.id);
      const isAuthor = userRowId !== null && userRowId === row.createdBy;
      if (role !== 'admin' && !isAuthor) {
        return { ok: false as const, error: REVIEW_BRIEF_NOT_PERMITTED };
      }
      const deleted = await softDeleteBriefAnnotation(db, id);
      if (deleted.length === 0) return { ok: false as const, error: UNKNOWN_ROW };
      return { ok: true as const, id: deleted[0] as string, briefId: row.briefId };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    if (outcome.ok) {
      revalidateRow(outcome.briefId);
      return { ok: true, id: outcome.id };
    }
    return outcome;
  } catch {
    return { ok: false, error: 'The annotation could not be removed. Try again.' };
  }
}

const commentInput = z.object({
  briefId: z.string().trim().min(1),
  submissionVersion: z.number().int().positive(),
  body: z.string().trim().min(1).max(4000),
  parentCommentId: z.string().trim().min(1).nullable(),
});

/**
 * Add a comment to the brief-scoped thread. A reply (`parentCommentId !== null`) must point at a
 * live comment on the SAME brief — a reply to a comment on another brief is refused.
 */
export async function addCommentAction(
  briefId: string,
  submissionVersion: number,
  body: string,
  parentCommentId: string | null,
): Promise<BriefCommentResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = commentInput.safeParse({ briefId, submissionVersion, body, parentCommentId });
  if (!parsed.success) return { ok: false, error: 'That comment is not valid.' };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db) => {
      const brandId = await briefBrandId(db, parsed.data.briefId);
      if (brandId === null) return { ok: false as const, error: UNKNOWN_BRIEF };
      const role = await viewerRoleFor(db, brandId, actor.id);
      if (!canReviewBrief(role)) return { ok: false as const, error: REVIEW_BRIEF_NOT_PERMITTED };
      if (parsed.data.parentCommentId !== null) {
        const parent = await findBriefCommentActor(db, parsed.data.parentCommentId);
        if (parent === null || parent.briefId !== parsed.data.briefId) {
          return { ok: false as const, error: UNKNOWN_PARENT };
        }
      }
      const userRowId = await resolveUserIdByClerk(db, actor.id);
      if (userRowId === null) return { ok: false as const, error: SESSION_EXPIRED };
      const comment = await insertBriefComment(db, {
        briefId: parsed.data.briefId,
        submissionVersion: parsed.data.submissionVersion,
        body: parsed.data.body,
        parentCommentId: parsed.data.parentCommentId,
        createdBy: userRowId,
      });
      return { ok: true as const, comment };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    if (outcome.ok) revalidateRow(briefId);
    return outcome;
  } catch {
    return { ok: false, error: 'The comment could not be saved. Try again.' };
  }
}

/** Delete a comment. Author-or-admin gate, same shape as `deleteAnnotationAction`. */
export async function deleteCommentAction(id: string): Promise<IdResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  if (typeof id !== 'string' || id.trim() === '') return { ok: false, error: NOT_IDENTIFIED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db) => {
      const row = await findBriefCommentActor(db, id);
      if (row === null) return { ok: false as const, error: UNKNOWN_ROW };
      const brandId = await briefBrandId(db, row.briefId);
      if (brandId === null) return { ok: false as const, error: UNKNOWN_BRIEF };
      const role = await viewerRoleFor(db, brandId, actor.id);
      const userRowId = await resolveUserIdByClerk(db, actor.id);
      const isAuthor = userRowId !== null && userRowId === row.createdBy;
      if (role !== 'admin' && !isAuthor) {
        return { ok: false as const, error: REVIEW_BRIEF_NOT_PERMITTED };
      }
      const deleted = await softDeleteBriefComment(db, id);
      if (deleted.length === 0) return { ok: false as const, error: UNKNOWN_ROW };
      return { ok: true as const, id: deleted[0] as string, briefId: row.briefId };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    if (outcome.ok) {
      revalidateRow(outcome.briefId);
      return { ok: true, id: outcome.id };
    }
    return outcome;
  } catch {
    return { ok: false, error: 'The comment could not be removed. Try again.' };
  }
}
