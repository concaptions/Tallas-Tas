/* eslint-disable */
// Stream fresh Airtable attachment URLs straight into R2 and the registry, one record at a time,
// so an attachment is downloaded within seconds of the URL being issued (they expire in ~2 h).
//
//   cd packages/db && node stream-airtable-to-r2.mjs 2>&1 | tee ../../.audit-oct8/stream-r2.log
//
// Env (read from the shell, then from <repo>/.env.local for anything unset): DATABASE_URL,
// AIRTABLE_PAT, AIRTABLE_SOURCE_BASES, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET, R2_PUBLIC_BASE. Idempotent: a pic already on R2_PUBLIC_BASE and a video whose Airtable
// attachment id is already in intro_videos are skipped. Every file is STREAMED: the Airtable
// response body is piped into @aws-sdk/lib-storage's multipart Upload, so memory holds at most
// PART_SIZE × QUEUE_SIZE (16 MB) of a video, never the whole file.
//
// Matching: instagram handle first; otherwise the lowercased, trimmed name, and ONLY when exactly one
// live registry row carries it (an ambiguous name is logged, never guessed). Bases where nothing
// matches are listed at the end and never imported — importing needs Talal's approval per base.
//
// Per-base diagnostics come from the table schema (/meta/bases/{id}/tables): "pic field not found"
// means no candidate field exists in that table (the attachment fields it does have are printed so
// the mapping can be fixed); "pic field empty" means the field exists but the record has no file.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
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
// Per asset: a download that dies (socket reset, ETIMEDOUT) or stalls is retried with a FRESH
// Airtable URL — the old one may already have expired — and after MAX_ATTEMPTS the asset is logged
// as FAIL and the run moves on. The two knobs are env-overridable so the regression test runs fast.
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = Number(process.env.RETRY_BACKOFF_MS ?? 2_000);
const STALL_TIMEOUT_MS = Number(process.env.STALL_TIMEOUT_MS ?? 60_000);

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

function pickField(fields, candidates) {
  for (const name of candidates) {
    const v = fields[name];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return { name, value: v };
  }
  return null;
}
const pickFieldValue = (fields, candidates) => pickField(fields, candidates)?.value ?? null;
const attachments = (v) =>
  Array.isArray(v) ? v.filter((a) => a && typeof a.url === 'string') : [];
const normIg = (v) =>
  typeof v === 'string' ? v.trim().toLowerCase().replace(/^@/, '') || null : null;
const normName = (v) =>
  typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') || null : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- R2 streaming upload ----------
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});
const PART_SIZE = 8 * 1024 * 1024;
const QUEUE_SIZE = 2;
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
/**
 * ONE attempt: pipe the download body into a multipart Upload. `pipeline` destroys the counting
 * Transform with the source's error, which makes `upload.done()` reject — so a socket reset or
 * ETIMEDOUT mid-download surfaces here as a rejection, never as an unhandled 'error' event on a
 * stream nobody is listening to (the Oct 9 crash). A watchdog destroys the source when no bytes
 * arrive for STALL_TIMEOUT_MS. On any failure the multipart upload is aborted so no parts linger.
 * lib-storage reads PART_SIZE chunks with QUEUE_SIZE in flight, so a 300 MB intro never sits in
 * memory. The byte count must equal the size Airtable declared (or Content-Length) — otherwise the
 * finished object is deleted and the attempt fails — so the caller only ever records a complete file.
 */
