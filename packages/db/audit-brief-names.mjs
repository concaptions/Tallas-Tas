/* eslint-disable */
// Ticket 3 audit (Oct 14 cutover). READ-ONLY. Prints the per-`name_mode` counts of live briefs,
// then every brief whose stored `name` does not round-trip through `buildBriefName` applied to
// its own fields — a GAP REPORT only. Exit 0 even when there are gaps: this is a diagnostic for
// Haroon to run when they want, not a gate.
//
// NOT FOR RAILWAY. The current fleet is 100 % `name_mode = 'manual'` with hand-set names, so
// most live rows will show up as a gap under this audit — the audit's job is to surface
// `name_mode = 'auto'` rows that have drifted from the formula, not to flag the pre-cutover
// imports. Run against a local snapshot or against the PGlite fixture:
//
//   cd packages/db
//   DATABASE_URL="postgresql://..." node audit-brief-names.mjs
//
// The connection string is read from the environment and never printed; ids, slugs and the two
// names of each gap row are the only payload.
import pg from 'pg';

// Keep the formula in step with `packages/domain/src/briefs/auto-name.ts`. The `.mjs` script
// cannot import from the TypeScript workspace at runtime, so the formula is reimplemented here
// line-for-line; the PGlite-based test in `src/audit-brief-names.test.ts` calls the real
// `auditBriefNames` to prove the two paths agree.
const SEPARATOR = '_';
const DEFAULT_SOURCE = 'TAS';
const NUMBER_WIDTH = 3;
const CONCEPT_MAX = 40;
const FUNNEL_CODES = {
  'top of funnel': 'TOF',
  tof: 'TOF',
  'middle of funnel': 'MOF',
  'mid funnel': 'MOF',
  mof: 'MOF',
  'bottom of funnel': 'BOF',
  bof: 'BOF',
  retargeting: 'RTG',
  rtg: 'RTG',
  'all funnels': 'ALL',
  all: 'ALL',
};
function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}
function funnelCode(funnel) {
  const trimmed = (funnel ?? '').trim();
  if (trimmed === '') return '';
  const known = FUNNEL_CODES[trimmed.toLowerCase()];
  if (known !== undefined) return known;
  return trimmed.slice(0, 3).toUpperCase();
}
function typeInitial(type) {
  const first = (type ?? '').trim().charAt(0).toUpperCase();
  return first === 'S' || first === 'C' || first === 'M' ? first : 'V';
}
function conceptSlug(name, maxLength = CONCEPT_MAX) {
  if (name === null || name === undefined) return '';
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === '') return '';
  if (maxLength <= 0) return '';
  if (slug.length <= maxLength) return slug;
  return `${slug.slice(0, maxLength - 1).replace(/-+$/, '')}…`;
}
function paddedNumber(value) {
  const integer = Number.isInteger(value) && value > 0 ? value : 0;
  return String(integer).padStart(NUMBER_WIDTH, '0');
}
function buildBriefName(args) {
  const source = textOrNull(args.source) ?? DEFAULT_SOURCE;
  const funnel = funnelCode(args.funnel);
  const letter = typeInitial(args.type);
  const padded = paddedNumber(args.number);
  const slug = conceptSlug(textOrNull(args.conceptName));
  const batch = textOrNull(args.conceptBatch);
  const segments = [source];
  if (funnel !== '') segments.push(funnel);
  segments.push(letter, padded);
  if (slug !== '') segments.push(slug);
  if (batch !== null) segments.push(batch);
  return segments.join(SEPARATOR);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const counts = await c.query(`
  SELECT name_mode, COUNT(*)::int AS briefs
  FROM creative_briefs
  WHERE deleted_at IS NULL
  GROUP BY name_mode
  ORDER BY name_mode`);
console.log('# creative_briefs.name_mode — live briefs\n');
console.log('| name_mode | briefs |');
console.log('| --- | --- |');
for (const r of counts.rows) {
  console.log(`| ${r.name_mode} | ${r.briefs} |`);
}

const rows = await c.query(`
  SELECT b.id,
         COALESCE(br.slug, '(no brand)') AS brand,
         b.name_mode,
         b.name,
         b.source, b.funnel, b.type, b.brief_number, b.batch
  FROM creative_briefs b
  LEFT JOIN brands br ON br.id = b.brand_id
  WHERE b.deleted_at IS NULL
  ORDER BY br.slug, b.name_mode, b.brief_number NULLS LAST, b.id`);
const gaps = [];
for (const r of rows.rows) {
  const expected = buildBriefName({
    source: r.source,
    funnel: r.funnel,
    type: r.type,
    number: r.brief_number ?? 0,
    conceptName: null,
    conceptBatch: r.batch,
  });
  if (r.name !== expected) {
    gaps.push({ ...r, expected });
  }
}
console.log(
  `\n# round-trip gaps — ${gaps.length} row(s) whose stored name is not buildBriefName()\n`,
);
if (gaps.length > 0) {
  console.log('| id | brand | name_mode | stored | expected |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const g of gaps) {
    console.log(`| ${g.id} | ${g.brand} | ${g.name_mode} | ${g.name} | ${g.expected} |`);
  }
}
await c.end();
