/* eslint-disable */
// Soft-deletes a smoke tester's leftover rows on Gratsi — a creative brief and an empty copy row —
// the way every data table is deleted here (`deleted_at = now()`, never DELETE FROM; CLAUDE.md).
// One transaction: counts before, the two UPDATEs guarded on brand, name/shape and
// `deleted_at IS NULL`, rowcount 1+1 verified, counts after, COMMIT — anything else rolls back.
// SMOKE-21 (2026-10-10) and SMOKE-28 (2026-10-11) were applied with it.
// From packages/db:  DATABASE_URL="postgresql://..." node ops/soft-delete-smoke-rows.mjs <brief-id> <brief-name> <copy-id>
import pg from 'pg';

const GRATSI = '11111111-1111-4111-8111-111111111113';
const [briefId, briefName, copyId] = process.argv.slice(2);
if (!briefId || !briefName || !copyId) {
  console.error('usage: node ops/soft-delete-smoke-rows.mjs <brief-id> <brief-name> <copy-id>');
  process.exit(1);
}
const ACTOR = 'ops:soft-delete-smoke-rows';

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const counts = async () =>
  (
    await c.query(
      `SELECT (SELECT count(*)::int FROM creative_briefs WHERE brand_id=$1 AND deleted_at IS NULL) AS briefs,
              (SELECT count(*)::int FROM copywriting WHERE brand_id=$1 AND deleted_at IS NULL) AS copy`,
      [GRATSI],
    )
  ).rows[0];
try {
  const before = await counts();
  console.log('BEFORE', before);
  await c.query('BEGIN');
  const brief = await c.query(
    `UPDATE creative_briefs SET deleted_at = now(), updated_at = now(), updated_by = $3
     WHERE id = $1 AND brand_id = $2 AND name = $4 AND deleted_at IS NULL RETURNING id, name, deleted_at`,
    [briefId, GRATSI, ACTOR, briefName],
  );
  const copy = await c.query(
    `UPDATE copywriting SET deleted_at = now(), updated_at = now(), updated_by = $3
     WHERE id = $1 AND brand_id = $2 AND headline IS NULL AND primary_copy IS NULL AND creative_brief_id IS NULL AND deleted_at IS NULL
     RETURNING id, copy_number, deleted_at`,
    [copyId, GRATSI, ACTOR],
  );
  if (brief.rowCount !== 1 || copy.rowCount !== 1) {
    throw new Error(`expected 1+1 rows, got ${brief.rowCount}+${copy.rowCount}`);
  }
  const after = await counts();
  if (after.briefs !== before.briefs - 1 || after.copy !== before.copy - 1) {
    throw new Error(`counts off: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  }
  await c.query('COMMIT');
  console.log('soft-deleted brief:', brief.rows[0]);
  console.log('soft-deleted copy:', copy.rows[0]);
  console.log('AFTER', after);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
