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
  // GRATSI-MATCH 2026-10-04 (links cluster): the diff's two leaks (Collection Link, Concepts) are
  // Gratsi-hidden and the seven real fields read in the live base's order — Gratsi 7.
  { tableKey: 'products', inheriting: 12, gratsi: 7, virtual: 0 },
  // GRATSI-MATCH 2026-10-04 (links cluster): Gratsi angles now carries the live base's 21 fields
  // minus the five decision-register exclusions — three reverse links and the two Concepts-side
  // lookups resolve as read-only columns, in Airtable order.
  // Fidelity flip 2026-10-04: Creators shown fidelity-empty (virtual lookupRollup; stores nothing).
  { tableKey: 'angles', inheriting: 16, gratsi: 17, virtual: 0 },
  // AI-34: production_status is HIDDEN by the resolver on both bases (never dropped — 73 live values).
  // AI-33 (Talal, 2026-10-04) + the client_status follow-up: both platform tracks are
  // Gratsi-hidden — Gratsi's base has Status only. The client gate reads the DB column.
  // GRATSI-MATCH 2026-10-04 (links cluster): plus UGC Management (creator_concepts un-hidden),
  // Campaigns & Offers, (Internal) Creative Design and the virtual Performance lookup — Gratsi 21.
  // Fidelity flip 2026-10-04: Production Status shown again for Gratsi (its base has it; AI-34
  // keeps the hide everywhere else).
  { tableKey: 'concepts', inheriting: 21, gratsi: 22, virtual: 0 },
  // AI-41: Gratsi's dead second Concepts link (concept_ids) is retired; 'Concept to film' remains.
  // GRATSI-MATCH 2026-10-04 (links cluster): plus the two formula fields as virtual columns
  // (Creator's cost (USD), Notify Flag) in the live base's order — Gratsi 35.
  // Fidelity flip 2026-10-04: the second Concepts link drawn again (own stored ids, 0/70).
  { tableKey: 'creators', inheriting: 36, gratsi: 36, virtual: 0 },
  { tableKey: 'personas', inheriting: 15, gratsi: 7, virtual: 0 },
  { tableKey: 'copy_types', inheriting: 4, gratsi: 4, virtual: 0 },
  // GRATSI-MATCH 2026-10-04 (links cluster): Gratsi words the first two columns as its base does
  // and adds the Creative Name (from Creative) lookup as a virtual custom row — Gratsi 14.
  { tableKey: 'creative_reporting', inheriting: 13, gratsi: 14, virtual: 1 },
  { tableKey: 'email_campaigns', inheriting: 17, gratsi: 17, virtual: 2 },
  { tableKey: 'email_flows', inheriting: 13, gratsi: 13, virtual: 2 },
  { tableKey: 'sm_campaign_feed_tasks', inheriting: 6, gratsi: 6, virtual: 1 },
  // GRATSI-MATCH youtube_copy (2026-10-04, docs/audits/gratsi-column-diff-2026-10-04.md): Gratsi
  // adds its six link-lookups, (Internal) Product and Created By as child rows = 24 of the base's
  // 29 (five decision-doc-flagged); the platform set other brands inherit stays 16.
  { tableKey: 'youtube_copy', inheriting: 16, gratsi: 24, virtual: 0 },
  // GRATSI-MATCH copywriting (2026-10-04, docs/audits/gratsi-column-diff-2026-10-04.md): the
  // template's full 10-field set (Copy # and the reverse-link Collection column were missing), and
  // Gratsi's 30-field base minus the five decision-doc-flagged fields = 25, in Airtable's order.
  // The one virtual on the inheriting set is `collections` (lookupRollup) — the reverse side of
  // `collections.copywriting_id`.
  { tableKey: 'copywriting', inheriting: 10, gratsi: 25, virtual: 1 },
  { tableKey: 'creative_modules', inheriting: 4, gratsi: 4, virtual: 0 },
  { tableKey: 'client_asset_folders', inheriting: 4, gratsi: 4, virtual: 0 },
  // The name is virtual on both bases: Gratsi relabels it and the formula is read from the parent.
  // GRATSI-MATCH creative_sheet_items (2026-10-04): the parent gains its own `Last Modified`
  // (template field 17) = 15; Gratsi displays its FULL 29-field base — the thirteen Creative Name
  // lookups are alive there and seeded as child-added lookupRollup virtuals, dead in the template
  // only (docs/decisions/overnight-dead-lookups.md), plus Created/Last Modified.
  { tableKey: 'creative_sheet_items', inheriting: 15, gratsi: 29, virtual: 1 },
  // Creative Design, the fifteenth and last hardcoded grid (AI-64a). 30 parent fields plus the
  // platform's own `due_date`; Gratsi hides three and adds five of its own.
  // GRATSI-MATCH 2026-10-04 (links cluster): plus the live base's remaining fields — three
  // reverse links, the Last Modified/Created displays and the Concepts (from Angles) lookup —
  // minus the four decision-register exclusions; Due Date stays per AI-49. Gratsi 39.
  // Fidelity flip 2026-10-04: Ads Copywriting copy shown fidelity-empty (virtual). Gratsi 40.
  { tableKey: 'creative_briefs', inheriting: 31, gratsi: 40, virtual: 0 },
  // GRATSI-MATCH campaigns_offers (2026-10-04, WIRING cluster): absent from this script until that
  // run, because the page was not resolver-driven. 13 of the template's 14 fields (`Design
  // attached` is register-excluded); Gratsi = its 20 fields minus the `Product` lookup and
  // `Design attached` (both rule-5 flags in docs/decisions.md), with `(Internal) Product` hidden.
  { tableKey: 'campaigns_offers', inheriting: 13, gratsi: 18, virtual: 0 },
  // GRATSI-MATCH collections (2026-10-04, WIRING cluster): absent until that run. The template's
  // 8 fields; Gratsi = its 13 fields minus the four rule-5 flags (Creative Sheet, Table 17, the
  // duplicate Email Campaigns Management copy pair — docs/decisions.md "GRATSI-MATCH collections"),
  // with the template's angle_id and creative_design_2_id hidden.
  { tableKey: 'collections', inheriting: 8, gratsi: 9, virtual: 0 },
  // GRATSI-MATCH creative_dimensions (2026-10-04, WIRING cluster): absent until that run.
  // Identical in both bases — four fields, no flags, Gratsi holds no rows and inherits all four.
  { tableKey: 'creative_dimensions', inheriting: 4, gratsi: 4, virtual: 0 },
  // GRATSI-MATCH competitive_research (2026-10-04, WIRING cluster): absent until that run.
  // Identical in both bases — seven stored fields, no flags, Gratsi holds no rows.
  { tableKey: 'competitive_research', inheriting: 7, gratsi: 7, virtual: 0 },
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
      // Each table reads on a FRESH connection, retried up to three times. The wire to the
      // database intermittently corrupts pg's framing mid-stream (ERR_OUT_OF_RANGE in pg-protocol
      // at a random table, a different garbage offset every run — observed 2026-10-04; every
      // assertion that completes is green, so this is transport, not data). A verification script
      // must distinguish "the check failed" from "the wire hiccuped": transient transport errors
      // are retried on a new connection, and only an exhausted retry counts as a failure.
      let onNiagara: Awaited<ReturnType<typeof resolveColumns>> | null = null;
      let onGratsi: Awaited<ReturnType<typeof resolveColumns>> | null = null;
      for (let attempt = 1; attempt <= 3 && onGratsi === null; attempt += 1) {
        const tableDb = createAutoDb(url);
        try {
          onNiagara = await resolveColumns(tableDb, niagara, row.tableKey);
          onGratsi = await resolveColumns(tableDb, gratsi, row.tableKey);
        } catch (error) {
          if (attempt === 3) throw error;
          console.log(
            `  retry ${String(attempt)}/3 ${row.tableKey}: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`,
          );
        } finally {
          await tableDb.$client.end().catch(() => undefined);
        }
      }
      if (onNiagara === null || onGratsi === null) throw new Error(`${row.tableKey}: unreachable`);
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
