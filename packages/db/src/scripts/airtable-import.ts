import { readFileSync } from 'node:fs';

import { serverEnv } from '@tas/env';

import { importAirtableExport, type AirtableExport } from '../airtable-import';
import { createAutoDb } from '../db';

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

  if (dryRun) {
    console.log(`\n[DRY RUN] Would import into brand ${resolvedBrandId}:`);
    for (const [table, records] of Object.entries(data)) {
      if (Array.isArray(records)) {
        console.log(`  ${table}: ${String(records.length)} records`);
      }
    }
    await db.$client.end();
    return;
  }

  const results = await importAirtableExport(db, data, resolvedBrandId, 'airtable-migration');

  console.log('\nAirtable Import Results:');
  for (const [table, r] of Object.entries(results)) {
    console.log(
      `  ${table}: ${String(r.imported)} imported, ${String(r.skipped)} skipped, ${String(r.failed)} failed`,
    );
    for (const err of r.errors) console.log(`    ERROR: ${err}`);
  }

  const total = Object.values(results).reduce(
    (acc, r) => ({
      imported: acc.imported + r.imported,
      skipped: acc.skipped + r.skipped,
      failed: acc.failed + r.failed,
    }),
    { imported: 0, skipped: 0, failed: 0 },
  );
  console.log(
    `\nTotal: ${String(total.imported)} imported, ${String(total.skipped)} skipped, ${String(total.failed)} failed`,
  );

  await db.$client.end();
}

await main();
