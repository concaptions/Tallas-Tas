import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const sql = fs.readFileSync('drizzle/0054_worthless_killer_shrike.sql', 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const when = 1791399915629; // from _journal.json entry for 0054

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
try {
  await c.query('BEGIN');
  await c.query(sql);
  await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
    hash,
    when.toString(),
  ]);
  await c.query('COMMIT');
  console.log('0054 applied and journal row inserted. hash=', hash);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
