/* eslint-disable */
// Oct 15 pre-demo cleanup (EMBARRASSING sub-fix a): a "test" creator sits on Gratsi's roster and
// in `creator_registry`. It renders on `/app/creator-pool`, which is a client-facing surface.
// This script finds those rows, prints a redacted preview, and (with --apply) soft-deletes them.
// Operator runs from `packages/db` with DATABASE_URL in `.env.local` — the chain never runs it.
//
// Report mode (default):   DATABASE_URL="postgresql://..." node cleanup-embarrassing-data.mjs
// Soft-delete mode:        DATABASE_URL="postgresql://..." node cleanup-embarrassing-data.mjs --apply
//
// Soft delete only: `deleted_at` and `updated_at` are set to NOW(), `updated_by` to the script's
// own name. Already-soft-deleted rows are skipped on every run, so the script is idempotent.
import pg from 'pg';

const BRAND_SLUG = 'gratsi';
const UPDATED_BY = 'cleanup-embarrassing-data.mjs';

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

  // 1) Gratsi `creators` rows named exactly "test" or beginning with "test " (case-insensitive).
  const creatorsSql = `
    SELECT id, name
      FROM creators
     WHERE brand_id = $1
       AND deleted_at IS NULL
       AND (LOWER(name) = 'test' OR LOWER(name) LIKE 'test %')
     ORDER BY name, id
  `;
  const matchedCreators = await client.query(creatorsSql, [brand.id]);
  console.log(`\nGratsi creators matching: ${matchedCreators.rowCount}`);
  for (const row of matchedCreators.rows) {
    console.log(`  id=${row.id} name="${row.name}"`);
  }

  // 2) `creator_registry` rows named exactly "test" (case-insensitive). The registry is global:
  // soft-deleting here hides the row from EVERY brand's /app/creator-pool.
  const registrySql = `
    SELECT id, name
      FROM creator_registry
     WHERE deleted_at IS NULL
       AND LOWER(name) = 'test'
     ORDER BY id
  `;
  const matchedRegistry = await client.query(registrySql);
  console.log(`\nCreator registry matching: ${matchedRegistry.rowCount}`);
  for (const row of matchedRegistry.rows) {
    console.log(`  id=${row.id} name="${row.name}"`);
  }

  if (!apply) {
    console.log('\nReport-only run (no --apply). Re-run with --apply to soft-delete these rows.');
    process.exit(0);
  }

  if (matchedCreators.rowCount === 0 && matchedRegistry.rowCount === 0) {
    console.log('\nNothing to soft-delete.');
    process.exit(0);
  }

  const creatorsUpdateSql = `
    UPDATE creators
       SET deleted_at = NOW(),
           updated_at = NOW(),
           updated_by = $2
     WHERE brand_id = $1
       AND deleted_at IS NULL
       AND (LOWER(name) = 'test' OR LOWER(name) LIKE 'test %')
  `;
  const creatorsResult = await client.query(creatorsUpdateSql, [brand.id, UPDATED_BY]);
  console.log(`\nSoft-deleted ${creatorsResult.rowCount} Gratsi creator row(s).`);

  const registryUpdateSql = `
    UPDATE creator_registry
       SET deleted_at = NOW(),
           updated_at = NOW(),
           updated_by = $1
     WHERE deleted_at IS NULL
       AND LOWER(name) = 'test'
  `;
  const registryResult = await client.query(registryUpdateSql, [UPDATED_BY]);
  console.log(`Soft-deleted ${registryResult.rowCount} creator_registry row(s).`);
} finally {
  await client.end();
}
