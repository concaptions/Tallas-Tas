/* eslint-disable */
// Applies 0064_concept_client_approval_backfill to Railway in ONE transaction with a verify step
// (0063 pattern): sha256 of the SQL is the journal hash, so a second run is a no-op. Prints the
// per-status counts of approval_status and client_approval_status before and after, and verifies
// IN the transaction that every live row whose approval_status is one of the three mapped values
// now carries the mapped client_approval_status (or the value it already had), that no other row's
// client_approval_status changed, and that the approval_status counts are untouched.
// From packages/db:  DATABASE_URL="postgresql://..." node apply64.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0064_concept_client_approval_backfill';
const sql = fs.readFileSync(`drizzle/${TAG}.sql`, 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entry = journal.entries.find((e) => e.tag === TAG);
if (!entry) {
  console.error('journal entry missing');
  process.exit(1);
}
const MAP = {
  approved: 'approved',
  pending_client: 'pending_for_approval',
  rejected: 'disapproved',
};

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const counts = async (column) =>
  (
    await c.query(
      `SELECT ${column} AS value, COUNT(*)::int AS n FROM concepts WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1 NULLS FIRST`,
    )
  ).rows;
const rows = async () =>
  (
    await c.query(
      'SELECT id, approval_status, client_approval_status FROM concepts WHERE deleted_at IS NULL ORDER BY id',
    )
  ).rows;
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already applied (hash ${hash}); nothing to do`);
  } else {
    const beforeOld = await counts('approval_status');
    const beforeNew = await counts('client_approval_status');
    const before = await rows();
    console.log('BEFORE approval_status:', beforeOld);
    console.log('BEFORE client_approval_status:', beforeNew);
    await c.query('BEGIN');
    await c.query(sql.split('--> statement-breakpoint').join('\n'));
    await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
      hash,
      entry.when.toString(),
    ]);
    const afterOld = await counts('approval_status');
    const afterNew = await counts('client_approval_status');
    const after = await rows();
    const wrong = [];
    for (const row of after) {
      const was = before.find((b) => b.id === row.id);
      const expected =
        was.client_approval_status !== null
          ? was.client_approval_status
          : (MAP[row.approval_status] ?? null);
      if (row.client_approval_status !== expected) wrong.push(row);
    }
    if (
      JSON.stringify(afterOld) !== JSON.stringify(beforeOld) ||
      after.length !== before.length ||
      wrong.length > 0
    ) {
      throw new Error(
        `verify failed in txn: ${wrong.length} rows off ${JSON.stringify(wrong.slice(0, 5))}; approval_status counts before ${JSON.stringify(beforeOld)} after ${JSON.stringify(afterOld)}`,
      );
    }
    await c.query('COMMIT');
    console.log(`${TAG} applied. hash=`, hash);
    console.log('AFTER approval_status:', afterOld);
    console.log('AFTER client_approval_status:', afterNew);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
