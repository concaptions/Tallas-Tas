import { describe, expect, it } from 'vitest';

import {
  countActiveBriefComments,
  findBriefCommentActor,
  insertBriefComment,
  listBriefComments,
  softDeleteBriefComment,
} from './brief-comments';
import { seed } from './seed';
import { users } from './schema';
import { testDb, type PgliteDb } from './testing';

/**
 * The brief-scoped comments writer (Ticket 10, migration 0070). PGlite proves the thread shape:
 * ordered reads with `deleted_at` filtering, the idempotent soft-delete, and the live-count the
 * Request Changes gate asks before letting a reviewer send a cut back.
 */
async function seeded(): Promise<{ db: PgliteDb; briefId: string; userId: string }> {
  const db = await testDb();
  const result = await seed(db);
  const briefId = result.briefs[0]?.id;
  if (briefId === undefined) throw new Error('seed produced no briefs');
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: 'user_comment_actor',
      email: 'comment@tas.example',
      fullName: 'Chris Thread',
    })
    .returning();
  if (user === undefined) throw new Error('user insert returned no row');
  return { db, briefId, userId: user.id };
}

describe('insertBriefComment', () => {
  it('writes a root comment with its submission version', async () => {
    const { db, briefId, userId } = await seeded();

    const row = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'Open on the pour.',
      parentCommentId: null,
      createdBy: userId,
    });

    expect(row.body).toBe('Open on the pour.');
    expect(row.submissionVersion).toBe(1);
    expect(row.parentCommentId).toBeNull();
    expect(row.deletedAt).toBeNull();
  });

  it('writes a reply with its parent id', async () => {
    const { db, briefId, userId } = await seeded();
    const root = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'root',
      parentCommentId: null,
      createdBy: userId,
    });

    const reply = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'reply',
      parentCommentId: root.id,
      createdBy: userId,
    });

    expect(reply.parentCommentId).toBe(root.id);
  });
});

describe('listBriefComments', () => {
  it('returns live comments oldest first and omits the deleted ones', async () => {
    const { db, briefId, userId } = await seeded();
    const first = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'one',
      parentCommentId: null,
      createdBy: userId,
    });
    const second = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'two',
      parentCommentId: null,
      createdBy: userId,
    });
    await softDeleteBriefComment(db, first.id);

    const live = await listBriefComments(db, briefId);

    expect(live.map((row) => row.id)).toEqual([second.id]);
  });

  it('narrows by submission version', async () => {
    const { db, briefId, userId } = await seeded();
    const v1 = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'v1',
      parentCommentId: null,
      createdBy: userId,
    });
    await insertBriefComment(db, {
      briefId,
      submissionVersion: 2,
      body: 'v2',
      parentCommentId: null,
      createdBy: userId,
    });

    expect((await listBriefComments(db, briefId, 1)).map((row) => row.id)).toEqual([v1.id]);
  });
});

describe('softDeleteBriefComment', () => {
  it('returns the id once and nothing on a repeat delete', async () => {
    const { db, briefId, userId } = await seeded();
    const row = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'bye',
      parentCommentId: null,
      createdBy: userId,
    });

    expect(await softDeleteBriefComment(db, row.id)).toEqual([row.id]);
    expect(await softDeleteBriefComment(db, row.id)).toEqual([]);
  });
});

describe('findBriefCommentActor', () => {
  it('returns the author and brief for a live row and null for a deleted one', async () => {
    const { db, briefId, userId } = await seeded();
    const row = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'hi',
      parentCommentId: null,
      createdBy: userId,
    });

    expect(await findBriefCommentActor(db, row.id)).toEqual({ createdBy: userId, briefId });
    await softDeleteBriefComment(db, row.id);
    expect(await findBriefCommentActor(db, row.id)).toBeNull();
  });
});

describe('countActiveBriefComments', () => {
  it('counts live comments on one version and ignores deleted ones and other versions', async () => {
    const { db, briefId, userId } = await seeded();
    expect(await countActiveBriefComments(db, briefId, 1)).toBe(0);

    const first = await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'one',
      parentCommentId: null,
      createdBy: userId,
    });
    await insertBriefComment(db, {
      briefId,
      submissionVersion: 1,
      body: 'two',
      parentCommentId: null,
      createdBy: userId,
    });
    await insertBriefComment(db, {
      briefId,
      submissionVersion: 2,
      body: 'on v2',
      parentCommentId: null,
      createdBy: userId,
    });

    expect(await countActiveBriefComments(db, briefId, 1)).toBe(2);

    await softDeleteBriefComment(db, first.id);
    expect(await countActiveBriefComments(db, briefId, 1)).toBe(1);
  });
});
