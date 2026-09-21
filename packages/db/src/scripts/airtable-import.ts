import { readFileSync } from 'node:fs';

import { serverEnv } from '@tas/env';

import { importAirtableExport, type AirtableExport } from '../airtable-import';
import { createAutoDb } from '../db';

async function main(): Promise<void> {
  const fileIdx = process.argv.indexOf('--file');
  const brandIdx = process.argv.indexOf('--brand-name');
  if (fileIdx === -1 || brandIdx === -1) {
    console.error('Usage: pnpm --filter @tas/db airtable-import --file <path> --brand-name <name>');
    process.exit(1);
  }
  const filePath = process.argv[fileIdx + 1];
  const brandName = process.argv[brandIdx + 1];
  if (!filePath || !brandName) {
    console.error('Both --file and --brand-name require a value');
    process.exit(1);
  }

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const db = createAutoDb(databaseUrl);
  const data = JSON.parse(readFileSync(filePath, 'utf-8')) as AirtableExport;

  const { brands } = await import('../schema');
  const { eq } = await import('drizzle-orm');
  const [brand] = await db.select().from(brands).where(eq(brands.name, brandName)).limit(1);
  if (!brand) throw new Error(`Brand "${brandName}" not found`);

  const results = await importAirtableExport(db, data, brand.id, 'airtable-migration');

  console.log('\nAirtable Import Results:');
  for (const [table, r] of Object.entries(results)) {
    console.log(
      `  ${table}: ${String(r.imported)} imported, ${String(r.skipped)} skipped, ${String(r.failed)} failed`,
    );
    for (const err of r.errors) console.log(`    ERROR: ${err}`);
  }

  await db.$client.end();
}

await main();
