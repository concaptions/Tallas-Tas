import { describe, expect, it } from 'vitest';

import {
  briefBrandId,
  findBriefAnnotationActor,
  insertBriefAnnotation,
  listBriefAnnotations,
  softDeleteBriefAnnotation,
} from './brief-annotations';
import { seed } from './seed';
import { users } from './schema';
import { testDb, type PgliteDb } from './testing';

/**
 * The brief-scoped annotations writer (Ticket 10, migration 0070). PGlite covers insert, list
 * filtering `deleted_at IS NULL`, the idempotent soft-delete, and the brand-id resolver the Server
 * Action reads before scoping a write to one tenant.
 */
async function seeded(): Promise<{ db: PgliteDb; briefId: string; userId: string }> {
  const db = await testDb();
  const result = await seed(db);
  const briefId = result.briefs[0]?.id;
  if (briefId === undefined) throw new Error('seed produced no briefs');
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: 'user_annot_actor',
      email: 'annot@tas.example',
      fullName: 'Annie Pin',
    })
    .returning();
  if (user === undefined) throw new Error('user insert returned no row');
  return { db, briefId, userId: user.id };
}

describe('insertBriefAnnotation', () => {
  it('writes one pin with the stored percentage coordinates', async () => {
    const { db, briefId, userId } = await seeded();

    const row = await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: 1,
      xPct: 42.5,
      yPct: 7.25,
      note: 'Slow this pour',
      createdBy: userId,
    });

    expect(row.briefId).toBe(briefId);
    expect(row.submissionVersion).toBe(1);
    expect(row.note).toBe('Slow this pour');
    // numeric arrives as a string on read; the overlay parses it.
    expect(Number(row.xPct)).toBeCloseTo(42.5);
    expect(Number(row.yPct)).toBeCloseTo(7.25);
    expect(row.deletedAt).toBeNull();
  });

  it('accepts a null submission version — a pin filed before any upload', async () => {
    const { db, briefId, userId } = await seeded();
    const row = await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: null,
      xPct: 10,
      yPct: 10,
      note: 'Reference pin.',
      createdBy: userId,
    });
    expect(row.submissionVersion).toBeNull();
  });
});

describe('listBriefAnnotations', () => {
  it('returns every live pin oldest first and filters out deleted rows', async () => {
    const { db, briefId, userId } = await seeded();
    const first = await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: 1,
      xPct: 10,
      yPct: 10,
      note: 'one',
      createdBy: userId,
    });
    const second = await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: 1,
      xPct: 50,
      yPct: 50,
      note: 'two',
      createdBy: userId,
    });
    await softDeleteBriefAnnotation(db, first.id);

    const live = await listBriefAnnotations(db, briefId);

    expect(live.map((row) => row.id)).toEqual([second.id]);
  });

  it('narrows by version when the caller passes one', async () => {
    const { db, briefId, userId } = await seeded();
    await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: 1,
      xPct: 10,
      yPct: 10,
      note: 'v1',
      createdBy: userId,
    });
    const v2 = await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: 2,
      xPct: 20,
      yPct: 20,
      note: 'v2',
      createdBy: userId,
    });

    expect((await listBriefAnnotations(db, briefId, 2)).map((row) => row.id)).toEqual([v2.id]);
  });
});

describe('softDeleteBriefAnnotation', () => {
  it('returns the id on the first delete and nothing on a second one', async () => {
    const { db, briefId, userId } = await seeded();
    const row = await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: 1,
      xPct: 10,
      yPct: 10,
      note: 'bye',
      createdBy: userId,
    });

    expect(await softDeleteBriefAnnotation(db, row.id)).toEqual([row.id]);
    expect(await softDeleteBriefAnnotation(db, row.id)).toEqual([]);
  });
});

describe('findBriefAnnotationActor', () => {
  it('returns the author and brief for a live row and null for a deleted one', async () => {
    const { db, briefId, userId } = await seeded();
    const row = await insertBriefAnnotation(db, {
      briefId,
      submissionVersion: 1,
      xPct: 10,
      yPct: 10,
      note: 'hello',
      createdBy: userId,
    });

    expect(await findBriefAnnotationActor(db, row.id)).toEqual({
      createdBy: userId,
      briefId,
    });

    await softDeleteBriefAnnotation(db, row.id);
    expect(await findBriefAnnotationActor(db, row.id)).toBeNull();
  });
});

describe('briefBrandId', () => {
  it('returns the brief’s brand id for a live row', async () => {
    const { db, briefId } = await seeded();
    const brandId = await briefBrandId(db, briefId);
    expect(brandId).not.toBeNull();
  });

  it('returns null for an unknown brief', async () => {
    const { db } = await seeded();
    expect(await briefBrandId(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});
