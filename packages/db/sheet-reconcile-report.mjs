/* eslint-disable */
// Reconcile report for the three creative_sheet_items columns that disagree with creative_briefs
// (step 1 of "creative_briefs is the single source of truth", 2026-10-09): status vs client_status,
// qa_checklist_doc, spelling_feedback, plus the spell_check_requested trigger flag. Read-only; the
// connection string is read from the environment and never printed; ids and counts only, never a
// row's text. From packages/db:
//   DATABASE_URL="postgresql://..." node sheet-reconcile-report.mjs [--head] [--export <airtable.json>]
//
// qa_checklist_doc holds URL STRINGS only (the importer kept `url` and dropped filename and size), and
// the URL migration re-hosted the BRIEF side to R2 (`migrated/<briefId>/qaChecklistDoc-<uuid>`) while
// the sheet side kept its Airtable CDN URLs — so by URL every pair differs. Two ways to compare the
// FILES instead:
//   --head            HEAD every unique URL and compare by Content-Length (and ETag where both sides
//                     have one). Expired Airtable links count as unreachable. Needs network access.
//   --export <file>   the Airtable export JSON the importer read: its attachment objects carry
//                     filename and size for the sheet-side Airtable URLs, so the comparison can use
//                     filename + size without touching the expired links. R2 URLs still need --head
//                     for their size. Both flags together give the fullest picture.
import fs from 'node:fs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const args = process.argv.slice(2);
const HEAD = args.includes('--head');
const exportIndex = args.indexOf('--export');
const EXPORT_PATH = exportIndex >= 0 ? args[exportIndex + 1] : null;
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE ?? '';

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

const table = (header, rows) => {
  console.log(`| ${header.join(' | ')} |`);
  console.log(`| ${header.map(() => '---').join(' | ')} |`);
  for (const r of rows) console.log(`| ${r.join(' | ')} |`);
  console.log('');
};
const PAIRS = `FROM creative_sheet_items s JOIN creative_briefs b ON b.id = s.brief_id
  WHERE s.deleted_at IS NULL AND b.deleted_at IS NULL`;

const total = (await c.query(`SELECT COUNT(*)::int AS n ${PAIRS}`)).rows[0].n;
console.log('# Creative Sheet reconcile report — sheet row vs linked brief\n');
console.log(
  `Generated: ${new Date().toISOString()} · live pairs: ${total} · mode: ${HEAD ? 'HEAD' : 'no network'}${EXPORT_PATH ? ' + export' : ''}\n`,
);

// ── 1. status vs client_status ──────────────────────────────────────────────────────────────────
console.log('## 1. sheet.status vs creative_briefs.client_status\n');
const cross = await c.query(`
  SELECT COALESCE(s.status, '(null)') AS sheet_status,
         COALESCE(b.client_status, '(null)') AS brief_client_status,
         COUNT(*)::int AS pairs,
         COUNT(*) FILTER (WHERE s.updated_at > b.updated_at)::int AS sheet_updated_later,
         COUNT(*) FILTER (WHERE b.updated_at > s.updated_at)::int AS brief_updated_later,
         COUNT(*) FILTER (WHERE b.client_status_updated_at IS NOT NULL)::int AS brief_status_stamped,
         COUNT(*) FILTER (WHERE b.client_status_updated_at IS NOT NULL AND b.client_status_updated_at > s.updated_at)::int AS brief_status_moved_after_sheet
  ${PAIRS}
  GROUP BY 1, 2 ORDER BY 3 DESC, 1, 2`);
table(
  [
    'sheet.status',
    'brief.client_status',
    'pairs',
    'sheet row updated later',
    'brief updated later',
    'brief.client_status_updated_at set',
    'brief status moved after the sheet row',
  ],
  cross.rows.map((r) => [
    r.sheet_status,
    r.brief_client_status,
    r.pairs,
    r.sheet_updated_later,
    r.brief_updated_later,
    r.brief_status_stamped,
    r.brief_status_moved_after_sheet,
  ]),
);
console.log(
  '"updated later" compares the two rows\' updated_at; a sheet row and its brief imported in the same run tie on neither side. The last column is the strongest signal: the brief\'s client status changed on the platform after the sheet row was last written.\n',
);

// ── 2. qa_checklist_doc ─────────────────────────────────────────────────────────────────────────
console.log('## 2. qa_checklist_doc (attachment lists)\n');
const docs = await c.query(`
  SELECT s.id AS sheet_id, b.id AS brief_id,
         COALESCE(s.qa_checklist_doc, '[]'::jsonb) AS sheet_docs,
         COALESCE(b.qa_checklist_doc, '[]'::jsonb) AS brief_docs
  ${PAIRS}`);
