/* eslint-disable */
// Step 1 of "creative_briefs is the single source of truth for the Creative Sheet" (2026-10-09):
// every creative_sheet_items column, classified as a DUPLICATE of a creative_briefs column, a
// LINK/bookkeeping column, or SHEET-ONLY, with how many live rows hold data in it and, for the
// duplicates, how many disagree with the linked brief. Read-only; the connection string is read from
// the environment and never printed; counts only, never a row's content. From packages/db:
//   DATABASE_URL="postgresql://..." node sheet-columns-audit.mjs
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// How each sheet column relates to the brief. `brief` names the creative_briefs column it copies;
// `note` says when the two vocabularies differ. Anything not listed is reported as UNCLASSIFIED.
const CLASSIFICATION = {
  id: { kind: 'bookkeeping' },
  brand_id: { kind: 'bookkeeping' },
  created_at: { kind: 'bookkeeping', note: 'the Month- prefix of the computed sheet name' },
  updated_at: { kind: 'bookkeeping' },
  created_by: { kind: 'bookkeeping' },
  updated_by: { kind: 'bookkeeping' },
  deleted_at: { kind: 'bookkeeping' },
  template_row_id: { kind: 'bookkeeping', note: 'template propagation' },
  overridden_fields: { kind: 'bookkeeping', note: 'template propagation' },
  custom_fields: { kind: 'bookkeeping', note: 'admin custom fields (jsonb)' },
  legacy_airtable_id: { kind: 'bookkeeping', note: 'the Airtable sheet record id' },
  brief_id: { kind: 'link', brief: 'id' },
  internal_status: {
    kind: 'duplicate',
    brief: 'internal_status',
    note: 'sheet vocabulary differs (no launched/on_hold; adds video_editing_on_hold, design_submitted)',
  },
  status: {
    kind: 'duplicate',
    brief: 'client_status',
    note: 'sheet vocabulary differs (denied, revisions_submitted; no disapproved)',
  },
  client_approval_status: { kind: 'duplicate', brief: 'client_status', note: 'third vocabulary' },
  client_approval_note: { kind: 'duplicate', brief: 'client_status_note' },
  client_approval_status_updated_at: { kind: 'duplicate', brief: 'client_status_updated_at' },
  qa_checklist_doc: { kind: 'duplicate', brief: 'qa_checklist_doc' },
  qa_video_editor: { kind: 'duplicate', brief: 'qa_video_editor' },
  qa_designer: { kind: 'duplicate', brief: 'qa_designer' },
  qa_strategist: { kind: 'duplicate', brief: 'qa_strategist' },
  spell_check_requested: { kind: 'duplicate', brief: 'click_for_ai_spell_checker' },
  spelling_feedback: { kind: 'duplicate', brief: 'spelling_feedback' },
  dimensions: { kind: 'duplicate', brief: 'dimensions' },
  client_comments: { kind: 'sheet-only', note: "the client's comment on the sheet row" },
  used: { kind: 'sheet-only', note: 'Airtable "Used" checkbox' },
  denied_revisions_needed: {
    kind: 'sheet-only',
    note: 'Airtable "Denied / Revisions Needed" checkbox',
  },
  winning: {
    kind: 'sheet-only',
    note: 'best_performing / average; overlaps creative_briefs.performance',
  },
};

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const cols = await c.query(
  `SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'creative_sheet_items'
   ORDER BY ordinal_position`,
);
const briefCols = new Set(
  (
    await c.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'creative_briefs'`,
    )
  ).rows.map((r) => r.column_name),
);
if (cols.rows.length === 0) {
  console.error('creative_sheet_items is missing from this database');
  await c.end();
  process.exit(1);
}

// "Holds data": a non-null value that is not the column's empty default — false for a boolean,
// [] / {} for jsonb, '' for text.
function holdsData(column, type) {
  const q = `s."${column}"`;
  if (type === 'boolean') return `${q} IS TRUE`;
  if (type === 'jsonb') return `${q} IS NOT NULL AND ${q}::text NOT IN ('[]', '{}', 'null')`;
  if (type === 'text') return `${q} IS NOT NULL AND btrim(${q}) <> ''`;
  return `${q} IS NOT NULL`;
}

const total = (
  await c.query(`SELECT COUNT(*)::int AS n FROM creative_sheet_items s WHERE s.deleted_at IS NULL`)
).rows[0].n;

console.log('# creative_sheet_items — column inventory\n');
console.log(`Generated: ${new Date().toISOString()} · live sheet rows: ${total}\n`);
console.log(
  '| column | type | kind | brief column | rows holding data | differ from the linked brief | note |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- |');

const sheetOnlyWithData = [];
const unclassified = [];
for (const col of cols.rows) {
  const name = col.column_name;
  const type = col.data_type;
  const cls = CLASSIFICATION[name] ?? { kind: 'UNCLASSIFIED' };
  if (cls.kind === 'UNCLASSIFIED') unclassified.push(name);

  const data = (
    await c.query(
      `SELECT COUNT(*) FILTER (WHERE ${holdsData(name, type)})::int AS n
       FROM creative_sheet_items s WHERE s.deleted_at IS NULL`,
    )
  ).rows[0].n;

  let differ = '—';
  if (cls.kind === 'duplicate' && cls.brief && briefCols.has(cls.brief)) {
    const r = await c.query(
      `SELECT COUNT(*) FILTER (WHERE s."${name}" IS DISTINCT FROM b."${cls.brief}")::int AS n_any,
              COUNT(*) FILTER (WHERE s."${name}" IS NOT NULL AND b."${cls.brief}" IS NOT NULL
                                 AND s."${name}"::text <> b."${cls.brief}"::text)::int AS n_both_set
       FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
       WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL`,
    );
    differ = `${r.rows[0].n_any} (both set and different: ${r.rows[0].n_both_set})`;
  } else if (cls.kind === 'duplicate') {
    differ = `brief column ${cls.brief ?? '?'} missing`;
  }

  if (cls.kind === 'sheet-only' && data > 0) sheetOnlyWithData.push({ name, data });
  console.log(
    `| ${name} | ${type} | ${cls.kind} | ${cls.brief ?? '—'} | ${data} | ${differ} | ${cls.note ?? ''} |`,
  );
}

console.log('');
if (unclassified.length > 0) {
  console.log(
    `UNCLASSIFIED columns (add them to CLASSIFICATION before deciding): ${unclassified.join(', ')}\n`,
  );
}
if (sheetOnlyWithData.length > 0) {
  console.log('## STOP — sheet-only columns holding data\n');
  console.log('| column | rows holding data |');
  console.log('| --- | --- |');
  for (const { name, data } of sheetOnlyWithData) console.log(`| ${name} | ${data} |`);
  console.log(
    '\nThese have no home on creative_briefs yet. Talal decides per column: move to the brief (a migration), or drop with the table.',
  );
} else {
  console.log(
    '## No sheet-only column holds data — the sheet can become a view over creative_briefs.',
  );
}

await c.end();
