/* eslint-disable */
// Stream fresh Airtable attachment URLs straight into R2 and the registry, one record at a time,
// so an attachment is downloaded within seconds of the URL being issued (they expire in ~2 h).
//
//   cd packages/db && node stream-airtable-to-r2.mjs 2>&1 | tee ../../.audit-oct8/stream-r2.log
//
// Env (read from the shell, then from <repo>/.env.local for anything unset): DATABASE_URL,
// AIRTABLE_PAT, AIRTABLE_SOURCE_BASES, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET, R2_PUBLIC_BASE. Idempotent: a pic already on R2_PUBLIC_BASE and a video whose Airtable
// attachment id is already in intro_videos are skipped. Uploads use the same dependency-free SigV4
// PUT as src/r2.ts (no @aws-sdk in this workspace).
//
// Matching: instagram handle first; otherwise the lowercased, trimmed name, and ONLY when exactly one
// live registry row carries it (an ambiguous name is logged, never guessed). Bases where nothing
// matches are listed at the end and never imported — importing needs Talal's approval per base.
//
// Per-base diagnostics come from the table schema (/meta/bases/{id}/tables): "pic field not found"
// means no candidate field exists in that table (the attachment fields it does have are printed so
// the mapping can be fixed); "pic field empty" means the field exists but the record has no file.
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// ---------- env ----------
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const envFile = resolve(REPO_ROOT, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || m[1] in process.env) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    // Two assignments merged on one line (`R2_BUCKET=x R2_PUBLIC_BASE=y`) would silently poison the
    // first value and surface later as an R2 403; refuse it here, naming the line.
    if (/\s[A-Z0-9_]+=/.test(v)) {
      console.error(
        `.env.local: the ${m[1]} line also contains another KEY=…; put each variable on its own line`,
      );
      process.exit(1);
    }
    if (v !== '') process.env[m[1]] = v;
  }
}
const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`missing env ${k}`);
    process.exit(1);
  }
  return v;
};
const AIRTABLE_PAT = need('AIRTABLE_PAT');
const R2_ACCOUNT_ID = need('R2_ACCOUNT_ID');
const R2_ACCESS_KEY_ID = need('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = need('R2_SECRET_ACCESS_KEY');
const R2_BUCKET = need('R2_BUCKET');
const R2_PUBLIC_BASE = need('R2_PUBLIC_BASE').replace(/\/+$/, '');
let DATABASE_URL = need('DATABASE_URL');
const KEEPALIVE = 'keepalives=1&keepalives_idle=30&keepalives_interval=10&keepalives_count=3';
if (!DATABASE_URL.includes('keepalives='))
  DATABASE_URL += (DATABASE_URL.includes('?') ? '&' : '?') + KEEPALIVE;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

let bases;
try {
  bases = JSON.parse(need('AIRTABLE_SOURCE_BASES'));
} catch {
  console.error('AIRTABLE_SOURCE_BASES is not valid JSON');
  process.exit(1);
}
if (!Array.isArray(bases) || bases.length === 0) {
  console.error(
    'AIRTABLE_SOURCE_BASES must be a non-empty JSON array of {baseId, creatorsTableId, brandLabel}',
  );
  process.exit(1);
}

// ---------- field candidates (schemas differ per base) ----------
const NAME_FIELDS = [
  'Creator name',
  'Creator Name',
  'Creators Name',
  "Creator's Name",
  'Name',
  'Full Name',
];
const IG_FIELDS = ['Instagram', 'IG', 'Instagram Username', 'Instagram Handle'];
const PIC_FIELDS = ["Creator's Profile Pic", 'Profile Pic', 'Profile Picture'];
const VIDEO_FIELDS = ["Creator's Video Intro", "Creator's Intro", 'Video Intro', 'Intro Video'];

function pickFieldValue(fields, candidates) {
  for (const name of candidates) {
    const v = fields[name];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return v;
  }
  return null;
}
const attachments = (v) =>
  Array.isArray(v) ? v.filter((a) => a && typeof a.url === 'string') : [];
const normIg = (v) =>
  typeof v === 'string' ? v.trim().toLowerCase().replace(/^@/, '') || null : null;
const normName = (v) =>
  typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') || null : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- R2 SigV4 PUT (mirrors src/r2.ts) ----------
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const hex = (data) => createHash('sha256').update(data).digest('hex');
const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};
function extensionFor(contentType, filename) {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(filename ?? '')?.[1]?.toLowerCase();
  return EXT_BY_TYPE[contentType] ?? fromName ?? 'bin';
}
async function putToR2(key, body, contentType) {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = `https://${host}/${R2_BUCKET}/${encodedKey}`;
  const now = new Date();
  const ds = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amz = `${ds}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const ph = hex(new Uint8Array(body));
  const ch = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${amz}\n`;
  const sh = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const cr = `PUT\n/${R2_BUCKET}/${encodedKey}\n\n${ch}\n${sh}\n${ph}`;
  const scope = `${ds}/auto/s3/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${hex(cr)}`;
  const sk = hmac(
    hmac(hmac(hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, ds), 'auto'), 's3'),
    'aws4_request',
  );
  const sig = createHmac('sha256', sk).update(sts).digest('hex');
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Host: host,
      'x-amz-content-sha256': ph,
      'x-amz-date': amz,
      Authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${sh}, Signature=${sig}`,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`R2 PUT ${res.status} ${(await res.text()).slice(0, 200)}`);
  return { url: `${R2_PUBLIC_BASE}/${key}`, key };
}

// ---------- Airtable ----------
async function airtableGet(url, attempt = 0) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
  if (res.status === 429 && attempt < 3) {
    console.log('  airtable 429, backing off 30s');
    await sleep(30_000);
    return airtableGet(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`Airtable ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function* listRecords(base) {
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base.baseId}/${base.creatorsTableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const body = await airtableGet(url);
    for (const record of body.records ?? []) yield record;
    offset = body.offset;
    if (offset) await sleep(200);
  } while (offset);
}
/** The table's schema: which candidate fields exist and which attachment fields it has at all. */
async function tableSchema(base) {
  try {
    const meta = await airtableGet(`https://api.airtable.com/v0/meta/bases/${base.baseId}/tables`);
    const table = (meta.tables ?? []).find(
      (t) => t.id === base.creatorsTableId || t.name === base.creatorsTableId,
    );
    if (!table) return { known: false, reason: 'table not in base metadata' };
    const names = new Set(table.fields.map((f) => f.name));
    return {
      known: true,
      tableName: table.name,
      picField: PIC_FIELDS.find((n) => names.has(n)) ?? null,
      videoField: VIDEO_FIELDS.find((n) => names.has(n)) ?? null,
      nameField: NAME_FIELDS.find((n) => names.has(n)) ?? null,
      igField: IG_FIELDS.find((n) => names.has(n)) ?? null,
      attachmentFields: table.fields
        .filter((f) => f.type === 'multipleAttachments')
        .map((f) => f.name),
    };
  } catch (e) {
    return { known: false, reason: e.message };
  }
}

