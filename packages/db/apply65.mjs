/* eslint-disable */
// Applies 0065_concept_name_mode to Railway in ONE transaction with a verify step (0064 pattern):
// sha256 of the SQL is the journal hash, so a second run is a no-op. Verifies in-transaction that
// the column exists with its default, that every live concept reads 'manual', that the row count
// is unchanged, and that the check constraint is present.
// From packages/db:  DATABASE_URL="postgresql://..." node apply65.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0065_concept_name_mode';
const sql = fs.readFileSync(`drizzle/${TAG}.sql`, 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entry = journal.entries.find((e) => e.tag === TAG);
if (!entry) {
  console.error('journal entry missing');
  process.exit(1);
}

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const count = async () => (await c.query('SELECT count(*)::int AS n FROM concepts')).rows[0].n;
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already applied (hash ${hash}); nothing to do`);
  } else {
    const before = await count();
    console.log('BEFORE concepts:', before);
    await c.query('BEGIN');
    for (const statement of sql.split('--> statement-breakpoint')) await c.query(statement);
    await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
      hash,
      entry.when.toString(),
    ]);
    const column = (
      await c.query(
        "SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name='concepts' AND column_name='name_mode'",
      )
    ).rows[0];
    const modes = (
      await c.query('SELECT name_mode, count(*)::int AS n FROM concepts GROUP BY 1 ORDER BY 1')
    ).rows;
    const constraint = (
      await c.query("SELECT 1 FROM pg_constraint WHERE conname = 'concepts_name_mode_check'")
    ).rowCount;
    const after = await count();
    const allManual = modes.length === 1 && modes[0].name_mode === 'manual' && modes[0].n === after;
    if (
      !column ||
      column.is_nullable !== 'NO' ||
      !String(column.column_default).includes('manual') ||
      !allManual ||
      constraint !== 1 ||
      after !== before
    ) {
      throw new Error(
        `verify failed in txn: column ${JSON.stringify(column)}, modes ${JSON.stringify(modes)}, constraint ${constraint}, count ${before} -> ${after}`,
      );
    }
    await c.query('COMMIT');
    console.log(`${TAG} applied. hash=`, hash);
    console.log('AFTER name_mode:', modes, 'concepts:', after);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
