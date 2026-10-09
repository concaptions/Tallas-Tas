/* eslint-disable */
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0060_brief_name_mode';
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
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'creative_briefs' AND column_name = 'name_mode'",
  );
  const col = check.rows[0];
  const constraint = await c.query(
    "SELECT 1 FROM pg_constraint WHERE conname = 'creative_briefs_name_mode_check' AND contype = 'c'",
  );
  if (!col || col.data_type !== 'text' || col.is_nullable !== 'NO' || constraint.rowCount !== 1) {
    console.error(
      'VERIFY FAILED: creative_briefs.name_mode is not a NOT NULL text column with its CHECK constraint',
      col ?? null,
    );
    process.exitCode = 1;
  } else {
    console.log('verified: creative_briefs.name_mode', col);
    const modes = await c.query(
      'SELECT name_mode, COUNT(*)::int AS briefs FROM creative_briefs GROUP BY 1 ORDER BY 1',
    );
    console.log('briefs by name_mode (every existing row must be manual):', modes.rows);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
