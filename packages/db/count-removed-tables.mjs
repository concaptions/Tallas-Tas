/* eslint-disable */
// Row counts per brand for every table behind the workspaces hidden by the Oct 7 template cleanup.
// Read-only; nothing is dropped or deleted anywhere in that cleanup — this is the "what would we lose"
// inventory Talal asked for before deciding on the data. Run from packages/db:
//   DATABASE_URL="postgresql://..." node count-removed-tables.mjs
// The connection string is read from the environment and never printed.
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const REMOVED = [
  ['Creative Modules', ['creative_modules', 'creative_module_angles', 'creative_module_designs']],
  ['AI Characters', ['ai_characters']],
  ['Competitive Research', ['competitive_research']],
  ['Creative Design (list hidden, brief detail kept)', ['creative_briefs', 'brief_asset_folders']],
  ['Client Assets', ['client_asset_folders']],
  [
    'YouTube Copywriting',
    [
      'youtube_copy',
      'youtube_copy_collections',
      'youtube_copy_products',
      'youtube_copy_campaigns',
      'youtube_copy_copy_types',
    ],
  ],
  ['Campaigns & Offers', ['campaigns_offers', 'copywriting_campaigns', 'campaign_concepts']],
  [
    'Email Campaigns',
    [
      'email_campaigns',
      'email_campaign_campaigns',
      'email_campaign_products',
      'email_campaign_collections',
    ],
  ],
  ['Email Flows', ['email_flows', 'email_flow_campaigns']],
  ['SM Campaign Feed', ['sm_campaign_feed_tasks']],
  ['Performance', ['ad_metrics']],
  ['Creative Reporting', ['creative_reporting']],
  ['Creator Ranking', ['creator_rankings']],
  ['Copy Types', ['copy_types', 'copywriting_copy_types']],
  ['Creative Dimensions', ['creative_dimensions']],
];
const REMOVED_TABLE_KEYS = REMOVED.flatMap(([, tables]) => tables);

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const columns = await c.query(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
  [REMOVED_TABLE_KEYS],
);
const columnsByTable = new Map();
for (const row of columns.rows) {
  const set = columnsByTable.get(row.table_name) ?? new Set();
  set.add(row.column_name);
  columnsByTable.set(row.table_name, set);
}

const brands = await c.query(
  'SELECT id, slug, is_template FROM brands WHERE deleted_at IS NULL ORDER BY is_template DESC, slug',
);
const brandLabel = new Map(
  brands.rows.map((b) => [b.id, b.is_template ? `${b.slug} (template)` : b.slug]),
);

console.log('# Removed workspaces — row counts per brand\n');
console.log(`Generated: ${new Date().toISOString()} · brands: ${brands.rows.length}\n`);
console.log('| workspace | table | brand | rows | live (deleted_at IS NULL) |');
console.log('| --- | --- | --- | --- | --- |');

const grand = { rows: 0, live: 0 };
const missing = [];
for (const [workspace, tables] of REMOVED) {
  for (const table of tables) {
    const cols = columnsByTable.get(table);
    if (!cols) {
      missing.push(table);
      console.log(`| ${workspace} | ${table} | — | TABLE MISSING | — |`);
      continue;
    }
    const hasBrand = cols.has('brand_id');
    const hasDeleted = cols.has('deleted_at');
    const live = hasDeleted ? 'COUNT(*) FILTER (WHERE t.deleted_at IS NULL)::int' : 'NULL::int';
    const sql = hasBrand
      ? `SELECT t.brand_id, COUNT(*)::int AS rows, ${live} AS live FROM "${table}" t GROUP BY t.brand_id ORDER BY 1`
      : `SELECT NULL::uuid AS brand_id, COUNT(*)::int AS rows, ${live} AS live FROM "${table}" t`;
    const res = await c.query(sql);
    if (res.rows.length === 0 || (res.rows.length === 1 && res.rows[0].rows === 0)) {
      console.log(`| ${workspace} | ${table} | — | 0 | 0 |`);
      continue;
    }
    for (const r of res.rows) {
      const brand = hasBrand
        ? r.brand_id
          ? (brandLabel.get(r.brand_id) ?? r.brand_id)
          : '(no brand)'
        : '(junction, no brand_id)';
      console.log(`| ${workspace} | ${table} | ${brand} | ${r.rows} | ${r.live ?? 'n/a'} |`);
      grand.rows += r.rows;
      grand.live += r.live ?? r.rows;
    }
  }
}

console.log(`\nTotal rows across removed tables: ${grand.rows} (live: ${grand.live})`);
if (missing.length > 0) console.log(`Tables not present in this database: ${missing.join(', ')}`);

const colDefs = await c.query(
  `SELECT COALESCE(b.slug, '(template/global)') AS brand, cd.table_key, COUNT(*)::int AS rows
   FROM column_definitions cd LEFT JOIN brands b ON b.id = cd.brand_id
   WHERE cd.table_key = ANY($1::text[]) AND cd.deleted_at IS NULL
   GROUP BY 1, 2 ORDER BY 2, 1`,
  [REMOVED_TABLE_KEYS],
);
console.log(
  '\n## column_definitions rows for removed tables (kept; the column admin simply stops showing them)\n',
);
console.log('| brand | table_key | rows |');
console.log('| --- | --- | --- |');
for (const r of colDefs.rows) console.log(`| ${r.brand} | ${r.table_key} | ${r.rows} |`);

const pages = await c.query(
  `SELECT COALESCE(b.slug, '(template/global)') AS brand, p.source_table_key, COUNT(*)::int AS rows
   FROM custom_interface_pages p LEFT JOIN brands b ON b.id = p.brand_id
   WHERE p.source_table_key = ANY($1::text[]) AND p.deleted_at IS NULL
   GROUP BY 1, 2 ORDER BY 2, 1`,
  [REMOVED_TABLE_KEYS],
);
console.log(
  '\n## custom_interface_pages sourced from removed tables (creative_briefs stays readable: the queues use it)\n',
);
console.log('| brand | source_table_key | rows |');
console.log('| --- | --- | --- |');
for (const r of pages.rows) console.log(`| ${r.brand} | ${r.source_table_key} | ${r.rows} |`);

await c.end();
