import { asc, desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { smCampaignFeedTasks, type NewSmCampaignFeedTask, type SmCampaignFeedTask } from './schema';
import { withBrand } from './tenancy';

/**
 * The SM Campaign Feed's data access (Airtable `tblLRajTW55XEhVhk`, module parity 2026-10-01). A copy
 * of `products.ts`, function for function: every function takes the database as its first argument
 * (no module-level singleton) and reads and writes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose its
 * own brand. Nothing here contains business logic; the Server Actions call these.
 *
 * "Reminder Trigger" — Airtable's `IF(IS_AFTER(NOW(), DATEADD({Due Date}, -12, 'hours')), ...)` — is
 * deliberately NOT a column and NOT on the list row: it depends on the clock, so the page computes it
 * from `due_date` and `status` with the one `now` it renders with. A stored copy, or a value computed
 * here without a clock argument, would be stale the moment it was read.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel's form or a parsed CSV row submits for create (`taskName` required), or patches. */
export type SmCampaignFeedTaskInput = Omit<NewSmCampaignFeedTask, ManagedColumn>;

/**
 * A task as the grid, the board and the panel render it. The table has no record links and no
 * lookups (five stored fields, all its own), so the list row is the stored row and nothing is joined.
 * `demoSmCampaignFeedTasks` satisfies `SmCampaignFeedTaskListRow[]`, so the page reads demo fixtures
 * and database rows through one type.
 */
export type SmCampaignFeedTaskListRow = SmCampaignFeedTask;

/**
 * The brand's live tasks, soonest due first; undated tasks sink to the bottom (`ASC` puts nulls last
 * in Postgres), and tasks sharing a due moment fall back to newest edit first.
 */
export async function listSmCampaignFeedTasks(
  db: Db,
  brandId: string,
): Promise<SmCampaignFeedTaskListRow[]> {
  return withBrand(db, brandId)
    .select(smCampaignFeedTasks)
    .orderBy(asc(smCampaignFeedTasks.dueDate), desc(smCampaignFeedTasks.updatedAt));
}

/** One live task of the brand, or null: another brand's id never resolves. */
export async function getSmCampaignFeedTaskById(
  db: Db,
  brandId: string,
  id: string,
): Promise<SmCampaignFeedTaskListRow | null> {
  const [row] = await withBrand(db, brandId)
    .select(smCampaignFeedTasks, eq(smCampaignFeedTasks.id, id))
    .limit(1);
  return row ?? null;
}

/** Creates a task in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertSmCampaignFeedTask(
  db: Db,
  brandId: string,
  values: SmCampaignFeedTaskInput,
  actorId: string,
): Promise<SmCampaignFeedTask> {
  const [row] = await withBrand(db, brandId)
    .insert(smCampaignFeedTasks, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('sm_campaign_feed_tasks insert returned no row');
  }
  return row;
}

/**
 * Patches one live task of the brand and returns it, or null when the id belongs to another brand
 * or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateSmCampaignFeedTask(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<SmCampaignFeedTaskInput>,
  actorId: string,
): Promise<SmCampaignFeedTask | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      smCampaignFeedTasks,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(smCampaignFeedTasks.id, id),
    )
    .returning();
  return row ?? null;
}
