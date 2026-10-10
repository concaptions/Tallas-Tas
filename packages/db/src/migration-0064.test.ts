import { readFileSync } from 'node:fs';
import { inArray, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { concepts } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

/**
 * Migration 0064 on PGlite (SMOKE-18, Option B): the legacy `approval_status` is copied into the one
 * client vocabulary on `client_approval_status` — approved → approved, pending_client →
 * pending_for_approval, rejected → disapproved — leaving NULL alone and never overwriting a value
 * already set. Run twice, as Railway's guard would.
 */
const STATEMENTS = readFileSync(
  new URL('../drizzle/0064_concept_client_approval_backfill.sql', import.meta.url),
  'utf8',
).split('--> statement-breakpoint');

async function runMigration(db: Awaited<ReturnType<typeof testDb>>): Promise<void> {
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

describe('migration 0064 on PGlite', () => {
  it('maps the three legacy values, leaves NULL and draft alone, keeps a set value, idempotently', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);
    const brandId = childBrand.id;
    await db.insert(concepts).values([
      { brandId, name: 'A', approvalStatus: 'approved' },
      { brandId, name: 'B', approvalStatus: 'pending_client' },
      { brandId, name: 'C', approvalStatus: 'rejected' },
      { brandId, name: 'D', approvalStatus: null },
      { brandId, name: 'E', approvalStatus: 'draft' },
      { brandId, name: 'F', approvalStatus: 'rejected', clientApprovalStatus: 'launched' },
    ]);

    await runMigration(db);
    await runMigration(db);

    const rows = await db
      .select({
        name: concepts.name,
        old: concepts.approvalStatus,
        current: concepts.clientApprovalStatus,
        movedAt: concepts.clientApprovalStatusUpdatedAt,
      })
      .from(concepts)
      .where(inArray(concepts.name, ['A', 'B', 'C', 'D', 'E', 'F']));
    expect(rows.map((row) => [row.name, row.old, row.current]).sort()).toEqual([
      ['A', 'approved', 'approved'],
      ['B', 'pending_client', 'pending_for_approval'],
      ['C', 'rejected', 'disapproved'],
      ['D', null, null],
      ['E', 'draft', null],
      ['F', 'rejected', 'launched'],
    ]);
    // A backfill is not a client decision: the move-moment stays unset on every row.
    expect(rows.every((row) => row.movedAt === null)).toBe(true);
  });
});
