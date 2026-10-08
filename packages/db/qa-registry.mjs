/* eslint-disable */
// Creator Pool ground truth from Railway. Read-only. Run from packages/db:
//   DATABASE_URL="postgresql://..." node qa-registry.mjs > ../../.audit-oct8/creator-pool-qa.raw.md
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const registry = await c.query(`
  SELECT r.id, r.name, r.instagram_username, r.normalized_instagram,
         r.total_brands, r.total_projects,
         COALESCE(l.linked, 0)::int AS linked_creators,
         COALESCE(l.brands, 0)::int AS linked_brands
  FROM creator_registry r
  LEFT JOIN (
    SELECT registry_creator_id,
           COUNT(*) AS linked,
           COUNT(DISTINCT brand_id) AS brands
    FROM creators
    WHERE deleted_at IS NULL AND registry_creator_id IS NOT NULL
    GROUP BY registry_creator_id
  ) l ON l.registry_creator_id = r.id
  WHERE r.deleted_at IS NULL
  ORDER BY r.total_brands DESC, r.name
`);

const links = await c.query(`
  SELECT c.registry_creator_id, c.id AS creator_id, c.name, c.instagram_username,
         c.brand_id, b.slug AS brand_slug
  FROM creators c
  JOIN brands b ON b.id = c.brand_id
  WHERE c.deleted_at IS NULL AND c.registry_creator_id IS NOT NULL
  ORDER BY c.registry_creator_id, b.slug, c.name
`);

const unlinked = await c.query(`
  SELECT COUNT(*)::int AS unlinked
  FROM creators
  WHERE deleted_at IS NULL AND registry_creator_id IS NULL
`);

await c.end();

const byRegistry = new Map();
for (const row of links.rows) {
  const list = byRegistry.get(row.registry_creator_id) ?? [];
  list.push(row);
  byRegistry.set(row.registry_creator_id, list);
}

const squash = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function risk(sources) {
  const exact = new Set(sources.map((s) => (s.name ?? '').trim().toLowerCase()));
  if (exact.size === 1) return 'LOW';
  const loose = new Set(sources.map((s) => squash(s.name)));
  if (loose.size === 1) return 'MEDIUM';
  return 'HIGH';
}

const multiBrand = registry.rows.filter((r) => r.total_brands > 1 || r.linked_brands > 1);
const drift = registry.rows.filter((r) => r.total_brands !== r.linked_brands);
const suspicious = registry.rows
  .filter((r) => r.normalized_instagram === null && r.linked_brands >= 2)
  .map((r) => ({ ...r, sources: byRegistry.get(r.id) ?? [] }))
  .map((r) => ({ ...r, risk: risk(r.sources) }));

console.log('# Creator Pool ground truth (Railway)\n');
console.log(`Generated: ${new Date().toISOString()}\n`);
console.log('## Summary\n');
console.log(`- Registry rows (live): ${registry.rows.length}`);
console.log(`- Brand creators linked (live): ${links.rows.length}`);
console.log(`- Brand creators unlinked (live): ${unlinked.rows[0].unlinked}`);
console.log(
  `- Registry rows with an Instagram key: ${registry.rows.filter((r) => r.normalized_instagram !== null).length}`,
);
console.log(`- Multi-brand registry rows: ${multiBrand.length}`);
console.log(`- total_brands drift (stored != actual distinct brands): ${drift.length}`);
console.log(`- Suspicious merges (no IG key, 2+ brands): ${suspicious.length}\n`);

console.log('## All registry rows\n');
console.log(
  '| id | name | normalized_instagram | total_brands | linked_brands | total_projects | linked_creators |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const r of registry.rows) {
  console.log(
    `| ${r.id} | ${r.name} | ${r.normalized_instagram ?? ''} | ${r.total_brands} | ${r.linked_brands} | ${r.total_projects} | ${r.linked_creators} |`,
  );
}

console.log('\n## Linked brand creators per registry row\n');
for (const r of registry.rows) {
  const sources = byRegistry.get(r.id) ?? [];
  console.log(`### ${r.name} (${r.id})`);
  if (sources.length === 0) {
    console.log('- (no linked creators)');
  }
  for (const s of sources) {
    console.log(
      `- [${s.brand_slug}] ${s.name} — ig: ${s.instagram_username ?? '—'} — creator ${s.creator_id} — brand ${s.brand_id}`,
    );
  }
  console.log('');
}

console.log('## Multi-brand registry rows\n');
for (const r of multiBrand) {
  console.log(
    `- ${r.name} (${r.id}) — stored total_brands ${r.total_brands}, actual ${r.linked_brands}`,
  );
}

console.log('\n## total_brands drift\n');
for (const r of drift) {
  console.log(`- ${r.name} (${r.id}) — stored ${r.total_brands}, actual ${r.linked_brands}`);
}

console.log('\n## Suspicious merges (no Instagram key, sources from 2+ brands)\n');
console.log(
  'Risk: LOW = identical names, MEDIUM = same letters/digits once punctuation and case are stripped, HIGH = different names.\n',
);
console.log('| risk | registry id | registry name | sources |');
console.log('| --- | --- | --- | --- |');
for (const r of suspicious) {
  const src = r.sources.map((s) => `[${s.brand_slug}] ${s.name} (${s.creator_id})`).join('<br>');
  console.log(`| ${r.risk} | ${r.id} | ${r.name} | ${src} |`);
}
