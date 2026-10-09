/* eslint-disable */
// Read-only audit of `creative_briefs` vs `creative_sheet_items` for the Oct 9 Creative Sheet audit
// (docs/audits/creative-sheet-audit-2026-10-09.md). Reports, per brand and in total: row counts in
// both tables, rows in one table with no partner in the other, how many brief names match the two
// auto-naming formulas, `source` null vs TAS vs other, and sheet rows whose dimensions differ from
// their brief's. Nothing is written; the connection string is read from the environment and never
// printed; no row content (names, comments) is printed — counts only. Run from packages/db:
//   DATABASE_URL="postgresql://..." node audit-creative-sheet.mjs
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// The CREATE-path formula (packages/domain/src/briefs/generate-brief-name.ts):
//   Source-FUNNEL-<TypeInitial><3+ digits>[-Concept][-Batch]   e.g. TAS-TOF-V001-Summer Sale-Batch 1
// Funnel and type initial can collapse when empty (`TAS-V003-X`, `TAS-TOF-002`), so both are optional.
const CREATE_PATH_PATTERN = '^[A-Za-z]+-([A-Z]{3}-)?[A-Z]?[0-9]{3,}(-.+)?$';
// PRD §7 (packages/domain/src/creatives/creative-name.ts), the concept-cascade formula:
//   [Source-]<FunnelLetter><FormatLetter><n>-Batch-Concept-V<n>[-Product]   e.g. TV1-B1-Pain-UGC-V2
const PRD7_PATTERN = '^([A-Za-z]+-)?[A-Z]{2}[0-9]+-[^-]+-.+-V[0-9]+(-.+)?$';
// The shorter Airtable-era shape (`TV50-Cooking and Wine-V2`): head, concept, version, no batch.
const LEGACY_SHORT_PATTERN = '^[A-Z]{2,3}[0-9]+-.+-V[0-9]+$';

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const columns = await c.query(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name IN ('creative_briefs', 'creative_sheet_items')`,
);
const has = (table, column) =>
  columns.rows.some((r) => r.table_name === table && r.column_name === column);
if (!has('creative_briefs', 'id') || !has('creative_sheet_items', 'id')) {
  console.error('creative_briefs or creative_sheet_items is missing from this database');
  await c.end();
  process.exit(1);
}
const sheetHasDimensions = has('creative_sheet_items', 'dimensions');
const sheetHasSource = has('creative_sheet_items', 'source');
const sheetHasName = has('creative_sheet_items', 'name');
const briefHasSource = has('creative_briefs', 'source');
const briefHasNumber = has('creative_briefs', 'brief_number');

const brands = await c.query(
  'SELECT id, slug, is_template FROM brands WHERE deleted_at IS NULL ORDER BY is_template DESC, slug',
);
const label = new Map(
  brands.rows.map((b) => [b.id, b.is_template ? `${b.slug} (template)` : b.slug]),
);
const brandOf = (id) => (id ? (label.get(id) ?? '(deleted brand)') : '(no brand)');

const table = (header, rows) => {
  console.log(`| ${header.join(' | ')} |`);
  console.log(`| ${header.map(() => '---').join(' | ')} |`);
  for (const r of rows) console.log(`| ${r.join(' | ')} |`);
  console.log('');
};
const one = async (sql) => (await c.query(sql)).rows[0];

console.log('# Creative Sheet audit — creative_briefs vs creative_sheet_items\n');
console.log(`Generated: ${new Date().toISOString()} · brands: ${brands.rows.length}`);
console.log(
  `Schema: creative_sheet_items.dimensions ${sheetHasDimensions ? 'present' : 'MISSING (apply59.mjs not run)'}; ` +
    `creative_sheet_items.source ${sheetHasSource ? 'present' : 'absent (by design: source lives on the brief)'}; ` +
    `creative_sheet_items.name ${sheetHasName ? 'present' : 'absent (by design: computed at read time from created_at + brief name)'}\n`,
);

// 1. Row counts per brand.
console.log('## 1. Row counts\n');
const counts = await c.query(`
  SELECT b.id AS brand_id,
         (SELECT COUNT(*)::int FROM creative_briefs x WHERE x.brand_id = b.id) AS briefs,
         (SELECT COUNT(*)::int FROM creative_briefs x WHERE x.brand_id = b.id AND x.deleted_at IS NULL) AS briefs_live,
         (SELECT COUNT(*)::int FROM creative_sheet_items x WHERE x.brand_id = b.id) AS sheet,
         (SELECT COUNT(*)::int FROM creative_sheet_items x WHERE x.brand_id = b.id AND x.deleted_at IS NULL) AS sheet_live
  FROM brands b WHERE b.deleted_at IS NULL ORDER BY b.is_template DESC, b.slug`);
const totals = await one(`
  SELECT (SELECT COUNT(*)::int FROM creative_briefs) AS briefs,
         (SELECT COUNT(*)::int FROM creative_briefs WHERE deleted_at IS NULL) AS briefs_live,
         (SELECT COUNT(*)::int FROM creative_sheet_items) AS sheet,
         (SELECT COUNT(*)::int FROM creative_sheet_items WHERE deleted_at IS NULL) AS sheet_live`);
table(
  ['brand', 'briefs (all)', 'briefs (live)', 'sheet items (all)', 'sheet items (live)'],
  [
    ...counts.rows.map((r) => [
      brandOf(r.brand_id),
      r.briefs,
      r.briefs_live,
      r.sheet,
      r.sheet_live,
    ]),
    ['**total**', totals.briefs, totals.briefs_live, totals.sheet, totals.sheet_live],
  ],
);

// 2. Partner gaps. Live rows only on both sides unless stated.
console.log('## 2. Rows with no partner in the other table (live rows)\n');
const gaps = await one(`
  SELECT
    (SELECT COUNT(*)::int FROM creative_sheet_items s WHERE s.deleted_at IS NULL AND s.brief_id IS NULL) AS sheet_no_link,
    (SELECT COUNT(*)::int FROM creative_sheet_items s
       WHERE s.deleted_at IS NULL AND s.brief_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM creative_briefs b WHERE b.id = s.brief_id)) AS sheet_dangling,
    (SELECT COUNT(*)::int FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
       WHERE s.deleted_at IS NULL AND b.deleted_at IS NOT NULL) AS sheet_to_deleted_brief,
    (SELECT COUNT(*)::int FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
       WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL AND s.brand_id <> b.brand_id) AS sheet_cross_brand,
    (SELECT COUNT(*)::int FROM creative_briefs b
       WHERE b.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM creative_sheet_items s WHERE s.brief_id = b.id AND s.deleted_at IS NULL)) AS brief_no_sheet,
    (SELECT COUNT(*)::int FROM (
       SELECT s.brief_id FROM creative_sheet_items s WHERE s.deleted_at IS NULL AND s.brief_id IS NOT NULL
       GROUP BY s.brief_id HAVING COUNT(*) > 1) d) AS brief_with_many_sheet_rows,
    (SELECT COUNT(*)::int FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
       WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL) AS linked_pairs`);
table(
  ['check', 'rows'],
  [
    ['sheet rows with brief_id NULL', gaps.sheet_no_link],
    ['sheet rows whose brief_id points at no brief row', gaps.sheet_dangling],
    ['sheet rows whose brief is soft-deleted', gaps.sheet_to_deleted_brief],
    ['sheet rows whose brief is in another brand', gaps.sheet_cross_brand],
    ['briefs with no live sheet row', gaps.brief_no_sheet],
    ['briefs with more than one live sheet row', gaps.brief_with_many_sheet_rows],
    ['live brief ↔ live sheet pairs', gaps.linked_pairs],
  ],
);
const gapsByBrand = await c.query(`
  SELECT b.id AS brand_id,
    (SELECT COUNT(*)::int FROM creative_briefs x WHERE x.brand_id = b.id AND x.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM creative_sheet_items s WHERE s.brief_id = x.id AND s.deleted_at IS NULL)) AS brief_no_sheet,
    (SELECT COUNT(*)::int FROM creative_sheet_items s WHERE s.brand_id = b.id AND s.deleted_at IS NULL
       AND (s.brief_id IS NULL OR NOT EXISTS (SELECT 1 FROM creative_briefs x WHERE x.id = s.brief_id AND x.deleted_at IS NULL))) AS sheet_no_brief
  FROM brands b WHERE b.deleted_at IS NULL ORDER BY b.is_template DESC, b.slug`);
table(
  ['brand', 'briefs with no sheet row', 'sheet rows with no live brief'],
  gapsByBrand.rows.map((r) => [brandOf(r.brand_id), r.brief_no_sheet, r.sheet_no_brief]),
);

// 3. Names. `brief_number` is the authoritative marker of the Oct 5 CREATE formula; the regexes
// classify the stored string regardless of how it got there.
console.log('## 3. Brief names vs the auto-naming formulas (live briefs)\n');
const numberExpr = briefHasNumber ? 'brief_number IS NOT NULL' : 'false';
const names = await one(`
  SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE name ~ '${CREATE_PATH_PATTERN}')::int AS create_path_shape,
    COUNT(*) FILTER (WHERE name ~ '${PRD7_PATTERN}')::int AS prd7_shape,
    COUNT(*) FILTER (WHERE name ~ '${LEGACY_SHORT_PATTERN}' AND name !~ '${PRD7_PATTERN}')::int AS legacy_short_shape,
    COUNT(*) FILTER (WHERE name !~ '${CREATE_PATH_PATTERN}' AND name !~ '${PRD7_PATTERN}' AND name !~ '${LEGACY_SHORT_PATTERN}')::int AS other_shape,
    COUNT(*) FILTER (WHERE ${numberExpr})::int AS with_brief_number,
    COUNT(*) FILTER (WHERE ${numberExpr} AND name !~ '${CREATE_PATH_PATTERN}')::int AS with_brief_number_but_other_shape,
    COUNT(*) FILTER (WHERE legacy_airtable_id IS NOT NULL)::int AS imported,
    COUNT(*) FILTER (WHERE legacy_airtable_id IS NOT NULL AND name ~ '${CREATE_PATH_PATTERN}')::int AS imported_create_path_shape,
    COUNT(*) FILTER (WHERE legacy_airtable_id IS NOT NULL AND name ~ '${PRD7_PATTERN}' AND name ~ '^[A-Za-z]+-[A-Z]{2}[0-9]')::int AS imported_prd7_with_source_prefix,
    COUNT(*) FILTER (WHERE name = 'Untitled' OR btrim(name) = '')::int AS untitled_or_blank,
    COUNT(*) FILTER (WHERE name ~ '--')::int AS double_hyphen
  FROM creative_briefs WHERE deleted_at IS NULL`);
table(
  ['measure', 'briefs'],
  [
    ['live briefs', names.total],
    [`CREATE-path shape (\`${CREATE_PATH_PATTERN}\`)`, names.create_path_shape],
    [`PRD §7 shape (\`${PRD7_PATTERN}\`)`, names.prd7_shape],
    [`Airtable-era short shape (\`${LEGACY_SHORT_PATTERN}\`), not §7`, names.legacy_short_shape],
    ['none of the three (hand-typed / Untitled / other)', names.other_shape],
    ['brief_number set (named by the CREATE formula or manual override)', names.with_brief_number],
    [
      'brief_number set but name is not CREATE-path shape (manual override, or formula bug)',
      names.with_brief_number_but_other_shape,
    ],
    ['imported (legacy_airtable_id set)', names.imported],
    ['imported AND CREATE-path shape (unexpected)', names.imported_create_path_shape],
    [
      'imported AND §7 shape with a Source- prefix (rewritten by the concept cascade)',
      names.imported_prd7_with_source_prefix,
    ],
    ["name 'Untitled' or blank", names.untitled_or_blank],
    ['name containing `--`', names.double_hyphen],
  ],
);
const namesByBrand = await c.query(`
  SELECT brand_id, COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE name ~ '${CREATE_PATH_PATTERN}')::int AS create_path,
    COUNT(*) FILTER (WHERE name ~ '${PRD7_PATTERN}')::int AS prd7,
    COUNT(*) FILTER (WHERE legacy_airtable_id IS NOT NULL)::int AS imported,
    COUNT(*) FILTER (WHERE ${numberExpr})::int AS numbered
  FROM creative_briefs WHERE deleted_at IS NULL GROUP BY brand_id ORDER BY 1`);
