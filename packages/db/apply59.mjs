/* eslint-disable */
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0059_creative_sheet_dimensions';
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
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'creative_sheet_items' AND column_name = 'dimensions'",
  );
  const col = check.rows[0];
  if (!col || col.data_type !== 'jsonb' || col.is_nullable !== 'NO') {
    console.error(
      'VERIFY FAILED: creative_sheet_items.dimensions is not a NOT NULL jsonb column',
      col ?? null,
    );
    process.exitCode = 1;
  } else {
    console.log('verified: creative_sheet_items.dimensions', col);
    const filled = await c.query(
      'SELECT COUNT(*) FILTER (WHERE jsonb_array_length(dimensions) > 0) AS filled, COUNT(*) AS total FROM creative_sheet_items',
    );
    console.log('items with dimensions:', filled.rows[0]?.filled, 'of', filled.rows[0]?.total);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
