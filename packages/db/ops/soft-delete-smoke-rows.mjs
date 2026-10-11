/* eslint-disable */
// Soft-deletes a smoke tester's leftover rows on Gratsi — a creative brief and an empty copy row —
// the way every data table is deleted here (`deleted_at = now()`, never DELETE FROM; CLAUDE.md).
// One transaction: counts before, the two UPDATEs guarded on brand, name/shape and
// `deleted_at IS NULL`, rowcount 1+1 verified, counts after, COMMIT — anything else rolls back.
// SMOKE-21 (2026-10-10), SMOKE-28, SMOKE-30 and the Tier 7 copy (2026-10-11) were applied with it.
// From packages/db:  DATABASE_URL="postgresql://..." node ops/soft-delete-smoke-rows.mjs <brief-id> <brief-name> <copy-id>
//                   DATABASE_URL="postgresql://..." node ops/soft-delete-smoke-rows.mjs --copy <copy-id>
import pg from 'pg';

const GRATSI = '11111111-1111-4111-8111-111111111113';
// Two shapes: a brief + an empty copy (the usual pair), or `--copy <id>` alone for a copy row the
// tester typed into (SMOKE-37: "SMOKE headline"); the copy guard is then brand + id + unlinked.
const args = process.argv.slice(2);
const copyOnly = args[0] === '--copy';
const [briefId, briefName, copyId] = copyOnly ? [null, null, args[1]] : args;
if ((!copyOnly && (!briefId || !briefName || !copyId)) || (copyOnly && !copyId)) {
  console.error(
    'usage: node ops/soft-delete-smoke-rows.mjs <brief-id> <brief-name> <copy-id>  |  --copy <copy-id>',
  );
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
  const brief = copyOnly
    ? { rowCount: 1, rows: [{ id: null, name: '(no brief: --copy mode)', deleted_at: null }] }
    : await c.query(
        `UPDATE creative_briefs SET deleted_at = now(), updated_at = now(), updated_by = $3
     WHERE id = $1 AND brand_id = $2 AND name = $4 AND deleted_at IS NULL RETURNING id, name, deleted_at`,
        [briefId, GRATSI, ACTOR, briefName],
      );
  const copy = await c.query(
    copyOnly
      ? `UPDATE copywriting SET deleted_at = now(), updated_at = now(), updated_by = $3
         WHERE id = $1 AND brand_id = $2 AND creative_brief_id IS NULL AND deleted_at IS NULL
         RETURNING id, copy_number, headline, deleted_at`
      : `UPDATE copywriting SET deleted_at = now(), updated_at = now(), updated_by = $3
         WHERE id = $1 AND brand_id = $2 AND headline IS NULL AND primary_copy IS NULL AND creative_brief_id IS NULL AND deleted_at IS NULL
         RETURNING id, copy_number, deleted_at`,
    [copyId, GRATSI, ACTOR],
  );
  if (brief.rowCount !== 1 || copy.rowCount !== 1) {
    throw new Error(`expected 1+1 rows, got ${brief.rowCount}+${copy.rowCount}`);
  }
  const after = await counts();
  if (after.briefs !== before.briefs - (copyOnly ? 0 : 1) || after.copy !== before.copy - 1) {
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
