import { and, eq, isNull, sql } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb } from '../db';
import { brands, personas } from '../schema';

/**
 * Backfill ONE field: Gratsi's Personas › "Passion" into `personas.passion` (migration 0044).
 *
 *   pnpm --filter @tas/db import-passion -- --dry-run   reports every change, writes nothing (default)
 *   pnpm --filter @tas/db import-passion -- --apply     commits
 *
 * WHY THIS IS NOT A RUN OF THE IMPORTER. `importAirtableExport`'s second pass CLEARS each junction
 * for the records it imports and re-links them from the export, so importing one table in isolation
 * deletes links whose other end is not in the slice — that is how `concept_angles` went from 115
 * rows to 4 on 2026-10-01 (memory: the import slicing hazard). Personas carry `angle_personas`, so
 * re-importing the table to pick up one text column would risk the same damage for no reason.
 *
 * This writes `passion` and NOTHING else: no junction is read or touched, rows are matched on
 * `legacy_airtable_id` so no name-matching can mis-assign a value, and a row is only written when
 * Airtable's value actually differs from what is stored. Scoped to the Gratsi brand because
 * "Passion" is Gratsi's own field — no other base defines it (column_definitions source "custom").
 */
const GRATSI_SLUG = 'gratsi';
const ACTOR = 'script:import-passion';

interface AirtableRecord {
  readonly id: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

/** Every Gratsi Personas record, carrying the one field this script writes. */
async function fetchPassion(pat: string, baseId: string): Promise<Map<string, string>> {
  const values = new Map<string, string>();
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/Personas`);
    url.searchParams.set('fields[]', 'Passion');
    url.searchParams.set('pageSize', '100');
    if (offset !== undefined) url.searchParams.set('offset', offset);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!response.ok) {
      throw new Error(`Airtable: HTTP ${String(response.status)} ${await response.text()}`);
    }
    const page = (await response.json()) as {
      readonly records: readonly AirtableRecord[];
      readonly offset?: string;
    };
    for (const record of page.records) {
      const value = record.fields.Passion;
      if (typeof value === 'string' && value.trim() !== '') values.set(record.id, value);
    }
    offset = page.offset;
  } while (offset !== undefined);
  return values;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const baseId = 'appllDG4OmkK2Hdnn';
  const env = serverEnv();
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!env.AIRTABLE_PAT) throw new Error('AIRTABLE_PAT is required');

  const fromAirtable = await fetchPassion(env.AIRTABLE_PAT, baseId);
  console.log(`Airtable: ${String(fromAirtable.size)} Gratsi persona(s) carry a Passion value.`);

  const db = createAutoDb(env.DATABASE_URL);
  try {
    const [brand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, GRATSI_SLUG))
      .limit(1);
    if (brand === undefined) throw new Error(`no brand with slug "${GRATSI_SLUG}"`);

    const rows = await db
      .select({
        id: personas.id,
        name: personas.name,
        legacyAirtableId: personas.legacyAirtableId,
        passion: personas.passion,
      })
      .from(personas)
      .where(and(eq(personas.brandId, brand.id), isNull(personas.deletedAt)));
    console.log(`Database: ${String(rows.length)} live Gratsi persona(s).`);

    const changes = rows.flatMap((row) => {
      if (row.legacyAirtableId === null) return [];
      const incoming = fromAirtable.get(row.legacyAirtableId);
      if (incoming === undefined || incoming === row.passion) return [];
      return [{ id: row.id, name: row.name, from: row.passion, to: incoming }];
    });

    for (const change of changes) {
      console.log(
        `  ${change.name.slice(0, 44).padEnd(44)} ${change.from === null ? '(empty)' : JSON.stringify(change.from.slice(0, 24))} -> ${JSON.stringify(change.to.slice(0, 48))}`,
      );
    }
    const unmatched = rows.filter(
      (row) => row.legacyAirtableId === null || !fromAirtable.has(row.legacyAirtableId),
    );
    console.log(
      `\n${String(changes.length)} row(s) would change; ${String(rows.length - changes.length - unmatched.length)} already correct; ${String(unmatched.length)} carry no Airtable Passion value.`,
    );

    if (apply) {
      for (const change of changes) {
        await db
          .update(personas)
          .set({ passion: change.to, updatedBy: ACTOR, updatedAt: sql`now()` })
          .where(eq(personas.id, change.id));
      }
    }
    console.log(
      `${apply ? '[APPLIED]' : '[DRY RUN — NOTHING WRITTEN]'} ${String(apply ? changes.length : 0)} row(s) updated.`,
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('import-passion.ts')) await main();
