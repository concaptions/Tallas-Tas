/* eslint-disable */
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const sql = fs.readFileSync('drizzle/0055_client-approval-concepts-creators.sql', 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entry = journal.entries.find((e) => e.tag === '0055_client-approval-concepts-creators');
if (!entry) {
  console.error('journal entry missing');
  process.exit(1);
}
const when = entry.when;

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
  console.log('0055 applied. hash=', hash);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
