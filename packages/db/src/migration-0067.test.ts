import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { concepts, creativeBriefs } from './schema';
import { seed } from './seed';
import { testDb } from './testing';
import { withBrand } from './tenancy';

/**
 * Migrations 0067 + 0068 on PGlite (Oct 12 client sync, Ticket 5): every retired internal key —
 * the two per-track ladders, `launched` and `on_hold` — lands on the one `INTERNAL_STATUS` list, on
 * briefs (0067) and on concepts (0068); both column defaults become `'draft'`; no row is lost; and
 * a second run changes nothing. `testDb()` already applies both files, so the fixtures are written
 * AFTER it with the old keys (plain text columns, no check) and the SQL is run again twice, the
 * way the apply scripts re-run it against a database that still stores the old values.
 */
const statementsOf = (file: string): string[] =>
  readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8').split(
    '--> statement-breakpoint',
  );

const STATEMENTS_0067 = statementsOf('0067_consolidate_internal_status.sql');
const STATEMENTS_0068 = statementsOf('0068_internal_status_defaults.sql');

/** Old key → the one-list key 0067 / 0068 map it to. */
const MAPPING = {
  sent_to_video_editor: 'sent_to_editor_or_designer',
  sent_to_designer: 'sent_to_editor_or_designer',
  video_editing_in_progress: 'under_editing_or_designing',
  static_design_in_progress: 'under_editing_or_designing',
  images_revisions: 'revisions_needed',
  videos_revisions: 'revisions_needed',
  launched: 'approved',
  on_hold: 'draft',
} as const;
const OLD_KEYS = Object.keys(MAPPING) as (keyof typeof MAPPING)[];

async function runMigrations(db: Awaited<ReturnType<typeof testDb>>): Promise<void> {
  for (const statement of STATEMENTS_0067) await db.execute(sql.raw(statement));
  for (const statement of STATEMENTS_0068) await db.execute(sql.raw(statement));
}

async function columnDefault(
  db: Awaited<ReturnType<typeof testDb>>,
  table: string,
): Promise<unknown> {
  const result = await db.execute(
    sql.raw(
      `SELECT column_default FROM information_schema.columns WHERE table_name='${table}' AND column_name='internal_status'`,
    ),
  );
  return result.rows[0]?.column_default;
}

describe('migrations 0067 + 0068 on PGlite', () => {
  it('moves every retired internal key onto the one list, on briefs and concepts, idempotently', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    // The seeded rows already carry one-list keys; the SQL must leave every one of them alone.
    const seededBriefs = new Map(
      (await scope.select(creativeBriefs)).map((row) => [row.name, row.internalStatus]),
    );
    const seededConcepts = new Map(
      (await scope.select(concepts)).map((row) => [row.name, row.internalStatus]),
    );
    const briefsBefore = seededBriefs.size;
    const conceptsBefore = seededConcepts.size;
    for (const key of OLD_KEYS) {
      await scope.insert(creativeBriefs, {
        name: `OLD-${key}`,
        source: 'TAS',
        internalStatus: key,
        clientStatus: 'pending_for_approval',
        funnel: 'TOF',
        type: 'Video',
      });
    }
    for (const key of OLD_KEYS) {
      await scope.insert(concepts, {
        name: `OLD-${key}`,
        internalStatus: key,
        clientStatus: 'pending_for_approval',
      });
    }

    await runMigrations(db);
    await runMigrations(db);

    const briefs = await scope.select(creativeBriefs);
    expect(briefs).toHaveLength(briefsBefore + OLD_KEYS.length);
    for (const key of OLD_KEYS) {
      expect(briefs.find((row) => row.name === `OLD-${key}`)?.internalStatus).toBe(MAPPING[key]);
    }
    expect(
      briefs.some((row) => OLD_KEYS.includes(row.internalStatus as keyof typeof MAPPING)),
    ).toBe(false);
    for (const [name, status] of seededBriefs) {
      expect(briefs.find((row) => row.name === name)?.internalStatus, name).toBe(status);
    }

    const conceptRows = await scope.select(concepts);
    expect(conceptRows).toHaveLength(conceptsBefore + OLD_KEYS.length);
    for (const key of OLD_KEYS) {
      expect(conceptRows.find((row) => row.name === `OLD-${key}`)?.internalStatus, key).toBe(
        MAPPING[key],
      );
    }
    for (const [name, status] of seededConcepts) {
      expect(conceptRows.find((row) => row.name === name)?.internalStatus, name).toBe(status);
    }
    expect(
      conceptRows.some((row) => OLD_KEYS.includes(row.internalStatus as keyof typeof MAPPING)),
    ).toBe(false);

    expect(await columnDefault(db, 'creative_briefs')).toBe(`'draft'::text`);
    expect(await columnDefault(db, 'concepts')).toBe(`'draft'::text`);
  });
});