// ---------- registry index ----------
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const cols = await client.query(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'creator_registry' AND column_name IN ('profile_pic_url','video_intro_url','intro_videos','instagram_username','normalized_instagram')",
);
const have = new Map(cols.rows.map((r) => [r.column_name, r.data_type]));
if (!have.has('profile_pic_url')) {
  console.error('creator_registry.profile_pic_url is missing; wrong database?');
  process.exit(1);
}
// Videos: prefer the jsonb list (every intro, keyed by Airtable attachment id); fall back to the
// single text column; otherwise skip videos and say so.
const VIDEO_MODE =
  have.get('intro_videos') === 'jsonb' ? 'jsonb' : have.has('video_intro_url') ? 'text' : 'none';
if (VIDEO_MODE === 'none')
  console.log(
    'NOTE creator_registry has neither intro_videos jsonb nor video_intro_url — videos will be skipped',
  );
const TARGETS = [
  {
    kind: 'pic',
    column: 'profile_pic_url',
    fields: PIC_FIELDS,
    prefix: 'profile',
    schemaKey: 'picField',
  },
  ...(VIDEO_MODE === 'none'
    ? []
    : [
        {
          kind: 'video',
          column: VIDEO_MODE === 'jsonb' ? 'intro_videos' : 'video_intro_url',
          fields: VIDEO_FIELDS,
          prefix: 'intro',
          schemaKey: 'videoField',
        },
      ]),
];

