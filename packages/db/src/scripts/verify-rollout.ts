import { serverEnv } from '@tas/env';
import { eq } from 'drizzle-orm';

import { resolveColumns, storedColumns, virtualColumns } from '../column-definitions';
import { createAutoDb } from '../db';
import { brands } from '../schema';

/**
 * Read every migrated table back through THE resolver, per brand, against whatever `DATABASE_URL`
 * points at. The counts are the ones the PGlite gates assert, so a mismatch here means production
 * and the tests disagree — which is the only thing this script exists to catch.
 *
 *   pnpm --filter @tas/db verify-rollout
 */
const EXPECTED: readonly {
  readonly tableKey: string;
  readonly inheriting: number;
  readonly gratsi: number;
  readonly virtual: number;
}[] = [
  { tableKey: 'products', inheriting: 12, gratsi: 9, virtual: 0 },
  { tableKey: 'angles', inheriting: 16, gratsi: 11, virtual: 0 },
  { tableKey: 'concepts', inheriting: 22, gratsi: 20, virtual: 0 },
  { tableKey: 'creators', inheriting: 36, gratsi: 34, virtual: 0 },
  { tableKey: 'personas', inheriting: 15, gratsi: 7, virtual: 0 },
  { tableKey: 'copy_types', inheriting: 4, gratsi: 4, virtual: 0 },
  { tableKey: 'creative_reporting', inheriting: 13, gratsi: 13, virtual: 1 },
  { tableKey: 'email_campaigns', inheriting: 17, gratsi: 17, virtual: 2 },
  { tableKey: 'email_flows', inheriting: 13, gratsi: 13, virtual: 2 },
  { tableKey: 'sm_campaign_feed_tasks', inheriting: 6, gratsi: 6, virtual: 1 },
  { tableKey: 'youtube_copy', inheriting: 16, gratsi: 16, virtual: 0 },
  { tableKey: 'creative_modules', inheriting: 4, gratsi: 4, virtual: 0 },
  { tableKey: 'client_asset_folders', inheriting: 4, gratsi: 4, virtual: 0 },
];

async function main(): Promise<void> {
  const url = serverEnv().DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const db = createAutoDb(url);
  let failures = 0;
  try {
    const brandId = async (slug: string): Promise<string> => {
      const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
      if (row === undefined) throw new Error(`no brand ${slug}`);
      return row.id;
    };
    const niagara = await brandId('niagara-sleep-solutions');
    const gratsi = await brandId('gratsi');

    for (const row of EXPECTED) {
      const onNiagara = await resolveColumns(db, niagara, row.tableKey);
      const onGratsi = await resolveColumns(db, gratsi, row.tableKey);
      const virt = virtualColumns(onNiagara);
      const ok =
        onNiagara.length === row.inheriting &&
        onGratsi.length === row.gratsi &&
        virt.length === row.virtual;
      if (!ok) failures += 1;
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${row.tableKey.padEnd(24)} inheriting ${String(onNiagara.length).padStart(2)}/${String(row.inheriting).padEnd(2)} gratsi ${String(onGratsi.length).padStart(2)}/${String(row.gratsi).padEnd(2)} virtual ${String(virt.length)}/${String(row.virtual)}` +
          (virt.length > 0
            ? `  [${virt.map((c) => `${c.columnKey}=${c.formula ?? '?'}`).join(' ')}]`
            : ''),
      );
      // A virtual column must never be in the writable set.
      for (const column of virt) {
        if (storedColumns(onNiagara).some((stored) => stored.columnKey === column.columnKey)) {
          failures += 1;
          console.log(`  FAIL ${row.tableKey}.${column.columnKey} is virtual AND in storedColumns`);
        }
      }
    }
  } finally {
    await db.$client.end();
  }
  console.log(
    failures === 0 ? '\n✓ every table matches its test' : `\n✗ ${String(failures)} mismatch(es)`,
  );
  if (failures > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('verify-rollout.ts')) await main();
