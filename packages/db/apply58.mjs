/* eslint-disable */
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0058_registry_intro_videos';
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
  } else {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
      hash,
      when.toString(),
    ]);
    await c.query('COMMIT');
    console.log(`${TAG} applied. hash=`, hash);
  }
  const check = await c.query(
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'creator_registry' AND column_name = 'intro_videos'",
  );
  const col = check.rows[0];
  if (!col || col.data_type !== 'jsonb' || col.is_nullable !== 'NO') {
    console.error(
      'VERIFY FAILED: creator_registry.intro_videos is not a NOT NULL jsonb column',
      col ?? null,
    );
    process.exitCode = 1;
  } else {
    console.log('verified: creator_registry.intro_videos', col);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
