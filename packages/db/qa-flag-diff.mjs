/* eslint-disable */
// Lists the live brief ↔ sheet pairs whose QA flags disagree (the "QA flags differ in 62 pairs" line
// of audit-creative-sheet.mjs), one row per pair: brief id, brief name, then sheet value vs brief
// value for each of the three flags. Counts and ids only — no comments, scripts or other content.
// Read-only; the connection string is read from the environment and never printed. From packages/db:
//   DATABASE_URL="postgresql://..." node qa-flag-diff.mjs
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const FLAGS = ['qa_video_editor', 'qa_designer', 'qa_strategist'];

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const brands = await c.query('SELECT id, slug FROM brands WHERE deleted_at IS NULL');
const slugOf = new Map(brands.rows.map((b) => [b.id, b.slug]));

const differ = FLAGS.map((f) => `s.${f} <> b.${f}`).join(' OR ');
const res = await c.query(`
  SELECT s.brand_id, s.id AS sheet_id, b.id AS brief_id, b.name AS brief_name,
         ${FLAGS.map((f) => `s.${f} AS sheet_${f}, b.${f} AS brief_${f}`).join(', ')}
  FROM creative_sheet_items s
  JOIN creative_briefs b ON b.id = s.brief_id
  WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL AND (${differ})
  ORDER BY s.brand_id, b.name`);

const perFlag = Object.fromEntries(FLAGS.map((f) => [f, { sheetOnly: 0, briefOnly: 0 }]));
for (const r of res.rows) {
  for (const f of FLAGS) {
    if (r[`sheet_${f}`] && !r[`brief_${f}`]) perFlag[f].sheetOnly += 1;
    if (!r[`sheet_${f}`] && r[`brief_${f}`]) perFlag[f].briefOnly += 1;
  }
}

console.log('# QA flags: sheet row vs brief (live pairs that differ)\n');
console.log(`Generated: ${new Date().toISOString()} · pairs that differ: ${res.rows.length}\n`);
console.log('| flag | ticked on the sheet only | ticked on the brief only |');
console.log('| --- | --- | --- |');
for (const f of FLAGS) console.log(`| ${f} | ${perFlag[f].sheetOnly} | ${perFlag[f].briefOnly} |`);
console.log('');
console.log(
  '| brand | brief id | brief name | video editor (sheet / brief) | designer (sheet / brief) | strategist (sheet / brief) |',
);
console.log('| --- | --- | --- | --- | --- | --- |');
const yn = (v) => (v ? 'yes' : 'no');
for (const r of res.rows) {
  const cells = FLAGS.map((f) => `${yn(r[`sheet_${f}`])} / ${yn(r[`brief_${f}`])}`);
  console.log(
    `| ${slugOf.get(r.brand_id) ?? r.brand_id} | ${r.brief_id} | ${r.brief_name} | ${cells.join(' | ')} |`,
  );
}

await c.end();
