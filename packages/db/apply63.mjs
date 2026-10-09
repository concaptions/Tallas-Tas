/* eslint-disable */
// Applies 0063_standard_page_rows to Railway in ONE transaction with a verify step (0062 pattern):
// sha256 of the SQL is the journal hash, so a second run is a no-op. Verifies in-transaction that
// the five template standard rows exist (concepts, creative_sheet, ugc_management, copywriting,
// calendar) carrying the template's interface_tab_visibility flags, and that no custom row changed.
// From packages/db:  DATABASE_URL="postgresql://..." node apply63.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0063_standard_page_rows';
const sql = fs.readFileSync(`drizzle/${TAG}.sql`, 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entry = journal.entries.find((e) => e.tag === TAG);
if (!entry) {
  console.error('journal entry missing');
  process.exit(1);
}
const EXPECTED = ['calendar', 'concepts', 'copywriting', 'creative_sheet', 'ugc_management'];

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const kinds = async () =>
  (
    await c.query(
      'SELECT page_kind, COUNT(*)::int AS n FROM custom_interface_pages WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1',
    )
  ).rows;
const standard = async () =>
  (
    await c.query(
      "SELECT slug, is_visible, sort_order, brand_id FROM custom_interface_pages WHERE page_kind = 'standard' AND deleted_at IS NULL ORDER BY brand_id NULLS FIRST, sort_order",
    )
  ).rows;
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already applied (hash ${hash}); nothing to do`);
  } else {
    const before = await kinds();
    const tabs = (
      await c.query(
        'SELECT tab_key, is_visible, sort_order FROM interface_tab_visibility tv JOIN brands b ON b.id = tv.brand_id WHERE b.is_template AND tv.deleted_at IS NULL ORDER BY sort_order',
      )
    ).rows;
    console.log('BEFORE kinds:', before, 'template tab rows:', tabs);
    await c.query('BEGIN');
    await c.query(sql.split('--> statement-breakpoint').join('\n'));
    await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
      hash,
      entry.when.toString(),
    ]);
    const after = await kinds();
    const rows = await standard();
    const templateRows = rows.filter((r) => r.brand_id === null);
    const customBefore = before.find((r) => r.page_kind === 'custom')?.n ?? 0;
    const customAfter = after.find((r) => r.page_kind === 'custom')?.n ?? 0;
    const slugs = templateRows.map((r) => r.slug).sort();
    const flagsMatch = tabs.every((t) => {
      const row = templateRows.find((r) => r.slug === t.tab_key);
      return row && row.is_visible === t.is_visible && row.sort_order === t.sort_order;
    });
    if (
      JSON.stringify(slugs) !== JSON.stringify(EXPECTED) ||
      customBefore !== customAfter ||
      !flagsMatch
    ) {
      throw new Error(
        `verify failed in txn: standard slugs ${JSON.stringify(slugs)}, custom ${customBefore} -> ${customAfter}, flags match ${flagsMatch}`,
      );
    }
    await c.query('COMMIT');
    console.log(`${TAG} applied. hash=`, hash);
    console.log('AFTER kinds:', after);
    console.log('standard rows:', rows);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
