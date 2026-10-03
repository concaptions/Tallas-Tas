import { serverEnv } from '@tas/env';

import { resolveColumns } from '../column-definitions';
import { createAutoDb } from '../db';

/**
 * Read back what a database's `column_definitions` actually resolve to, per base and table.
 *
 *   pnpm --filter @tas/db check-columns -- --table personas
 *
 * It calls THE resolver the app calls, so the output is the app's answer rather than a second
 * reading of the same rows: a brand with no rows of its own must come back with the template's
 * columns under the template's labels, and a detached child must come back with its own.
 */
async function main(): Promise<void> {
  const index = process.argv.indexOf('--table');
  const tableKey = (index === -1 ? undefined : process.argv[index + 1]) ?? 'personas';
  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = createAutoDb(databaseUrl);
  try {
    const brands = await db.query.brands.findMany({
      columns: { id: true, slug: true, isTemplate: true },
    });
    for (const brand of [...brands].sort((left, right) =>
      left.isTemplate === right.isTemplate
        ? left.slug.localeCompare(right.slug)
        : Number(right.isTemplate) - Number(left.isTemplate),
    )) {
      const resolved = await resolveColumns(db, brand.id, tableKey);
      console.log(
        `\n${brand.isTemplate ? '★ ' : '  '}${brand.slug} — ${String(resolved.length)} column(s) on ${tableKey}`,
      );
      for (const column of resolved) {
        console.log(
          `    ${String(column.displayOrder).padStart(3)} ${column.columnKey.padEnd(24)} ${JSON.stringify(column.displayLabel).padEnd(56)} ${column.inheritedFrom ?? 'own row'}`,
        );
      }
    }
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('check-columns.ts')) await main();
