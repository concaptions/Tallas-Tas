/* eslint-disable */
// Records 0067_consolidate_internal_status on Railway (0065 pattern, made record-aware). The five
// UPDATEs were run by hand on 2026-10-12 before this file existed (7 + 5 + 0 + 1 + 0 rows), so the
// ordinary case here is: no old value remains, the journal hash is missing — verify and insert the
// hash row only. If an old value is still stored (a fresh database), the SQL runs in one
// transaction first; every UPDATE matches only the old values, so a re-run moves nothing.
// Idempotent: a second run finds the hash and does nothing.
// From packages/db:  DATABASE_URL="postgresql://..." node apply67.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0067_consolidate_internal_status';
const OLD = [
  'video_editing_in_progress',
  'static_design_in_progress',
  'sent_to_video_editor',
  'sent_to_designer',
  'images_revisions',
  'videos_revisions',
  'launched',
  'on_hold',
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
const counts = async () =>
  (
    await c.query(
      'SELECT internal_status, count(*)::int AS n FROM creative_briefs GROUP BY 1 ORDER BY 2 DESC, 1',
    )
  ).rows;
const stale = (rows) => rows.filter((r) => OLD.includes(r.internal_status));
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already recorded (hash ${hash}); nothing to do`);
  } else {
    await c.query('BEGIN');
    const before = await counts();
    console.log('BEFORE internal_status:', before);
    if (stale(before).length > 0) {
      console.log('old values still stored, applying SQL');
      for (const statement of sql.split('--> statement-breakpoint')) await c.query(statement);
    } else {
      console.log('already consolidated by hand; recording the hash only');
    }
    const after = await counts();
    const total = (rows) => rows.reduce((n, r) => n + r.n, 0);
    if (stale(after).length > 0 || total(after) !== total(before)) {
      throw new Error(`verify failed in txn: ${JSON.stringify(after)}`);
    }
    await c.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [hash, entry.when.toString()],
    );
    await c.query('COMMIT');
    console.log(`${TAG} recorded. hash=`, hash);
    console.log('AFTER internal_status:', after);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
