import { serverEnv } from '@tas/env';

import { seedColumnDefinitions } from '../column-seed';
import { createAutoDb } from '../db';

/**
 * Apply `COLUMN_SEED` to a database — the per-column inheritance configuration every grid, panel
 * and admin screen reads through `resolveColumns`.
 *
 *   pnpm --filter @tas/db seed-columns -- --dry-run   writes, reports, rolls back (the default)
 *   pnpm --filter @tas/db seed-columns -- --apply     commits
 *
 * DRY RUN IS THE DEFAULT, as in `migrate-prod`: the seed is a write against whatever `DATABASE_URL`
 * points at, so the safe outcome is the one you get by forgetting a flag. Every row goes through
 * `upsertColumnDefinition`, keyed on (brand, table, column), so an apply is idempotent and a re-run
 * updates labels and order rather than duplicating rows.
 *
 * A brand the database does not have is REPORTED, never fatal — the seed names five bases and a
 * given environment may carry a subset, so "(absent)" in the output is information, not a failure.
 * The actor recorded in `created_by`/`updated_by` names the script, so a later audit can tell seeded
 * configuration from a human's edit in Column Admin.
 */
const ACTOR = 'script:seed-columns';

class DryRunRollback extends Error {
  constructor() {
    super('dry run: rolling back');
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = createAutoDb(databaseUrl);
  let results: Awaited<ReturnType<typeof seedColumnDefinitions>> = [];
  try {
    try {
      await db.transaction(async (tx) => {
        results = await seedColumnDefinitions(tx, ACTOR);
        if (!apply) throw new DryRunRollback();
      });
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }
    const written = results.reduce((total, row) => total + row.written, 0);
    const retired = results.flatMap((row) => row.retired);
    for (const row of results) {
      console.log(
        `  ${row.brand.padEnd(18)} ${String(row.written).padStart(4)} rows  ${row.brandId}` +
          (row.retired.length > 0 ? `  (${String(row.retired.length)} retired)` : ''),
      );
    }
    // Rows the seed wrote before and no longer lists. Named, never just counted: a retirement is a
    // column disappearing from a brand's grid, which is worth reading before it happens.
    for (const pair of retired) console.log(`    retired ${pair}`);
    console.log(
      `\n${apply ? '[APPLIED]' : '[DRY RUN — ROLLED BACK]'} ${String(written)} column definitions over ${String(results.filter((row) => row.written > 0).length)} base(s).`,
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('seed-columns.ts')) await main();