table(
  ['brand', 'live briefs', 'CREATE-path shape', '§7 shape', 'imported', 'brief_number set'],
  namesByBrand.rows.map((r) => [
    brandOf(r.brand_id),
    r.total,
    r.create_path,
    r.prd7,
    r.imported,
    r.numbered,
  ]),
);

// 4. Source.
console.log('## 4. `source` (live briefs; the sheet has no source column)\n');
if (briefHasSource) {
  const source = await c.query(`
    SELECT COALESCE(source, '(null)') AS source, COUNT(*)::int AS briefs,
           COUNT(*) FILTER (WHERE legacy_airtable_id IS NOT NULL)::int AS imported
    FROM creative_briefs WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`);
  table(
    ['source', 'briefs', 'of which imported'],
    source.rows.map((r) => [r.source, r.briefs, r.imported]),
  );
  const prefixMismatch = await one(`
    SELECT COUNT(*)::int AS n FROM creative_briefs
    WHERE deleted_at IS NULL AND ${numberExpr} AND name ~ '^[A-Za-z]+-' AND split_part(name, '-', 1) <> source`);
  console.log(
    `Briefs named by the CREATE formula whose name prefix differs from the stored \`source\` (the form's Source reaches the name but not the column): ${prefixMismatch.n}\n`,
  );
} else {
  console.log('creative_briefs.source is missing from this database.\n');
}
if (sheetHasSource) {
  const s = await c.query(
    `SELECT COALESCE(source, '(null)') AS source, COUNT(*)::int AS rows FROM creative_sheet_items WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`,
  );
  table(
    ['sheet source', 'rows'],
    s.rows.map((r) => [r.source, r.rows]),
  );
}

