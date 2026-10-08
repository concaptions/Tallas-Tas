/* eslint-disable */
// Creator Pool v2 verification (ratings, photos, cross-base import). Read-only. Run from packages/db:
//   DATABASE_URL="postgresql://..." node qa-registry-v2.mjs > ../../.audit-oct8/creator-pool-v2-verify.md
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const schema = await c.query(`
  SELECT
    (SELECT COUNT(*)::int FROM information_schema.columns
      WHERE table_name = 'creators' AND column_name IN ('performance_rating','performance_note','performance_rated_at','performance_rated_by')) AS rating_columns,
    (SELECT COUNT(*)::int FROM information_schema.columns
      WHERE table_name = 'creator_registry' AND column_name = 'brands') AS brands_column,
    (SELECT COUNT(*)::int FROM pg_trigger WHERE tgname = 'creators_registry_avg_rating') AS avg_trigger,
    (SELECT COUNT(*)::int FROM pg_constraint WHERE conname = 'creators_performance_rating_range') AS rating_check
`);
const s = schema.rows[0];
const schemaReady =
  s.rating_columns === 4 && s.brands_column === 1 && s.avg_trigger === 1 && s.rating_check === 1;

console.log('# Creator Pool v2 verification (Railway)\n');
console.log(`Generated: ${new Date().toISOString()}\n`);
console.log('## Schema\n');
console.log(`- creators rating columns (expect 4): ${s.rating_columns}`);
console.log(`- creator_registry.brands column (expect 1): ${s.brands_column}`);
console.log(`- avg_rating trigger (expect 1): ${s.avg_trigger}`);
console.log(`- rating CHECK constraint (expect 1): ${s.rating_check}`);
console.log(`- schema ready: ${schemaReady ? 'YES' : 'NO — apply migrations 0056/0057 first'}\n`);

if (!schemaReady) {
  await c.end();
  process.exit(2);
}

const totals = await c.query(`
  SELECT
    COUNT(*)::int AS registry_rows,
    COUNT(*) FILTER (WHERE profile_pic_url IS NOT NULL)::int AS with_pic,
    COUNT(*) FILTER (WHERE profile_pic_url LIKE '%/creator-registry/%')::int AS with_r2_pic,
    COUNT(*) FILTER (WHERE avg_rating IS NOT NULL)::int AS with_avg_rating,
    COUNT(*) FILTER (WHERE jsonb_array_length(brands) > 1)::int AS multi_external_brands,
    COUNT(*) FILTER (WHERE jsonb_array_length(brands) > 0)::int AS any_external_brand,
    COUNT(*) FILTER (WHERE normalized_instagram IS NOT NULL)::int AS with_instagram
  FROM creator_registry
  WHERE deleted_at IS NULL
`);
const t = totals.rows[0];

const rated = await c.query(`
  SELECT COUNT(DISTINCT registry_creator_id)::int AS rated_registry_entries,
         COUNT(*)::int AS rated_brand_rows
  FROM creators
  WHERE deleted_at IS NULL AND performance_rating IS NOT NULL AND registry_creator_id IS NOT NULL
`);
const r = rated.rows[0];

const avgDrift = await c.query(`
  SELECT r.id, r.name, r.avg_rating,
         round(avg(c.performance_rating))::int AS expected
  FROM creator_registry r
  JOIN creators c ON c.registry_creator_id = r.id AND c.deleted_at IS NULL AND c.performance_rating IS NOT NULL
  WHERE r.deleted_at IS NULL
  GROUP BY r.id, r.name, r.avg_rating
  HAVING r.avg_rating IS DISTINCT FROM round(avg(c.performance_rating))::int
`);

const suspicious = await c.query(`
  SELECT r.id, r.name,
         json_agg(json_build_object('brand', b.slug, 'name', c.name, 'creator_id', c.id) ORDER BY b.slug) AS sources
  FROM creator_registry r
  JOIN creators c ON c.registry_creator_id = r.id AND c.deleted_at IS NULL
  JOIN brands b ON b.id = c.brand_id
  WHERE r.deleted_at IS NULL AND r.normalized_instagram IS NULL
  GROUP BY r.id, r.name
  HAVING COUNT(DISTINCT c.brand_id) >= 2
  ORDER BY r.name
`);

await c.end();

const squash = (v) => (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const risk = (sources) => {
  const exact = new Set(sources.map((x) => (x.name ?? '').trim().toLowerCase()));
  if (exact.size === 1) return 'LOW';
  return new Set(sources.map((x) => squash(x.name))).size === 1 ? 'MEDIUM' : 'HIGH';
};

console.log('## Counts\n');
console.log(`- Registry rows (expect > 66 after the import): ${t.registry_rows}`);
console.log(
  `- With profile_pic_url (expect > 9 after the backfills): ${t.with_pic} (re-hosted in R2: ${t.with_r2_pic})`,
);
console.log(`- With an Instagram key: ${t.with_instagram}`);
console.log(
  `- With avg_rating: ${t.with_avg_rating} (rated registry entries from brand rows: ${r.rated_registry_entries}, rated brand rows: ${r.rated_brand_rows})`,
);
console.log(
  `- avg_rating consistent with brand ratings: ${avgDrift.rows.length === 0 ? 'YES' : `NO — ${avgDrift.rows.length} drifted`}`,
);
console.log(`- With any external brand in brands[]: ${t.any_external_brand}`);
console.log(`- With brands[] length > 1 (expect several): ${t.multi_external_brands}\n`);

if (avgDrift.rows.length > 0) {
  console.log('## avg_rating drift (trigger missing or disabled?)\n');
  for (const row of avgDrift.rows) {
    console.log(`- ${row.id} ${row.name}: stored ${row.avg_rating}, expected ${row.expected}`);
  }
  console.log('');
}

console.log('## Suspicious merges (no Instagram key, brand rows from 2+ brands)\n');
console.log('| risk | registry id | registry name | sources |');
console.log('| --- | --- | --- | --- |');
for (const row of suspicious.rows) {
  const src = row.sources.map((x) => `[${x.brand}] ${x.name} (${x.creator_id})`).join('<br>');
  console.log(`| ${risk(row.sources)} | ${row.id} | ${row.name} | ${src} |`);
}
console.log(`\nSuspicious merges: ${suspicious.rows.length}`);
