/* eslint-disable */
// Records 0066_drop_retired_columns on Railway (0065 pattern, made record-aware). The six DROP
// COLUMNs were run by hand on 2026-10-12 before this file existed, so the ordinary case here is:
// the columns are already gone, the journal hash is missing — verify the end state and insert the
// hash row only. If a column is still present (a fresh database), the SQL runs in one transaction
// first. Idempotent: a second run finds the hash and does nothing.
// From packages/db:  DATABASE_URL="postgresql://..." node apply66.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0066_drop_retired_columns';
const DROPPED = [
  ['copywriting', 'used'],
  ['copywriting', 'winning'],
  ['copywriting', 'meta_rating'],
  ['copywriting', 'client_comment'],
  ['concepts', 'formats_to_create'],
  ['concepts', 'production_status'],
];
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
const present = async () =>
  (
    await c.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE (table_name, column_name) IN (${DROPPED.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')})`,
      DROPPED.flat(),
    )
  ).rows;
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already recorded (hash ${hash}); nothing to do`);
  } else {
    await c.query('BEGIN');
    const before = await present();
    if (before.length > 0) {
      console.log('columns still present, applying SQL:', before);
      for (const statement of sql.split('--> statement-breakpoint')) await c.query(statement);
    } else {
      console.log('columns already dropped by hand; recording the hash only');
    }
    const after = await present();
    if (after.length !== 0) {
      throw new Error(`verify failed in txn: columns still present ${JSON.stringify(after)}`);
    }
    // No unique constraint exists on the hash column, so the SELECT above is the idempotency
    // guard; ON CONFLICT DO NOTHING is kept for a database that adds one.
    await c.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [hash, entry.when.toString()],
    );
    await c.query('COMMIT');
    console.log(`${TAG} recorded. hash=`, hash);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
