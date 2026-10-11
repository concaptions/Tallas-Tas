import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { seed } from './seed';
import { testDb } from './testing';

/**
 * Migration 0065 on PGlite (SMOKE-31): `concepts.name_mode` arrives NOT NULL, default 'manual', with
 * its check constraint, every existing row reading 'manual' — and a second run changes nothing.
 * The Drizzle schema does not carry the column yet (code follows the apply), so the rows are read
 * with raw SQL.
 */
const STATEMENTS = readFileSync(
  new URL('../drizzle/0065_concept_name_mode.sql', import.meta.url),
  'utf8',
).split('--> statement-breakpoint');

async function runMigration(db: Awaited<ReturnType<typeof testDb>>): Promise<void> {
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
}

describe('migration 0065 on PGlite', () => {
  it('adds name_mode as manual on every existing concept, checked, idempotently', async () => {
    const db = await testDb();
    await seed(db);
    await runMigration(db);
    await runMigration(db);

    const modes = (
      await db.execute(sql.raw('SELECT name_mode, count(*)::int AS n FROM concepts GROUP BY 1'))
    ).rows as { name_mode: string; n: number }[];
    expect(modes.map((row) => row.name_mode)).toEqual(['manual']);
    expect(modes[0]?.n).toBeGreaterThan(0);

    // The constraint rejects a stray value (drizzle wraps the Postgres error; its cause names it).
    const stray = await db.execute(sql.raw("UPDATE concepts SET name_mode = 'typo'")).then(
      () => null,
      (error: unknown) => error,
    );
    expect(stray).not.toBeNull();
    expect(JSON.stringify(stray, Object.getOwnPropertyNames(stray as object))).toContain(
      'concepts_name_mode_check',
    );
    const nulls = await db.execute(
      sql.raw(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='concepts' AND column_name='name_mode'",
      ),
    );
    expect(nulls.rows).toEqual([{ is_nullable: 'NO' }]);
  });
});
