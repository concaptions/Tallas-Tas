/* eslint-disable */
// Read-only count check for audit item 3 (brief auto-naming, 2026-10-09): creative_briefs.name_mode
// per brand — every brief that existed before migration 0060 must read 'manual'; only creatives made
// through "New creative" since the cutover read 'auto', and each of those carries a brief_number.
// The connection string is read from the environment and never printed; ids and counts only. From
// packages/db:  DATABASE_URL="postgresql://..." node audit-name-mode.mjs
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const perBrand = await c.query(`
  SELECT COALESCE(br.slug, '(no brand)') AS brand, b.name_mode,
         COUNT(*)::int AS briefs,
         COUNT(*) FILTER (WHERE b.brief_number IS NOT NULL)::int AS with_number,
         COUNT(*) FILTER (WHERE b.legacy_airtable_id IS NOT NULL)::int AS imported
  FROM creative_briefs b LEFT JOIN brands br ON br.id = b.brand_id
  WHERE b.deleted_at IS NULL
  GROUP BY 1, 2 ORDER BY 1, 2`);
console.log('# creative_briefs.name_mode — live briefs per brand\n');
console.log('| brand | name_mode | briefs | with brief_number | imported |');
console.log('| --- | --- | --- | --- | --- |');
for (const r of perBrand.rows) {
  console.log(`| ${r.brand} | ${r.name_mode} | ${r.briefs} | ${r.with_number} | ${r.imported} |`);
}
const totals = (
  await c.query(`
  SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE name_mode = 'manual')::int AS manual,
         COUNT(*) FILTER (WHERE name_mode = 'auto')::int AS auto,
         COUNT(*) FILTER (WHERE name_mode = 'auto' AND brief_number IS NULL)::int AS auto_without_number,
         COUNT(*) FILTER (WHERE name_mode = 'auto' AND legacy_airtable_id IS NOT NULL)::int AS auto_but_imported
  FROM creative_briefs WHERE deleted_at IS NULL`)
).rows[0];
console.log(
  `\nTotal ${totals.total} · manual ${totals.manual} · auto ${totals.auto} · auto without a brief_number ${totals.auto_without_number} (must be 0) · auto but imported ${totals.auto_but_imported} (must be 0)`,
);
const autos = await c.query(
  `SELECT id, brief_number, created_at FROM creative_briefs WHERE deleted_at IS NULL AND name_mode = 'auto' ORDER BY created_at`,
);
if (autos.rows.length > 0) {
  console.log('\nauto-named briefs (created through "New creative" since the cutover):');
  for (const r of autos.rows)
    console.log(`- ${r.id} · #${r.brief_number} · ${r.created_at.toISOString()}`);
}
await c.end();