// 5. Dimensions: sheet row vs its brief. Strict jsonb inequality (order matters) and set inequality.
console.log(
  '## 5. Dimensions: creative_sheet_items.dimensions vs creative_briefs.dimensions (live pairs)\n',
);
if (sheetHasDimensions) {
  const sorted = (col) =>
    `(SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::text[]) FROM jsonb_array_elements_text(${col}) AS x)`;
  const dims = await one(`
    SELECT COUNT(*)::int AS pairs,
      COUNT(*) FILTER (WHERE s.dimensions <> b.dimensions)::int AS differ_strict,
      COUNT(*) FILTER (WHERE ${sorted('s.dimensions')} <> ${sorted('b.dimensions')})::int AS differ_as_sets,
      COUNT(*) FILTER (WHERE s.dimensions = '[]'::jsonb AND b.dimensions <> '[]'::jsonb)::int AS sheet_empty_brief_not,
      COUNT(*) FILTER (WHERE s.dimensions <> '[]'::jsonb AND b.dimensions = '[]'::jsonb)::int AS brief_empty_sheet_not,
      COUNT(*) FILTER (WHERE s.dimensions = '[]'::jsonb AND b.dimensions = '[]'::jsonb)::int AS both_empty,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(s.dimensions) d WHERE d !~ '^[0-9]+:[0-9]+$'))::int AS sheet_with_legacy_names,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(b.dimensions) d WHERE d !~ '^[0-9]+:[0-9]+$'))::int AS brief_with_legacy_names
    FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
    WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL`);
  const unlinked = await one(`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE dimensions <> '[]'::jsonb)::int AS with_dims
    FROM creative_sheet_items WHERE deleted_at IS NULL AND brief_id IS NULL`);
  table(
    ['measure', 'rows'],
    [
      ['linked live pairs', dims.pairs],
      ['differ (strict jsonb, order-sensitive)', dims.differ_strict],
      ['differ as sets (order ignored)', dims.differ_as_sets],
      [
        'sheet empty, brief has ratios (0059 backfill gap or sheet cleared)',
        dims.sheet_empty_brief_not,
      ],
      ['brief empty, sheet has ratios (edited on the sheet only)', dims.brief_empty_sheet_not],
      ['both empty', dims.both_empty],
      ['sheet rows carrying a legacy dimension NAME (not n:m)', dims.sheet_with_legacy_names],
      ['briefs carrying a legacy dimension NAME (not n:m)', dims.brief_with_legacy_names],
      [
        'unlinked sheet rows (brief_id NULL) / of which with dimensions',
        `${unlinked.n} / ${unlinked.with_dims}`,
      ],
    ],
  );
  const dimsByBrand = await c.query(`
    SELECT s.brand_id, COUNT(*)::int AS pairs,
      COUNT(*) FILTER (WHERE ${sorted('s.dimensions')} <> ${sorted('b.dimensions')})::int AS differ
    FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
    WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL GROUP BY s.brand_id ORDER BY 1`);
  table(
    ['brand', 'linked pairs', 'dimensions differ (as sets)'],
    dimsByBrand.rows.map((r) => [brandOf(r.brand_id), r.pairs, r.differ]),
  );
} else {
  console.log(
    'creative_sheet_items.dimensions is missing: run `node apply59.mjs` first, then re-run this audit.\n',
  );
}

// 6. Status drift between the two stored copies (the sheet keeps its own internal_status/status).
console.log('## 6. Status copies: sheet row vs its brief (live pairs)\n');
const status = await one(`
  SELECT COUNT(*)::int AS pairs,
    COUNT(*) FILTER (WHERE s.internal_status IS DISTINCT FROM b.internal_status)::int AS internal_differs,
    COUNT(*) FILTER (WHERE s.internal_status IS NULL)::int AS sheet_internal_null,
    COUNT(*) FILTER (WHERE s.client_approval_status IS DISTINCT FROM b.client_status)::int AS client_differs,
    COUNT(*) FILTER (WHERE s.qa_video_editor <> b.qa_video_editor OR s.qa_designer <> b.qa_designer OR s.qa_strategist <> b.qa_strategist)::int AS qa_differs
  FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
  WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL`);
table(
  ['measure', 'rows'],
  [
    ['linked live pairs', status.pairs],
    ['sheet.internal_status ≠ brief.internal_status', status.internal_differs],
    ['sheet.internal_status NULL', status.sheet_internal_null],
    ['sheet.client_approval_status ≠ brief.client_status', status.client_differs],
    ['any QA flag differs', status.qa_differs],
  ],
);

await c.end();
