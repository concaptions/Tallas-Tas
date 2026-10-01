import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_BRAND_ID } from './demo-data';
import { demoSmCampaignFeedTasks } from './demo-sm-campaign-feed-tasks';
import { smCampaignFeedTasks, type SmCampaignFeedTask } from './schema/sm-campaign-feed-tasks';
import { seed } from './seed';
import {
  getSmCampaignFeedTaskById,
  insertSmCampaignFeedTask,
  listSmCampaignFeedTasks,
  updateSmCampaignFeedTask,
  type SmCampaignFeedTaskInput,
  type SmCampaignFeedTaskListRow,
} from './sm-campaign-feed-tasks';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/** The first demo task — the finished X thread — past `noUncheckedIndexedAccess`. */
function demoTask(): SmCampaignFeedTaskListRow {
  const [row] = demoSmCampaignFeedTasks;
  if (row === undefined) throw new Error('demoSmCampaignFeedTasks is empty');
  return row;
}

/**
 * A fresh database with every migration applied, the demo brand seeded and the five fixtures written
 * into it through the scope (the shared `seed` does not know this table; the fixtures carry their own
 * ids and timestamps, so the rows come back exactly as the fixtures state them). The fixtures carry
 * `brandId` too, which the scope overrides with its own — the same guarantee the smuggling test
 * below proves on purpose.
 */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  await withBrand(db, childBrand.id).insert(smCampaignFeedTasks, demoSmCampaignFeedTasks);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('sm_campaign_feed_tasks on PGlite', () => {
  it('is created by the migration with its brand and template-row indexes', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'sm_campaign_feed_tasks')).toEqual([
      'sm_campaign_feed_tasks_brand_id_idx',
      'sm_campaign_feed_tasks_pkey',
      'sm_campaign_feed_tasks_template_row_id_idx',
    ]);
  });

  it('inserts and reads a task through withBrand, invisible to another brand', async () => {
    const db = await testDb();
    const { childBrand, templateBrand } = await seed(db);

    const [task] = await withBrand(db, childBrand.id)
      .insert(smCampaignFeedTasks, {
        taskName: 'Launch the fall drop reel',
        platform: 'tiktok',
        dueDate: new Date('2026-10-15T09:00:00Z'),
        status: 'todo',
        notes: 'Pin the comment with the discount code.',
      })
      .returning();

    expect(task?.brandId).toBe(childBrand.id);
    expect(task?.platform).toBe('tiktok');
    expect(task?.dueDate).toEqual(new Date('2026-10-15T09:00:00Z'));
    expect(await withBrand(db, childBrand.id).select(smCampaignFeedTasks)).toEqual([task]);
    expect(await withBrand(db, templateBrand.id).select(smCampaignFeedTasks)).toEqual([]);
  });
});

describe('sm campaign feed task queries', () => {
  it('lists the five fixtures row for row, soonest due first and the undated task last', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoSmCampaignFeedTasks).toHaveLength(5);
    const rows = await listSmCampaignFeedTasks(db, brandId);
    expect(rows).toEqual(demoSmCampaignFeedTasks);

    const due = rows.map((row) => row.dueDate?.getTime() ?? null);
    const dated = due.filter((value): value is number => value !== null);
    expect(dated).toEqual([...dated].sort((a, b) => a - b));
    expect(due.at(-1)).toBeNull();
    // Every select is visibly optional: one task has no platform, no due moment and no notes.
    expect(rows.filter((row) => row.platform === null)).toHaveLength(1);
    expect(rows.filter((row) => row.notes === null)).toHaveLength(1);
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoTask();

    expect(await listSmCampaignFeedTasks(db, otherBrandId)).toEqual([]);
    expect(await getSmCampaignFeedTaskById(db, otherBrandId, target.id)).toBeNull();
    expect(await getSmCampaignFeedTaskById(db, brandId, target.id)).toEqual(target);

    await db
      .update(smCampaignFeedTasks)
      .set({ deletedAt: new Date() })
      .where(sql`${smCampaignFeedTasks.id} = ${target.id}`);

    expect(await listSmCampaignFeedTasks(db, brandId)).toHaveLength(4);
    expect(await getSmCampaignFeedTaskById(db, brandId, target.id)).toBeNull();
  });

  it('insertSmCampaignFeedTask forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      taskName: 'Smuggled task',
      platform: 'meta',
      brandId: otherBrandId,
    } as unknown as SmCampaignFeedTaskInput;

    const row = await insertSmCampaignFeedTask(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      taskName: 'Smuggled task',
      platform: 'meta',
      dueDate: null,
      status: null,
      notes: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listSmCampaignFeedTasks(db, brandId)).toHaveLength(6);
    expect(await listSmCampaignFeedTasks(db, otherBrandId)).toEqual([]);
  });

  it('updateSmCampaignFeedTask cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoTask();

    const escaped = await updateSmCampaignFeedTask(
      db,
      otherBrandId,
      target.id,
      { taskName: 'Hijacked' },
      'thief',
    );
    const own = await updateSmCampaignFeedTask(
      db,
      brandId,
      target.id,
      { status: 'in_progress', dueDate: new Date('2026-10-03T12:00:00.000Z') },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      taskName: target.taskName,
      status: 'in_progress',
      dueDate: new Date('2026-10-03T12:00:00.000Z'),
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoSmCampaignFeedTasks).toEqualTypeOf<SmCampaignFeedTaskListRow[]>();
    expectTypeOf(await listSmCampaignFeedTasks(db, brandId)).toEqualTypeOf<
      SmCampaignFeedTaskListRow[]
    >();
    expectTypeOf<SmCampaignFeedTaskListRow>().toExtend<SmCampaignFeedTask>();
    // `brand_id` and the audit columns are the scope's, never the form's or the CSV's.
    expectTypeOf<SmCampaignFeedTaskInput>().not.toHaveProperty('brandId');
    expectTypeOf<SmCampaignFeedTaskInput>().not.toHaveProperty('createdBy');
    expectTypeOf<SmCampaignFeedTaskInput>().toHaveProperty('taskName');
    expectTypeOf<SmCampaignFeedTaskInput>().toHaveProperty('dueDate');
  });
});