const reg = await client.query(
  `SELECT id, name, instagram_username,
          ${have.has('normalized_instagram') ? 'normalized_instagram' : 'NULL AS normalized_instagram'},
          profile_pic_url
          ${VIDEO_MODE === 'jsonb' ? ', intro_videos' : VIDEO_MODE === 'text' ? ', video_intro_url' : ''}
   FROM creator_registry WHERE deleted_at IS NULL`,
);
const byIg = new Map();
const byName = new Map();
for (const row of reg.rows) {
  const ig = row.normalized_instagram ?? normIg(row.instagram_username);
  if (ig && !byIg.has(ig)) byIg.set(ig, row);
  const name = normName(row.name);
  if (name) byName.set(name, [...(byName.get(name) ?? []), row]);
}
const ambiguousNames = [...byName.entries()].filter(([, rows]) => rows.length > 1);
console.log(
  `registry: ${reg.rows.length} live rows (${byIg.size} by instagram, ${byName.size} distinct names, ${ambiguousNames.length} names shared by 2+ rows); targets: ${TARGETS.map((t) => `${t.kind}${t.kind === 'video' ? `→${t.column}` : ''}`).join(', ')}`,
);

const isR2 = (v) => typeof v === 'string' && v.startsWith(R2_PUBLIC_BASE);
const hasVideo = (row, attachmentId) =>
  VIDEO_MODE === 'jsonb'
    ? (Array.isArray(row.intro_videos) ? row.intro_videos : []).some(
        (v) => v && v.airtableAttachmentId === attachmentId,
      )
    : isR2(row.video_intro_url);

// ---------- stream ----------
const totals = {
  bases: 0,
  records: 0,
  matchedByIg: 0,
  matchedByName: 0,
  unmatched: 0,
  ambiguousName: 0,
};
for (const t of TARGETS)
  totals[t.kind] = { done: 0, skipped: 0, failed: 0, fieldMissing: 0, fieldEmpty: 0 };
const failures = [];
const baseReports = [];
const ambiguousSeen = new Map();
const started = Date.now();

