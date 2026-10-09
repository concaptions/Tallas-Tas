/* eslint-disable */
// Applies 0062_custom_pages_page_kind to Railway in ONE transaction with a verify step, the
// 0060/0061 pattern: sha256 of the SQL is the drizzle journal hash, so a second run is a no-op. The
// verify checks the four columns, the CHECK and the FK, and that the row count and every row's
// `page_kind = 'custom'` hold before and after; any mismatch ROLLS BACK. From packages/db:
//   DATABASE_URL="postgresql://..." node apply62.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0062_custom_pages_page_kind';
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
const count = async () =>
  (await c.query('SELECT COUNT(*)::int AS n FROM custom_interface_pages')).rows[0].n;
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already applied (hash ${hash}); nothing to do`);
  } else {
    const before = await count();
    await c.query('BEGIN');
    await c.query(sql.split('--> statement-breakpoint').join('\n'));
    await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
      hash,
      entry.when.toString(),
    ]);
    const after = await count();
    const kinds = await c.query(
      'SELECT page_kind, COUNT(*)::int AS n FROM custom_interface_pages GROUP BY 1 ORDER BY 1',
    );
    const bad = kinds.rows.filter((r) => r.page_kind !== 'custom');
    if (before !== after || bad.length > 0) {
      throw new Error(
        `verify failed in txn: rows ${before} -> ${after}, kinds ${JSON.stringify(kinds.rows)}`,
      );
    }
    await c.query('COMMIT');
    console.log(`${TAG} applied. hash=`, hash, `rows ${before} -> ${after}`, kinds.rows);
  }
  const cols = await c.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'custom_interface_pages' AND column_name IN ('page_kind','module_key','template_row_id','overridden_fields') ORDER BY column_name",
  );
  const constraints = await c.query(
    "SELECT conname, contype FROM pg_constraint WHERE conname IN ('custom_interface_pages_page_kind_check','custom_interface_pages_template_row_id_fk') ORDER BY conname",
  );
  const ok = cols.rowCount === 4 && constraints.rowCount === 2;
  if (!ok) {
    console.error('VERIFY FAILED: columns', cols.rows, 'constraints', constraints.rows);
    process.exitCode = 1;
  } else {
    console.log('verified columns:', cols.rows);
    console.log('verified constraints:', constraints.rows);
    const linked = await c.query(
      'SELECT COUNT(*)::int AS children, COUNT(template_row_id)::int AS linked FROM custom_interface_pages WHERE brand_id IS NOT NULL AND deleted_at IS NULL',
    );
    console.log('child rows / linked to a template row:', linked.rows[0]);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
