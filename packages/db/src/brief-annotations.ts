import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { Db } from './db';
import { briefAnnotations, creativeBriefs, users, type BriefAnnotation } from './schema';

/**
 * The brief-scoped annotations writer (Ticket 10, migration 0070). Lives beside the polymorphic
 * `annotations` writer (`annotation-queries.ts`) — see docs/decisions.md 2026-10-14 entry; a later
 * unify ticket migrates the polymorphic rows into this table and drops the polymorphic schemas.
 *
 * `created_by` is a uuid FK to `users.id` and NOT the Clerk user id, so the caller resolves the
 * Clerk id to a user row (through `ensureUser`) before writing. The reads filter `deleted_at IS
 * NULL` so a soft delete removes the pin from every surface at once.
 */

export interface InsertBriefAnnotationInput {
  readonly briefId: string;
  readonly submissionVersion: number | null;
  readonly xPct: number;
  readonly yPct: number;
  readonly note: string;
  readonly createdBy: string;
}

/** Every live pin on a brief, oldest first; optional `version` narrows to one submission. */
export async function listBriefAnnotations(
  db: Db,
  briefId: string,
  version?: number,
): Promise<BriefAnnotation[]> {
  const condition =
    version === undefined
      ? and(eq(briefAnnotations.briefId, briefId), isNull(briefAnnotations.deletedAt))
      : and(
          eq(briefAnnotations.briefId, briefId),
          eq(briefAnnotations.submissionVersion, version),
          isNull(briefAnnotations.deletedAt),
        );
  return db
    .select()
    .from(briefAnnotations)
    .where(condition)
    .orderBy(asc(briefAnnotations.createdAt));
}

export async function insertBriefAnnotation(
  db: Db,
  input: InsertBriefAnnotationInput,
): Promise<BriefAnnotation> {
  const [row] = await db
    .insert(briefAnnotations)
    .values({
      briefId: input.briefId,
      submissionVersion: input.submissionVersion,
      xPct: String(input.xPct),
      yPct: String(input.yPct),
      note: input.note,
      createdBy: input.createdBy,
    })
    .returning();
  if (row === undefined) {
    throw new Error('brief_annotations insert returned no row');
  }
  return row;
}

/**
 * Soft-delete one pin; a second call for the same id returns an empty array (idempotent). The
 * actor stays off the signature: the row has no `updated_by`, and the Server Action records who
 * acted on the activity log instead.
 */
export async function softDeleteBriefAnnotation(db: Db, id: string): Promise<string[]> {
  const rows = await db
    .update(briefAnnotations)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(briefAnnotations.id, id), isNull(briefAnnotations.deletedAt)))
    .returning({ id: briefAnnotations.id });
  return rows.map((row) => row.id);
}

/** The author of one pin, for the author-or-admin delete gate; null when the row is gone. */
export async function findBriefAnnotationActor(
  db: Db,
  id: string,
): Promise<{ readonly createdBy: string; readonly briefId: string } | null> {
  const [row] = await db
    .select({ createdBy: briefAnnotations.createdBy, briefId: briefAnnotations.briefId })
    .from(briefAnnotations)
    .where(and(eq(briefAnnotations.id, id), isNull(briefAnnotations.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** The brief's brand id, so a Server Action can enforce brand scope on an annotation or comment. */
export async function briefBrandId(db: Db, briefId: string): Promise<string | null> {
  const [row] = await db
    .select({ brandId: creativeBriefs.brandId })
    .from(creativeBriefs)
    .where(and(eq(creativeBriefs.id, briefId), isNull(creativeBriefs.deletedAt)))
    .limit(1);
  return row?.brandId ?? null;
}

/**
 * The `users.id` uuid for a Clerk user id. Null for a Clerk account with no row yet — the Server
 * Action refuses, since the author FK is NOT NULL at the brief_annotations / brief_comments
 * tables.
 */
export async function resolveUserIdByClerk(db: Db, clerkUserId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return row?.id ?? null;
}
