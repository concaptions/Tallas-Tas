/* eslint-disable */
// Applies 0061_sheet_reconcile_into_briefs to Railway in ONE transaction with a verify step: the
// Creative Sheet's client approval work moves onto creative_briefs (Talal's reconcile decisions,
// 2026-10-09: sheet wins for status, qa_checklist_doc and spelling_feedback; internal_status and the
// spell-check trigger flag are not migrated). Prints the brief counts by client_status before and
// after, verifies every linked pair agrees afterwards, and ROLLS BACK on any mismatch. The
// connection string is read from the environment and never printed; counts only. From packages/db:
//   DATABASE_URL="postgresql://..." node apply61.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0061_sheet_reconcile_into_briefs';
const sql = fs.readFileSync(`drizzle/${TAG}.sql`, 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entry = journal.entries.find((e) => e.tag === TAG);
if (!entry) {
  console.error('journal entry missing');
  process.exit(1);
}
const when = entry.when;

// The same vocabulary map as the SQL, for the verify step.
const MAP = {
  approved: 'approved',
  launched: 'launched',
  revisions_needed: 'revisions_needed',
  revisions_submitted: 'revisions_submitted',
  denied: 'disapproved',
  pending_for_approval: 'pending_for_approval',
};
const MAP_SQL = `CASE s.status ${Object.entries(MAP)
  .map(([k, v]) => `WHEN '${k}' THEN '${v}'`)
  .join(' ')} ELSE b.client_status END`;
const PAIRS = `FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id AND b.brand_id = s.brand_id
  WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL`;

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const byStatus = async () =>
  (
    await c.query(
      `SELECT client_status, COUNT(*)::int AS briefs FROM creative_briefs WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1`,
    )
  ).rows;
const printCounts = (label, rows) => {
  console.log(`${label}:`);
  for (const r of rows) console.log(`  ${r.client_status}: ${r.briefs}`);
  console.log(`  total: ${rows.reduce((n, r) => n + r.briefs, 0)}`);
};

try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already applied (hash ${hash}); nothing to do`);
  } else {
    const before = await byStatus();
    const expected = (
      await c.query(`
        SELECT COUNT(*)::int AS pairs,
               COUNT(*) FILTER (WHERE s.status IS NOT NULL)::int AS with_status,
               COUNT(*) FILTER (WHERE s.status IS NOT NULL AND s.status NOT IN (${Object.keys(MAP)
                 .map((k) => `'${k}'`)
                 .join(',')}))::int AS unmapped_status,
               COUNT(*) FILTER (WHERE s.qa_checklist_doc IS NOT NULL AND jsonb_array_length(s.qa_checklist_doc) > 0)::int AS with_docs,
               COUNT(*) FILTER (WHERE NULLIF(btrim(s.spelling_feedback), '') IS NOT NULL)::int AS with_feedback,
               (SELECT COUNT(*)::int FROM (SELECT s2.brief_id FROM creative_sheet_items s2
                  WHERE s2.deleted_at IS NULL AND s2.brief_id IS NOT NULL GROUP BY s2.brief_id HAVING COUNT(*) > 1) d) AS multi_row_briefs
        ${PAIRS}`)
    ).rows[0];
    printCounts('BEFORE briefs by client_status', before);
    console.log(
      `live pairs: ${expected.pairs} · with sheet status: ${expected.with_status} (unmapped: ${expected.unmapped_status}) · with sheet QA docs: ${expected.with_docs} · with sheet spelling feedback: ${expected.with_feedback} · briefs with several sheet rows: ${expected.multi_row_briefs}`,
    );
    // UPDATE ... FROM picks one joined row per target; a brief with two live sheet rows would be
    // reconciled from whichever won. Production has none (378 rows, one brief each); refuse otherwise.
    if (expected.multi_row_briefs > 0) {
      throw new Error(
        `${expected.multi_row_briefs} briefs have more than one live sheet row; decide which row wins before applying`,
      );
    }
    if (expected.unmapped_status > 0) {
      throw new Error(
        `${expected.unmapped_status} sheet rows carry a status outside the vocabulary map; add it to the SQL and this script first`,
      );
    }

    await c.query('BEGIN');
    await c.query(sql);

    const check = (
      await c.query(`
        SELECT
          COUNT(*) FILTER (WHERE s.status IS NOT NULL AND b.client_status <> ${MAP_SQL})::int AS status_mismatch,
          COUNT(*) FILTER (WHERE s.status IS NOT NULL AND b.client_status_updated_at IS DISTINCT FROM s.updated_at)::int AS stamp_mismatch,
          COUNT(*) FILTER (WHERE s.status = 'launched' AND b.launched_at IS NULL)::int AS launched_unstamped,
          COUNT(*) FILTER (WHERE s.qa_checklist_doc IS NOT NULL AND jsonb_array_length(s.qa_checklist_doc) > 0
                             AND s.qa_checklist_doc IS DISTINCT FROM b.qa_checklist_doc)::int AS docs_mismatch,
          COUNT(*) FILTER (WHERE NULLIF(btrim(s.spelling_feedback), '') IS NOT NULL
                             AND s.spelling_feedback IS DISTINCT FROM b.spelling_feedback)::int AS feedback_mismatch
        ${PAIRS}`)
    ).rows[0];
    const after = await byStatus();
    printCounts('AFTER briefs by client_status', after);
    console.log('verify:', check);
    const failed = Object.values(check).some((n) => n !== 0);
    const beforeTotal = before.reduce((n, r) => n + r.briefs, 0);
    const afterTotal = after.reduce((n, r) => n + r.briefs, 0);
    if (failed || beforeTotal !== afterTotal) {
      await c.query('ROLLBACK');
      console.error(
        `VERIFY FAILED — rolled back (${failed ? 'a linked pair still disagrees' : `brief total changed ${beforeTotal} -> ${afterTotal}`})`,
      );
      process.exitCode = 1;
    } else {
      await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
        hash,
        when.toString(),
      ]);
      await c.query('COMMIT');
      console.log(`${TAG} applied. hash=`, hash);
    }
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
