import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { smCampaignFeedTasks } from './schema/sm-campaign-feed-tasks';
import { seed } from './seed';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
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
