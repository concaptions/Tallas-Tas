/* eslint-disable */
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0057_registry_brand_history';
const sql = fs.readFileSync(`drizzle/${TAG}.sql`, 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entry = journal.entries.find((e) => e.tag === TAG);
if (!entry) {
  console.error('journal entry missing');
  process.exit(1);
}
const when = entry.when;

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already applied (hash ${hash}); nothing to do`);
    await c.end();
    process.exit(0);
  }
  await c.query('BEGIN');
  await c.query(sql);
  await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
    hash,
    when.toString(),
  ]);
  await c.query('COMMIT');
  console.log(`${TAG} applied. hash=`, hash);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