const hostOf = (url) => {
  try {
    const h = new URL(url).host;
    if (h.endsWith('airtableusercontent.com')) return 'airtable';
    if (R2_PUBLIC_BASE && url.startsWith(R2_PUBLIC_BASE)) return 'r2';
    if (h.endsWith('.r2.dev')) return 'r2';
    return 'other';
  } catch {
    return 'invalid';
  }
};
const hostCounts = {
  sheet: { airtable: 0, r2: 0, other: 0, invalid: 0 },
  brief: { airtable: 0, r2: 0, other: 0, invalid: 0 },
};
const shape = { bothEmpty: 0, sheetOnly: 0, briefOnly: 0, bothSet: 0, sameUrls: 0, sameCount: 0 };
const urls = new Set();
for (const r of docs.rows) {
  const sd = Array.isArray(r.sheet_docs) ? r.sheet_docs : [];
  const bd = Array.isArray(r.brief_docs) ? r.brief_docs : [];
  for (const u of sd) {
    hostCounts.sheet[hostOf(u)] += 1;
    urls.add(u);
  }
  for (const u of bd) {
    hostCounts.brief[hostOf(u)] += 1;
    urls.add(u);
  }
  if (sd.length === 0 && bd.length === 0) shape.bothEmpty += 1;
  else if (bd.length === 0) shape.sheetOnly += 1;
  else if (sd.length === 0) shape.briefOnly += 1;
  else {
    shape.bothSet += 1;
    if (sd.length === bd.length) shape.sameCount += 1;
    if ([...sd].sort().join('\n') === [...bd].sort().join('\n')) shape.sameUrls += 1;
  }
}
table(
  ['side', 'URLs still on airtableusercontent.com', 'URLs on R2', 'other hosts', 'invalid'],
  ['sheet', 'brief'].map((side) => [
    side,
    hostCounts[side].airtable,
    hostCounts[side].r2,
    hostCounts[side].other,
    hostCounts[side].invalid,
  ]),
);
table(
  ['pairs', 'count'],
  [
    ['both sides empty', shape.bothEmpty],
    ['sheet has files, brief empty', shape.sheetOnly],
    ['brief has files, sheet empty', shape.briefOnly],
    ['both have files', shape.bothSet],
    ['  of which same number of files', shape.sameCount],
    ['  of which identical URL lists', shape.sameUrls],
  ],
);

