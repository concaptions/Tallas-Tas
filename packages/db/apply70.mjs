/* eslint-disable */
// Applies 0070_brief_annotations_and_comments to Railway. Two new tables plus three indexes.
// Idempotent: if the tables and indexes are already present AND the hash is already recorded,
// does nothing; if the hash is missing but the structures are present (applied by hand), records
// the hash only; otherwise runs the SQL inside a transaction and records the hash.
// From packages/db:  DATABASE_URL="postgresql://..." node apply70.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0070_brief_annotations_and_comments';
const TABLES = ['brief_annotations', 'brief_comments'];
const INDEXES = [
  'brief_annotations_brief_version_idx',
  'brief_comments_brief_version_idx',
  'brief_comments_parent_idx',
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
const presentTables = async () =>
  (
    await c.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [TABLES],
    )
  ).rows.map((r) => r.table_name);
const presentIndexes = async () =>
  (
    await c.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])",
      [INDEXES],
    )
  ).rows.map((r) => r.indexname);
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already recorded (hash ${hash}); nothing to do`);
  } else {
    await c.query('BEGIN');
    const beforeTables = await presentTables();
    const beforeIndexes = await presentIndexes();
    console.log('BEFORE tables present:', beforeTables);
    console.log('BEFORE indexes present:', beforeIndexes);
    if (beforeTables.length < TABLES.length || beforeIndexes.length < INDEXES.length) {
      console.log('applying SQL');
      for (const statement of sql.split('--> statement-breakpoint')) await c.query(statement);
    } else {
      console.log('already applied by hand; recording the hash only');
    }
    const afterTables = await presentTables();
    const afterIndexes = await presentIndexes();
    if (afterTables.length !== TABLES.length || afterIndexes.length !== INDEXES.length) {
      throw new Error(
        `verify failed in txn: ${JSON.stringify({ tables: afterTables, indexes: afterIndexes })}`,
      );
    }
    await c.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [hash, entry.when.toString()],
    );
    await c.query('COMMIT');
    console.log(`${TAG} recorded. hash=`, hash);
    console.log('AFTER tables present:', afterTables);
    console.log('AFTER indexes present:', afterIndexes);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
