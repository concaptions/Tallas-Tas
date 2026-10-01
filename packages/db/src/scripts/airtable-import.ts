import { readFileSync } from 'node:fs';

import { serverEnv } from '@tas/env';

import {
  emptyWarnings,
  importAirtableExport,
  type AirtableExport,
  type ImportWarnings,
} from '../airtable-import';
import { createAutoDb } from '../db';
import { applyPendingMigrations } from './migrate-prod';

/** Thrown after a --dry-run import so the surrounding transaction rolls everything back. */
class DryRunRollback extends Error {
  constructor() {
    super('dry run: rolling back');
  }
}

function printReport(
  results: Record<
    string,
    { imported: number; updated: number; skipped: number; failed: number; errors: string[] }
  >,
  warnings: ImportWarnings,
): void {
  console.log('\nPer table (imported / updated / skipped / failed):');
  for (const [table, r] of Object.entries(results)) {
    console.log(
      `  ${table}: ${String(r.imported)} / ${String(r.updated)} / ${String(r.skipped)} / ${String(r.failed)}`,
    );
    for (const err of r.errors) console.log(`    ERROR: ${err}`);
  }
  console.log(`\nAttachment URLs captured: ${String(warnings.attachmentsCaptured)}`);
  if (warnings.unmappedValues.size > 0) {
    console.log(
      '\nSelect values outside the explicit maps (stored as normalized key, or NULL where marked):',
    );
    for (const [key, n] of [...warnings.unmappedValues.entries()].sort()) {
      console.log(`  ${key} x${String(n)}`);
    }
  }
  if (warnings.brokenRefs.size > 0) {
    console.log('\nRecord links that resolved to nothing (target not in the export):');
    for (const [key, n] of [...warnings.brokenRefs.entries()].sort()) {
      console.log(`  ${key} x${String(n)}`);
    }
  }
  for (const note of warnings.general) console.log(`\nNOTE: ${note}`);
}

function flag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const filePath = flag('--file');
  const brandName = flag('--brand-name');
  const brandId = flag('--brand-id');
  const dryRun = process.argv.includes('--dry-run');

  if (!filePath || (!brandName && !brandId)) {
    console.error(
      'Usage: pnpm --filter @tas/db airtable-import --file <path> --brand-name <name> [--brand-id <uuid>] [--dry-run]',
    );
    process.exit(1);
  }

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const db = createAutoDb(databaseUrl);
  const data = JSON.parse(readFileSync(filePath, 'utf-8')) as AirtableExport;

  let resolvedBrandId = brandId;
  if (!resolvedBrandId) {
    const { brands } = await import('../schema');
    const { eq } = await import('drizzle-orm');
    const name = brandName ?? '';
    const [brand] = await db.select().from(brands).where(eq(brands.name, name)).limit(1);
    if (!brand) throw new Error(`Brand "${name}" not found`);
    resolvedBrandId = brand.id;
  }

  console.log(`\nSource records in the export file:`);
  for (const [table, records] of Object.entries(data)) {
    if (Array.isArray(records)) console.log(`  ${table}: ${String(records.length)} records`);
  }

  // The whole import — dry or live — runs inside ONE transaction. A dry run executes every insert,
  // update and junction write against the real database and then rolls the transaction back, so
  // the printed report is exactly what a live run would commit; a live run that fails anywhere
  // rolls back the same way and leaves nothing half-imported.
  const warnings = emptyWarnings();
  // A property, not a `let`: TS does not flow-narrow closure assignments, and a plain variable
  // would read as always-null after the transaction callback.
  const run: { results: Awaited<ReturnType<typeof importAirtableExport>> | null } = {
    results: null,
  };
  try {
    await db.transaction(async (tx) => {
      const migrated = await applyPendingMigrations(tx);
      if (migrated.length > 0)
        console.log(
          `\n${dryRun ? '[DRY RUN] previewing' : 'Applying'} pending migrations: ${migrated.join(', ')}`,
        );
      run.results = await importAirtableExport(
        tx,
        data,
        resolvedBrandId,
        'airtable-migration',
        warnings,
      );
      if (dryRun) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  if (run.results === null) throw new Error('import produced no results');
  console.log(dryRun ? '\n[DRY RUN — TRANSACTION ROLLED BACK, NOTHING WRITTEN]' : '\n[COMMITTED]');
  printReport(run.results, warnings);

  await db.$client.end();
}

await main();