for (const base of bases) {
  totals.bases += 1;
  const label = base.brandLabel ?? base.baseId;
  const schema = await tableSchema(base);
  const stats = {
    label,
    baseId: base.baseId,
    tableId: base.creatorsTableId,
    records: 0,
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    schema,
  };
  for (const t of TARGETS)
    stats[t.kind] = { done: 0, skipped: 0, failed: 0, fieldMissing: 0, fieldEmpty: 0 };
  console.log(`\n=== ${label} (${base.baseId}/${base.creatorsTableId}) ===`);
  if (schema.known) {
    for (const t of TARGETS) {
      const field = schema[t.schemaKey];
      console.log(
        `  ${t.kind} field: ${field ? `"${field}"` : `NOT FOUND (attachment fields here: ${schema.attachmentFields.length ? schema.attachmentFields.map((n) => `"${n}"`).join(', ') : 'none'})`}`,
      );
    }
    if (!schema.nameField)
      console.log(`  name field: NOT FOUND among ${NAME_FIELDS.map((n) => `"${n}"`).join(', ')}`);
  } else {
    console.log(
      `  schema: unavailable (${schema.reason}); field diagnostics fall back to record contents`,
    );
  }
  try {
    for await (const record of listRecords(base)) {
      totals.records += 1;
      stats.records += 1;
      const fields = record.fields ?? {};
      const ig = normIg(pickFieldValue(fields, IG_FIELDS));
      const name = normName(pickFieldValue(fields, NAME_FIELDS));
      let row = ig ? (byIg.get(ig) ?? null) : null;
      let how = row ? 'instagram' : null;
      if (!row && name) {
        const candidates = byName.get(name) ?? [];
        if (candidates.length === 1) {
          row = candidates[0];
          how = 'name';
        } else if (candidates.length > 1) {
          totals.ambiguousName += 1;
          stats.ambiguous += 1;
          const key = `${label}::${name}`;
          if (!ambiguousSeen.has(key)) {
            ambiguousSeen.set(key, candidates.length);
            console.log(
              `  AMBIG name "${name}" matches ${candidates.length} registry rows — not used (${label}/${record.id})`,
            );
          }
          continue;
        }
      }
      if (!row) {
        totals.unmatched += 1;
        stats.unmatched += 1;
        continue;
      }
      if (how === 'instagram') totals.matchedByIg += 1;
      else totals.matchedByName += 1;
      stats.matched += 1;

      for (const t of TARGETS) {
        const value = pickFieldValue(fields, t.fields);
        if (value === null) {
          const missing = schema.known ? schema[t.schemaKey] === null : false;
          const bucket = missing ? 'fieldMissing' : 'fieldEmpty';
          totals[t.kind][bucket] += 1;
          stats[t.kind][bucket] += 1;
          continue;
        }
        const files =
          t.kind === 'video' && VIDEO_MODE === 'jsonb'
            ? attachments(value)
            : attachments(value).slice(0, 1);
        for (const attachment of files) {
          const already =
            t.kind === 'pic' ? isR2(row.profile_pic_url) : hasVideo(row, attachment.id);
          if (already) {
            totals[t.kind].skipped += 1;
            stats[t.kind].skipped += 1;
            continue;
          }
          try {
            if (
              t.kind === 'video' &&
              typeof attachment.size === 'number' &&
              attachment.size > MAX_VIDEO_BYTES
            ) {
              throw new Error(
                `video ${(attachment.size / 1048576).toFixed(0)} MB exceeds the ${MAX_VIDEO_BYTES / 1048576} MB cap`,
              );
            }
            const res = await fetch(attachment.url);
            if (!res.ok) throw new Error(`download ${res.status}`);
            const body = await res.arrayBuffer();
            if (body.byteLength === 0) throw new Error('empty body');
            const contentType = (
              attachment.type ||
              res.headers.get('content-type') ||
              'application/octet-stream'
            )
              .split(';')[0]
              .trim();
            const key = `creator-registry/${row.id}/${t.prefix}-${randomUUID()}.${extensionFor(contentType, attachment.filename)}`;
            const put = await putToR2(key, body, contentType);
            if (t.kind === 'pic' || VIDEO_MODE === 'text') {
              await client.query(
                `UPDATE creator_registry SET ${t.column} = $1, updated_at = now(), updated_by = 'script:stream-airtable-to-r2' WHERE id = $2`,
                [put.url, row.id],
              );
              row[t.column] = put.url;
            } else {
              const entry = {
                url: put.url,
                r2Key: put.key,
                airtableAttachmentId: attachment.id ?? null,
                filename: attachment.filename ?? null,
                contentType,
                bytes: body.byteLength,
                sourceBase: base.baseId,
                sourceBrand: label,
                sourceRecord: record.id,
                uploadedAt: new Date().toISOString(),
              };
              await client.query(
                `UPDATE creator_registry SET intro_videos = COALESCE(intro_videos, '[]'::jsonb) || $1::jsonb, updated_at = now(), updated_by = 'script:stream-airtable-to-r2' WHERE id = $2`,
                [JSON.stringify([entry]), row.id],
              );
              row.intro_videos = [
                ...(Array.isArray(row.intro_videos) ? row.intro_videos : []),
                entry,
              ];
            }
            totals[t.kind].done += 1;
            stats[t.kind].done += 1;
            console.log(
              `  OK   ${t.kind} ${row.id} <- ${label}/${record.id} (${(body.byteLength / 1024).toFixed(0)} KB)`,
            );
          } catch (e) {
            totals[t.kind].failed += 1;
            stats[t.kind].failed += 1;
            failures.push({
              base: label,
              record: record.id,
              registry: row.id,
              kind: t.kind,
              error: e.message,
            });
            console.log(`  FAIL ${t.kind} ${row.id} <- ${label}/${record.id}: ${e.message}`);
          }
        }
      }
    }
  } catch (e) {
    console.log(`  BASE FAIL ${label}: ${e.message}`);
    failures.push({ base: label, record: '-', registry: '-', kind: 'base', error: e.message });
  }
  baseReports.push(stats);
  console.log(
    `--- ${label}: ${stats.records} records, ${stats.matched} matched, ${stats.unmatched} unmatched, ${stats.ambiguous} ambiguous; ` +
      TARGETS.map(
        (t) =>
          `${t.kind}s: ${stats[t.kind].done} uploaded, ${stats[t.kind].skipped} already R2, ${stats[t.kind].fieldMissing} field-missing, ${stats[t.kind].fieldEmpty} field-empty, ${stats[t.kind].failed} failed`,
      ).join('; '),
  );
  await sleep(300);
}

