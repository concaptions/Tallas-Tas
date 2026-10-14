/* eslint-disable */
// Oct 14 pre-Thursday cleanup: a smoke-test batch left `copywriting` rows on Gratsi whose
// `primary_copy` or `headline` begins with the literal "SMOKE" sentinel. This script finds those
// rows, prints a redacted preview, and (with --apply) soft-deletes them. Operator runs from
// packages/db with DATABASE_URL in .env.local — the chain never runs it.
//
// Report mode (default):   DATABASE_URL="postgresql://..." node cleanup-smoke-data.mjs
// Soft-delete mode:        DATABASE_URL="postgresql://..." node cleanup-smoke-data.mjs --apply
//
// Soft delete only: `deleted_at` and `updated_at` are set to NOW(), `updated_by` to the script's
// own name. Already-soft-deleted rows are skipped on every run, so the script is idempotent.
import pg from 'pg';

const BRAND_SLUG = 'gratsi';
const SENTINEL = 'SMOKE%';
const UPDATED_BY = 'cleanup-smoke-data.mjs';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set; refusing to run.');
  process.exit(1);
}

const apply = process.argv.includes('--apply');

const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();

try {
  const brandResult = await client.query(
    'SELECT id, name FROM brands WHERE slug = $1 AND deleted_at IS NULL LIMIT 1',
    [BRAND_SLUG],
  );
  if (brandResult.rows.length === 0) {
    console.error(`Brand with slug "${BRAND_SLUG}" not found or soft-deleted.`);
    process.exit(2);
  }
  const brand = brandResult.rows[0];
  console.log(`Brand resolved: slug="${BRAND_SLUG}" id=${brand.id} name="${brand.name}"`);

  const selectSql = `
    SELECT id, primary_copy, headline, created_at
      FROM copywriting
     WHERE brand_id = $1
       AND deleted_at IS NULL
       AND (primary_copy LIKE $2 OR headline LIKE $2)
     ORDER BY created_at
  `;
  const matched = await client.query(selectSql, [brand.id, SENTINEL]);
  console.log(`Matching rows: ${matched.rowCount}`);

  const preview = (value) => {
    if (value === null || value === undefined) return '(null)';
    const trimmed = String(value).trim();
    return trimmed.length <= 20 ? trimmed : `${trimmed.slice(0, 20)}…`;
  };

  for (const row of matched.rows) {
    console.log(
      `  id=${row.id} primary_copy="${preview(row.primary_copy)}" headline="${preview(row.headline)}"`,
    );
  }

  if (!apply) {
    console.log('\nReport-only run (no --apply). Re-run with --apply to soft-delete these rows.');
    process.exit(0);
  }

  if (matched.rowCount === 0) {
    console.log('\nNothing to soft-delete.');
    process.exit(0);
  }

  const updateSql = `
    UPDATE copywriting
       SET deleted_at = NOW(),
           updated_at = NOW(),
           updated_by = $3
     WHERE brand_id = $1
       AND deleted_at IS NULL
       AND (primary_copy LIKE $2 OR headline LIKE $2)
  `;
  const updated = await client.query(updateSql, [brand.id, SENTINEL, UPDATED_BY]);
  console.log(`\nSoft-deleted ${updated.rowCount} row(s).`);
} finally {
  await client.end();
}
