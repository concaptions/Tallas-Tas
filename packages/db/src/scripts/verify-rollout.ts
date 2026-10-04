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
  // AI-34: production_status is HIDDEN by the resolver on both bases (never dropped — 73 live values).
  // AI-33 (Talal, 2026-10-04) + the client_status follow-up: both platform tracks are
  // Gratsi-hidden — Gratsi's base has Status only. The client gate reads the DB column.
  { tableKey: 'concepts', inheriting: 21, gratsi: 17, virtual: 0 },
  // AI-41: Gratsi's dead second Concepts link (concept_ids) is retired; 'Concept to film' remains.
  { tableKey: 'creators', inheriting: 36, gratsi: 33, virtual: 0 },
  { tableKey: 'personas', inheriting: 15, gratsi: 7, virtual: 0 },
  { tableKey: 'copy_types', inheriting: 4, gratsi: 4, virtual: 0 },
  { tableKey: 'creative_reporting', inheriting: 13, gratsi: 13, virtual: 1 },
  { tableKey: 'email_campaigns', inheriting: 17, gratsi: 17, virtual: 2 },
  { tableKey: 'email_flows', inheriting: 13, gratsi: 13, virtual: 2 },
  { tableKey: 'sm_campaign_feed_tasks', inheriting: 6, gratsi: 6, virtual: 1 },
  { tableKey: 'youtube_copy', inheriting: 16, gratsi: 16, virtual: 0 },
  // GRATSI-MATCH copywriting (2026-10-04, docs/audits/gratsi-column-diff-2026-10-04.md): the
  // template's full 10-field set (Copy # and the reverse-link Collection column were missing), and
  // Gratsi's 30-field base minus the five decision-doc-flagged fields = 25, in Airtable's order.
  // The one virtual on the inheriting set is `collections` (lookupRollup) — the reverse side of
  // `collections.copywriting_id`.
  { tableKey: 'copywriting', inheriting: 10, gratsi: 25, virtual: 1 },
  { tableKey: 'creative_modules', inheriting: 4, gratsi: 4, virtual: 0 },
  { tableKey: 'client_asset_folders', inheriting: 4, gratsi: 4, virtual: 0 },
  // The name is virtual on both bases: Gratsi relabels it and the formula is read from the parent.
  { tableKey: 'creative_sheet_items', inheriting: 14, gratsi: 14, virtual: 1 },
  // Creative Design, the fifteenth and last hardcoded grid (AI-64a). 30 parent fields plus the
  // platform's own `due_date`; Gratsi hides three and adds five of its own.
  { tableKey: 'creative_briefs', inheriting: 31, gratsi: 33, virtual: 0 },
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
