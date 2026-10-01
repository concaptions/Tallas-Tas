import { describe, expect, it } from 'vitest';

import { insertActivity, listActivity } from './activity-log';
import { getBriefById, insertBrief, updateBrief } from './briefs';
import { restoreBrief, snapshotBrief } from './briefs-e2e';
import { seed } from './seed';
import { testDb } from './testing';

const ACTOR = { id: 'user_e2e', name: 'E2E User' };

/** A brief with one prior activity row, snapshotted, then started the way `startBriefAction` does. */
async function startedBrief() {
  const db = await testDb();
  const { childBrand } = await seed(db);
  const brief = await insertBrief(
    db,
    childBrand.id,
    { name: 'TV9-B9-Reset-V1', internalStatus: 'sent_to_video_editor' },
    'user_seed',
  );
  await insertActivity(
    db,
    childBrand.id,
    'creative_brief',
    brief.id,
    [{ field: 'priority', oldValue: null, newValue: 'Video High' }],
    ACTOR,
  );
  const snapshot = await snapshotBrief(db, brief.id);
  await updateBrief(
    db,
    childBrand.id,
    brief.id,
    { internalStatus: 'video_editing_in_progress', assignee: ACTOR.name },
    ACTOR.id,
  );
  await insertActivity(
    db,
    childBrand.id,
    'creative_brief',
    brief.id,
    [
      {
        field: 'internalStatus',
        oldValue: 'sent_to_video_editor',
        newValue: 'video_editing_in_progress',
      },
      { field: 'assignee', oldValue: null, newValue: ACTOR.name },
    ],
    ACTOR,
  );
  return { db, brandId: childBrand.id, brief, snapshot };
}

describe('snapshotBrief / restoreBrief (live E2E teardown)', () => {
  it('captures status, assignee and the activity rows that already exist', async () => {
    const { brief, snapshot } = await startedBrief();
    expect(snapshot.id).toBe(brief.id);
    expect(snapshot.internalStatus).toBe('sent_to_video_editor');
    expect(snapshot.assignee).toBeNull();
    expect(snapshot.activityIds).toHaveLength(1);
  });

  it('puts the brief back and soft-deletes only the rows written after the snapshot', async () => {
    const { db, brandId, brief, snapshot } = await startedBrief();
    await restoreBrief(db, snapshot);

    const row = await getBriefById(db, brandId, brief.id);
    expect(row?.internalStatus).toBe('sent_to_video_editor');
    expect(row?.assignee).toBeNull();
    const activity = await listActivity(db, brandId, 'creative_brief', brief.id);
    expect(activity.map((entry) => entry.field)).toEqual(['priority']);
  });

  it('is idempotent: a second restore changes nothing', async () => {
    const { db, brandId, brief, snapshot } = await startedBrief();
    await restoreBrief(db, snapshot);
    const once = await getBriefById(db, brandId, brief.id);
    await restoreBrief(db, snapshot);
    const twice = await getBriefById(db, brandId, brief.id);

    expect(twice?.internalStatus).toBe(once?.internalStatus);
    expect(twice?.assignee).toBe(once?.assignee);
    const activity = await listActivity(db, brandId, 'creative_brief', brief.id);
    expect(activity.map((entry) => entry.field)).toEqual(['priority']);
  });

  it('throws for an id that is not a live brief', async () => {
    const db = await testDb();
    await seed(db);
    await expect(snapshotBrief(db, '77777777-7777-4777-8777-999999999999')).rejects.toThrow(
      /not a live row/,
    );
  });
});
