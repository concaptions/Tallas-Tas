import { describe, expect, it } from 'vitest';

import { insertActivity, listActivity } from './activity-log';
import { seed } from './seed';
import { testDb } from './testing';

const BRIEF = '77777777-7777-4777-8777-000000000001';
const ACTOR = { id: 'user_dorian', name: 'Dorian Vance' };

describe('activity log', () => {
  it('writes one row per change with the actor, and lists them newest first', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);

    const rows = await insertActivity(
      db,
      childBrand.id,
      'creative_brief',
      BRIEF,
      [
        {
          field: 'internalStatus',
          oldValue: 'sent_to_video_editor',
          newValue: 'video_editing_in_progress',
        },
        { field: 'assignee', oldValue: null, newValue: 'Dorian Vance' },
      ],
      ACTOR,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.createdBy).toBe(ACTOR.id);
    expect(rows[0]?.actorName).toBe(ACTOR.name);

    const listed = await listActivity(db, childBrand.id, 'creative_brief', BRIEF);
    expect(listed.map((row) => row.field).sort()).toEqual(['assignee', 'internalStatus']);
    expect(listed.every((row) => row.entityType === 'creative_brief')).toBe(true);
  });

  it('is scoped by brand: another brand reads nothing', async () => {
    const db = await testDb();
    const { childBrand, templateBrand } = await seed(db);
    await insertActivity(
      db,
      childBrand.id,
      'creative_brief',
      BRIEF,
      [{ field: 'priority', oldValue: null, newValue: 'Video High' }],
      ACTOR,
    );
    expect(await listActivity(db, templateBrand.id, 'creative_brief', BRIEF)).toEqual([]);
    expect(await listActivity(db, childBrand.id, 'creative_brief', BRIEF)).toHaveLength(1);
  });

  it('writes nothing for an empty change list', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);
    expect(await insertActivity(db, childBrand.id, 'creative_brief', BRIEF, [], ACTOR)).toEqual([]);
  });
});
