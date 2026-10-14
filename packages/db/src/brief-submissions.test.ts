import { describe, expect, it } from 'vitest';

import {
  currentBriefSubmission,
  listBriefSubmissions,
  uploadBriefSubmission,
} from './brief-submissions';
import { seed } from './seed';
import { users } from './schema';
import { testDb, type PgliteDb } from './testing';

/**
 * The uploads history writer (Ticket 11, migration 0071). PGlite proves the serialisation shape:
 * the version increments, the previous `is_current` row flips off, and parallel inserts under one
 * brief end up with distinct versions (1 and 2, never two 1s).
 */
async function seeded(): Promise<{ db: PgliteDb; briefId: string; userId: string }> {
  const db = await testDb();
  const result = await seed(db);
  const briefId = result.briefs[0]?.id;
  if (briefId === undefined) throw new Error('seed produced no briefs');
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: 'user_submission_actor',
      email: 'sub@tas.example',
      fullName: 'Sam Upload',
    })
    .returning();
  if (user === undefined) throw new Error('user insert returned no row');
  return { db, briefId, userId: user.id };
}

describe('uploadBriefSubmission', () => {
  it('writes version 1 as the current row on the first upload', async () => {
    const { db, briefId, userId } = await seeded();

    const row = await uploadBriefSubmission(db, {
      briefId,
      fileUrl: 'https://cdn.example.com/v1.mp4',
      fileType: 'video',
      thumbnailUrl: null,
      durationSeconds: 42,
      uploadedBy: userId,
    });

    expect(row.version).toBe(1);
    expect(row.isCurrent).toBe(true);
  });

  it('increments the version and flips the previous current off', async () => {
    const { db, briefId, userId } = await seeded();

    await uploadBriefSubmission(db, {
      briefId,
      fileUrl: 'https://cdn.example.com/v1.mp4',
      fileType: 'video',
      thumbnailUrl: null,
      durationSeconds: null,
      uploadedBy: userId,
    });
    const v2 = await uploadBriefSubmission(db, {
      briefId,
      fileUrl: 'https://cdn.example.com/v2.mp4',
      fileType: 'video',
      thumbnailUrl: null,
      durationSeconds: null,
      uploadedBy: userId,
    });

    expect(v2.version).toBe(2);
    expect(v2.isCurrent).toBe(true);

    const current = await currentBriefSubmission(db, briefId);
    expect(current?.version).toBe(2);
    const all = await listBriefSubmissions(db, briefId);
    expect(all.map((row) => ({ version: row.version, current: row.isCurrent }))).toEqual([
      { version: 1, current: false },
      { version: 2, current: true },
    ]);
  });

  it('serialises parallel inserts under the advisory lock — versions 1 and 2, one current', async () => {
    const { db, briefId, userId } = await seeded();

    const [a, b] = await Promise.all([
      uploadBriefSubmission(db, {
        briefId,
        fileUrl: 'a.mp4',
        fileType: 'video',
        thumbnailUrl: null,
        durationSeconds: null,
        uploadedBy: userId,
      }),
      uploadBriefSubmission(db, {
        briefId,
        fileUrl: 'b.mp4',
        fileType: 'video',
        thumbnailUrl: null,
        durationSeconds: null,
        uploadedBy: userId,
      }),
    ]);

    const versions = [a.version, b.version].sort((x, y) => x - y);
    expect(versions).toEqual([1, 2]);
    const all = await listBriefSubmissions(db, briefId);
    expect(all.filter((row) => row.isCurrent)).toHaveLength(1);
  });
});

describe('currentBriefSubmission', () => {
  it('returns null when nothing is uploaded yet', async () => {
    const { db, briefId } = await seeded();
    expect(await currentBriefSubmission(db, briefId)).toBeNull();
  });
});