async function uploadOnce(key, res, contentType, expectedBytes) {
  const source = Readable.fromWeb(res.body);
  let bytes = 0;
  let stallTimer;
  const armStall = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      source.destroy(new Error(`stalled: no bytes for ${STALL_TIMEOUT_MS / 1000}s`));
    }, STALL_TIMEOUT_MS);
  };
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      armStall();
      callback(null, chunk);
    },
  });
  armStall();
  const upload = new Upload({
    client: s3,
    params: { Bucket: R2_BUCKET, Key: key, Body: counter, ContentType: contentType },
    partSize: PART_SIZE,
    queueSize: QUEUE_SIZE,
    leavePartsOnError: false,
  });
  try {
    await Promise.all([pipeline(source, counter), upload.done()]);
  } catch (e) {
    source.destroy();
    await upload.abort().catch(() => {});
    throw e;
  } finally {
    clearTimeout(stallTimer);
  }
  if (bytes === 0 || (expectedBytes !== null && bytes !== expectedBytes)) {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {});
    throw new Error(
      bytes === 0
        ? 'empty body'
        : `size mismatch: received ${bytes} bytes, Airtable declared ${expectedBytes}`,
    );
  }
  return { url: `${R2_PUBLIC_BASE}/${key}`, key, bytes };
}

/** Re-read one record so a retry downloads from a URL Airtable issued just now, not an expired one. */
async function refreshAttachment(base, recordId, fieldName, attachmentId) {
  const record = await airtableGet(
    `https://api.airtable.com/v0/${base.baseId}/${base.creatorsTableId}/${recordId}`,
  );
  const list = attachments(record.fields?.[fieldName]);
  if (attachmentId) return list.find((a) => a.id === attachmentId) ?? null;
  return list[0] ?? null;
}

/**
 * Download + upload one attachment with up to MAX_ATTEMPTS tries (exponential backoff, fresh URL
 * each retry). Resolves only when an attempt completed AND the byte count was verified; throws the
 * last error otherwise. Never writes to the database — the caller does, after this resolves.
 */
async function transferAsset({ t, base, label, record, fieldName, attachment: first, row }) {
  let attachment = first;
  let lastError = new Error('no attempt made');
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      if (attempt > 1) {
        await sleep(RETRY_BACKOFF_MS * 2 ** (attempt - 2));
        const fresh = await refreshAttachment(base, record.id, fieldName, attachment.id);
        if (!fresh) throw new Error('attachment is no longer on the Airtable record');
        attachment = fresh;
      }
      const res = await fetch(attachment.url);
      if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
      const contentType = (
        attachment.type ||
        res.headers.get('content-type') ||
        'application/octet-stream'
      )
        .split(';')[0]
        .trim();
      const declared =
        typeof attachment.size === 'number'
          ? attachment.size
          : Number(res.headers.get('content-length')) || null;
      const key = `creator-registry/${row.id}/${t.prefix}-${randomUUID()}.${extensionFor(contentType, attachment.filename)}`;
      const put = await uploadOnce(key, res, contentType, declared);
      return { ...put, contentType, attachment, attempts: attempt };
    } catch (e) {
      lastError = e;
      console.log(
        `  RETRY ${t.kind} ${row.id} <- ${label}/${record.id}: attempt ${attempt}/${MAX_ATTEMPTS} failed: ${e.message}`,
      );
    }
  }
  throw new Error(`${lastError.message} (after ${MAX_ATTEMPTS} attempts)`);
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
        const picked = pickField(fields, t.fields);
        if (picked === null) {
          const missing = schema.known ? schema[t.schemaKey] === null : false;
          const bucket = missing ? 'fieldMissing' : 'fieldEmpty';
          totals[t.kind][bucket] += 1;
          stats[t.kind][bucket] += 1;
          continue;
        }
        const files =
          t.kind === 'video' && VIDEO_MODE === 'jsonb'
            ? attachments(picked.value)
            : attachments(picked.value).slice(0, 1);
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
            // Resolves only after the upload completed and the byte count matched; the DB writes
            // below never run for a partial or failed transfer.
            const put = await transferAsset({
              t,
              base,
              label,
              record,
              fieldName: picked.name,
              attachment,
              row,
            });
            const { contentType } = put;
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
                airtableAttachmentId: put.attachment.id ?? null,
                filename: put.attachment.filename ?? null,
                contentType,
                bytes: put.bytes,
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
              `  OK   ${t.kind} ${row.id} <- ${label}/${record.id} (${(put.bytes / 1024).toFixed(0)} KB${put.attempts > 1 ? `, attempt ${put.attempts}` : ''})`,
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
