import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';

import type { Db } from './db';
import { briefComments, type BriefComment } from './schema';

/**
 * The brief-scoped comments writer (Ticket 10, migration 0070). Lives beside the polymorphic
 * `comments` writer — see docs/decisions.md 2026-10-14 entry; the unify ticket moves the
 * polymorphic rows into this table and drops the polymorphic schemas.
 *
 * `created_by` is a uuid FK to `users.id`; the caller resolves Clerk → user id before writing.
 * `submissionVersion` is required on the schema itself (a comment is always said about a specific
 * version of the cut, unlike an annotation which can predate any upload).
 */

export interface InsertBriefCommentInput {
  readonly briefId: string;
  readonly submissionVersion: number;
  readonly body: string;
  readonly parentCommentId: string | null;
  readonly createdBy: string;
}

/** Every live comment on a brief, oldest first; optional `version` narrows to one submission. */
export async function listBriefComments(
  db: Db,
  briefId: string,
  version?: number,
): Promise<BriefComment[]> {
  const condition =
    version === undefined
      ? and(eq(briefComments.briefId, briefId), isNull(briefComments.deletedAt))
      : and(
          eq(briefComments.briefId, briefId),
          eq(briefComments.submissionVersion, version),
          isNull(briefComments.deletedAt),
        );
  return db.select().from(briefComments).where(condition).orderBy(asc(briefComments.createdAt));
}

export async function insertBriefComment(
  db: Db,
  input: InsertBriefCommentInput,
): Promise<BriefComment> {
  const [row] = await db
    .insert(briefComments)
    .values({
      briefId: input.briefId,
      submissionVersion: input.submissionVersion,
      body: input.body,
      parentCommentId: input.parentCommentId,
      createdBy: input.createdBy,
    })
    .returning();
  if (row === undefined) {
    throw new Error('brief_comments insert returned no row');
  }
  return row;
}

/** Idempotent soft-delete. The actor is on the activity log; this row carries no updater. */
export async function softDeleteBriefComment(db: Db, id: string): Promise<string[]> {
  const rows = await db
    .update(briefComments)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(briefComments.id, id), isNull(briefComments.deletedAt)))
    .returning({ id: briefComments.id });
  return rows.map((row) => row.id);
}

/** The author of one comment, for the author-or-admin delete gate; null when the row is gone. */
export async function findBriefCommentActor(
  db: Db,
  id: string,
): Promise<{ readonly createdBy: string; readonly briefId: string } | null> {
  const [row] = await db
    .select({ createdBy: briefComments.createdBy, briefId: briefComments.briefId })
    .from(briefComments)
    .where(and(eq(briefComments.id, id), isNull(briefComments.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * The count of live comments on one submission version — the gate Request Changes reads: a review
 * cannot send a cut back without at least one explicit comment on the current version.
 */
export async function countActiveBriefComments(
  db: Db,
  briefId: string,
  submissionVersion: number,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(briefComments)
    .where(
      and(
        eq(briefComments.briefId, briefId),
        eq(briefComments.submissionVersion, submissionVersion),
        isNull(briefComments.deletedAt),
      ),
    );
  return row?.total ?? 0;
}
