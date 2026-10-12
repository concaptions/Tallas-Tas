/* eslint-disable */
// Applies 0068_internal_status_defaults to Railway (apply67 pattern, record-aware). 0067 moved the
// creative_briefs ROWS onto the Oct 12 one-list vocabulary (Ticket 5) but left both column defaults
// minting 'sent_to_video_editor' and never touched concepts.internal_status, which sat on that
// default on every brand. This script: if either default is still the old key or a concept still
// carries a retired value, runs the SQL in one transaction; otherwise (already applied by hand) it
// verifies and records the hash only. Idempotent: a second run finds the hash and does nothing.
// Prints the concepts count by internal_status before and after for the sprint record.
// From packages/db:  DATABASE_URL="postgresql://..." node apply68.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0068_internal_status_defaults';
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
      'SELECT internal_status, count(*)::int AS n FROM concepts GROUP BY 1 ORDER BY 2 DESC, 1',
    )
  ).rows;
const defaults = async () =>
  Object.fromEntries(
    (
      await c.query(
        "SELECT table_name, column_default FROM information_schema.columns WHERE table_name IN ('creative_briefs', 'concepts') AND column_name = 'internal_status'",
      )
    ).rows.map((r) => [r.table_name, r.column_default]),
  );
const stale = (rows) => rows.filter((r) => OLD.includes(r.internal_status));
const total = (rows) => rows.reduce((n, r) => n + r.n, 0);
const defaultsSettled = (d) =>
  d.creative_briefs === "'draft'::text" && d.concepts === "'draft'::text";
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already recorded (hash ${hash}); nothing to do`);
  } else {
    await c.query('BEGIN');
    const before = await counts();
    const beforeDefaults = await defaults();
    console.log('BEFORE concepts.internal_status:', before);
    console.log('BEFORE defaults:', beforeDefaults);
    if (stale(before).length > 0 || !defaultsSettled(beforeDefaults)) {
      console.log('old values or defaults still present, applying SQL');
      for (const statement of sql.split('--> statement-breakpoint')) await c.query(statement);
    } else {
      console.log('already applied by hand; recording the hash only');
    }
    const after = await counts();
    const afterDefaults = await defaults();
    if (
      stale(after).length > 0 ||
      total(after) !== total(before) ||
      !defaultsSettled(afterDefaults)
    ) {
      throw new Error(
        `verify failed in txn: ${JSON.stringify({ after, defaults: afterDefaults })}`,
      );
    }
    await c.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [hash, entry.when.toString()],
    );
    await c.query('COMMIT');
    console.log(`${TAG} recorded. hash=`, hash);
    console.log('AFTER concepts.internal_status:', after);
    console.log('AFTER defaults:', afterDefaults);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