// ---------- summary + verification ----------
console.log(`\nDONE in ${((Date.now() - started) / 60_000).toFixed(1)} min`);
console.log(
  `bases ${totals.bases} · records ${totals.records} · matched ${totals.matchedByIg + totals.matchedByName} (${totals.matchedByIg} by instagram, ${totals.matchedByName} by unique name) · unmatched ${totals.unmatched} · ambiguous name ${totals.ambiguousName}`,
);
for (const t of TARGETS) {
  const s = totals[t.kind];
  console.log(
    `${t.kind}s: done ${s.done} · skipped (already R2) ${s.skipped} · field missing in table ${s.fieldMissing} · field empty on record ${s.fieldEmpty} · failed ${s.failed}`,
  );
}

const zeroMatched = baseReports.filter((b) => b.matched === 0);
console.log(
  `\nbases with no matching registry row (${zeroMatched.length}, ${zeroMatched.reduce((n, b) => n + b.records, 0)} records) — NOT imported; needs Talal's approval per base:`,
);
for (const b of zeroMatched)
  console.log(`  ${b.label}: ${b.records} records (${b.baseId}/${b.tableId})`);

const picMissing = baseReports.filter(
  (b) => b.schema.known && b.schema.picField === null && b.matched > 0,
);
if (picMissing.length > 0) {
  console.log(
    `\nbases with matches but no pic field (${picMissing.length}) — attachment fields they do have:`,
  );
  for (const b of picMissing)
    console.log(
      `  ${b.label}: ${b.schema.attachmentFields.length ? b.schema.attachmentFields.map((n) => `"${n}"`).join(', ') : 'none'}`,
    );
}

if (ambiguousSeen.size > 0) {
  console.log(
    `\nambiguous names (${ambiguousSeen.size}) — name shared by several registry rows, skipped:`,
  );
  for (const [key, n] of ambiguousSeen) console.log(`  ${key.replace('::', ' · "')}" → ${n} rows`);
}

if (failures.length > 0) {
  console.log(`\nfailures (${failures.length}):`);
  for (const f of failures)
    console.log(`  ${f.kind} ${f.base}/${f.record} -> ${f.registry}: ${f.error}`);
}

const verify = await client.query(
  `SELECT COUNT(*)::int AS total,
          COUNT(profile_pic_url) FILTER (WHERE profile_pic_url LIKE '%r2.dev%')::int AS pics_in_r2
          ${VIDEO_MODE === 'jsonb' ? ", COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(intro_videos, '[]'::jsonb)) > 0)::int AS with_intro_videos, COALESCE(SUM(jsonb_array_length(COALESCE(intro_videos, '[]'::jsonb))), 0)::int AS intro_videos_total" : ''}
          ${VIDEO_MODE === 'text' ? ", COUNT(video_intro_url) FILTER (WHERE video_intro_url LIKE '%r2.dev%')::int AS videos_in_r2" : ''}
   FROM creator_registry`,
);
console.log('\nverification:');
console.table(verify.rows);
await client.end();
process.exitCode = failures.some((f) => f.kind === 'base') ? 1 : 0;
