import { and, asc, eq, sql } from 'drizzle-orm';

import type { Db } from './db';
import { briefSubmissions, type BriefSubmission } from './schema';

/**
 * The brief_submissions writer (Ticket 11, migration 0071). An upload is a two-step write under a
 * single transaction: the next version is `COALESCE(MAX(version), 0) + 1` under a per-brief advisory
 * lock, the current row (if any) is flipped to `is_current = false`, then the new row inserts with
 * `is_current = true`. Concurrent uploads on the same brief serialise on the lock.
 */

export interface UploadSubmissionInput {
  readonly briefId: string;
  readonly fileUrl: string;
  readonly fileType: string;
  readonly thumbnailUrl: string | null;
  readonly durationSeconds: number | null;
  readonly uploadedBy: string;
}

/** Every submission on a brief, oldest version first. */
export async function listBriefSubmissions(db: Db, briefId: string): Promise<BriefSubmission[]> {
  return db
    .select()
    .from(briefSubmissions)
    .where(eq(briefSubmissions.briefId, briefId))
    .orderBy(asc(briefSubmissions.version));
}

/** The brief's current submission (`is_current = true`), or null when nothing is uploaded yet. */
export async function currentBriefSubmission(
  db: Db,
  briefId: string,
): Promise<BriefSubmission | null> {
  const [row] = await db
    .select()
    .from(briefSubmissions)
    .where(and(eq(briefSubmissions.briefId, briefId), eq(briefSubmissions.isCurrent, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Upload a submission. The transaction serialises parallel calls per brief under the advisory
 * lock, so two concurrent writes become versions 1 and 2 — never two 1s — and the newer one is
 * the only `is_current` row.
 */
export async function uploadBriefSubmission(
  db: Db,
  input: UploadSubmissionInput,
): Promise<BriefSubmission> {
  // PGlite's drizzle driver exposes `transaction`; Neon uses the same shape through the serverless
  // client. The pg_advisory_xact_lock serialises concurrent uploads per brief, so two parallel
  // calls become versions 1 and 2 (never two 1s) and only the newer one is `is_current`.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.briefId}))`);
    const [maxRow] = await tx
      .select({ max: sql<number | null>`COALESCE(MAX(${briefSubmissions.version}), 0)` })
      .from(briefSubmissions)
      .where(eq(briefSubmissions.briefId, input.briefId));
    const nextVersion = (maxRow?.max ?? 0) + 1;
    await tx
      .update(briefSubmissions)
      .set({ isCurrent: false })
      .where(
        and(eq(briefSubmissions.briefId, input.briefId), eq(briefSubmissions.isCurrent, true)),
      );
    const [row] = await tx
      .insert(briefSubmissions)
      .values({
        briefId: input.briefId,
        version: nextVersion,
        uploadedBy: input.uploadedBy,
        fileUrl: input.fileUrl,
        fileType: input.fileType,
        thumbnailUrl: input.thumbnailUrl,
        durationSeconds: input.durationSeconds,
        isCurrent: true,
      })
      .returning();
    if (row === undefined) {
      throw new Error('brief_submissions insert returned no row');
    }
    return row;
  });
}