// File identity: filename + size from the export for Airtable URLs, Content-Length (+ ETag) from HEAD.
const meta = new Map(); // url -> { filename, size, etag, status }
if (EXPORT_PATH) {
  const data = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  const walk = (v) => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (v && typeof v === 'object') {
      if (
        typeof v.url === 'string' &&
        (typeof v.filename === 'string' || typeof v.size === 'number')
      ) {
        meta.set(v.url, {
          filename: v.filename ?? null,
          size: v.size ?? null,
          etag: null,
          status: 'export',
        });
      }
      for (const x of Object.values(v)) walk(x);
    }
  };
  walk(data);
  console.log(`Export: ${meta.size} attachment objects with filename/size indexed by URL.\n`);
}
if (HEAD) {
  const list = [...urls].filter((u) => !meta.has(u));
  let done = 0;
  const worker = async () => {
    for (;;) {
      const u = list.shift();
      if (u === undefined) return;
      try {
        const res = await fetch(u, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(20_000),
        });
        const cd = res.headers.get('content-disposition') ?? '';
        const fn = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)?.[1] ?? null;
        meta.set(u, {
          filename: fn ? decodeURIComponent(fn) : null,
          size: res.headers.get('content-length')
            ? Number(res.headers.get('content-length'))
            : null,
          etag: res.headers.get('etag')?.replace(/^W\//, '').replace(/"/g, '') ?? null,
          status: res.ok ? 'ok' : `http ${res.status}`,
        });
      } catch (e) {
        meta.set(u, { filename: null, size: null, etag: null, status: `error ${e?.name ?? ''}` });
      }
      done += 1;
      if (done % 50 === 0) console.error(`HEAD ${done}/${list.length + done}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const statuses = {};
  for (const m of meta.values()) statuses[m.status] = (statuses[m.status] ?? 0) + 1;
  console.log(
    'HEAD results by status: ' +
      Object.entries(statuses)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') +
      '\n',
  );
}
if (meta.size > 0) {
  const key = (u) => {
    const m = meta.get(u);
    if (!m || m.size === null) return null;
    return m.filename ? `${m.filename}|${m.size}` : `size:${m.size}`;
  };
  const files = {
    same: 0,
    different: 0,
    sheetEmpty: 0,
    briefEmpty: 0,
    unresolved: 0,
    etagMatches: 0,
  };
  for (const r of docs.rows) {
    const sd = Array.isArray(r.sheet_docs) ? r.sheet_docs : [];
    const bd = Array.isArray(r.brief_docs) ? r.brief_docs : [];
    if (sd.length === 0 && bd.length === 0) continue;
    if (sd.length === 0) {
      files.sheetEmpty += 1;
      continue;
    }
    if (bd.length === 0) {
      files.briefEmpty += 1;
      continue;
    }
    const sk = sd.map(key),
      bk = bd.map(key);
    if (sk.includes(null) || bk.includes(null)) {
      files.unresolved += 1;
      continue;
    }
    // filename+size on one side and size-only on the other still match on size alone
    const norm = (k) => k.replace(/^.*\|/, 'size:');
    const a = sk.map(norm).sort().join('\n'),
      z = bk.map(norm).sort().join('\n');
    if (a === z) files.same += 1;
    else files.different += 1;
    const se = sd.map((u) => meta.get(u)?.etag).filter(Boolean),
      be = bd.map((u) => meta.get(u)?.etag).filter(Boolean);
    if (se.length > 0 && se.length === be.length && [...se].sort().join() === [...be].sort().join())
      files.etagMatches += 1;
  }
  table(
    ['file comparison (size, and filename where known)', 'pairs'],
    [
      ['same files', files.same],
      ['different files', files.different],
      ['sheet side empty', files.sheetEmpty],
      ['brief side empty', files.briefEmpty],
      ['could not resolve one side (expired / unreachable / not in export)', files.unresolved],
      [
        '  of the "same" pairs, also identical ETags (strong match, R2 both sides)',
        files.etagMatches,
      ],
    ],
  );
} else {
  console.log(
    'No file identity available without --head or --export: the column stores URLs only (no filename, no size). Re-run with `--head` (sizes via Content-Length; expired Airtable links will be unreachable) and/or `--export <airtable.json>` (filename + size for the sheet side).\n',
  );
}

// ── 3. spelling_feedback ────────────────────────────────────────────────────────────────────────
console.log('## 3. spelling_feedback\n');
const sf = await c.query(`
  SELECT b.id AS brief_id,
         NULLIF(btrim(s.spelling_feedback), '') AS sheet_v,
         NULLIF(btrim(b.spelling_feedback), '') AS brief_v
  ${PAIRS}`);
const spell = { sheetOnly: 0, briefOnly: 0, bothSame: 0, bothDifferent: 0, bothEmpty: 0 };
const differentIds = [];
for (const r of sf.rows) {
  if (r.sheet_v === null && r.brief_v === null) spell.bothEmpty += 1;
  else if (r.brief_v === null) spell.sheetOnly += 1;
  else if (r.sheet_v === null) spell.briefOnly += 1;
  else if (r.sheet_v === r.brief_v) spell.bothSame += 1;
  else {
    spell.bothDifferent += 1;
    differentIds.push(r.brief_id);
  }
}
table(
  ['spelling_feedback', 'pairs'],
  [
    ['sheet only', spell.sheetOnly],
    ['brief only', spell.briefOnly],
    ['both, same text', spell.bothSame],
    ['both, different text', spell.bothDifferent],
    ['both empty', spell.bothEmpty],
  ],
);
if (differentIds.length > 0) {
  console.log('Brief ids where both sides hold different feedback:\n');
  for (const id of differentIds) console.log(`- ${id}`);
  console.log('');
}

// ── 4. spell_check_requested (trigger flag; not migrated) ──────────────────────────────────────
console.log(
  '## 4. spell_check_requested vs click_for_ai_spell_checker (trigger flags, counts only)\n',
);
const flags = (
  await c.query(`
  SELECT COUNT(*) FILTER (WHERE s.spell_check_requested)::int AS sheet_on,
         COUNT(*) FILTER (WHERE b.click_for_ai_spell_checker)::int AS brief_on,
         COUNT(*) FILTER (WHERE s.spell_check_requested AND b.click_for_ai_spell_checker)::int AS both_on,
         COUNT(*) FILTER (WHERE s.spell_check_requested AND NOT b.click_for_ai_spell_checker)::int AS sheet_only,
         COUNT(*) FILTER (WHERE NOT s.spell_check_requested AND b.click_for_ai_spell_checker)::int AS brief_only
  ${PAIRS}`)
).rows[0];
table(
  ['flag', 'pairs'],
  [
    ['sheet.spell_check_requested on', flags.sheet_on],
    ['brief.click_for_ai_spell_checker on', flags.brief_on],
    ['both on', flags.both_on],
    ['sheet only', flags.sheet_only],
    ['brief only', flags.brief_only],
  ],
);

await c.end();
