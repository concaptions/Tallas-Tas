/* eslint-disable */
// Stream fresh Airtable attachment URLs straight into R2 and the registry, one record at a time,
// so an attachment is downloaded within seconds of the URL being issued (they expire in ~2 h).
//
//   cd packages/db && node stream-airtable-to-r2.mjs 2>&1 | tee ../../.audit-oct8/stream-r2.log
//
// Env (read from the shell, then from <repo>/.env.local for anything unset): DATABASE_URL,
// AIRTABLE_PAT, AIRTABLE_SOURCE_BASES, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET, R2_PUBLIC_BASE. Idempotent: a column already pointing at R2_PUBLIC_BASE is skipped.
// Uploads use the same dependency-free SigV4 PUT as src/r2.ts (no @aws-sdk in this workspace).
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
const firstAttachment = (v) =>
  Array.isArray(v) && v[0] && typeof v[0].url === 'string' ? v[0] : null;
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
  return `${R2_PUBLIC_BASE}/${key}`;
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

// ---------- registry index ----------
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const cols = await client.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'creator_registry' AND column_name IN ('profile_pic_url','video_intro_url','instagram_username','normalized_instagram')",
);
const have = new Set(cols.rows.map((r) => r.column_name));
if (!have.has('profile_pic_url')) {
  console.error('creator_registry.profile_pic_url is missing; wrong database?');
  process.exit(1);
}
const HAS_VIDEO = have.has('video_intro_url');
if (!HAS_VIDEO)
  console.log('NOTE creator_registry has no video_intro_url column — video intros will be skipped');
const TARGETS = [
  { kind: 'pic', column: 'profile_pic_url', fields: PIC_FIELDS, prefix: 'profile' },
  ...(HAS_VIDEO
    ? [{ kind: 'video', column: 'video_intro_url', fields: VIDEO_FIELDS, prefix: 'intro' }]
    : []),
];

const reg = await client.query(
  `SELECT id, name, instagram_username, ${have.has('normalized_instagram') ? 'normalized_instagram' : 'NULL AS normalized_instagram'},
          profile_pic_url${HAS_VIDEO ? ', video_intro_url' : ''}
   FROM creator_registry WHERE deleted_at IS NULL`,
);
const byIg = new Map();
const byName = new Map();
for (const row of reg.rows) {
  const ig = row.normalized_instagram ?? normIg(row.instagram_username);
  if (ig && !byIg.has(ig)) byIg.set(ig, row);
  const name = normName(row.name);
  if (name && !byName.has(name)) byName.set(name, row);
}
console.log(
  `registry: ${reg.rows.length} live rows (${byIg.size} by instagram, ${byName.size} by name); targets: ${TARGETS.map((t) => t.kind).join(', ')}`,
);

const isR2 = (v) => typeof v === 'string' && v.startsWith(R2_PUBLIC_BASE);

// ---------- stream ----------
const totals = { bases: 0, records: 0, matched: 0, unmatched: 0, noAttachment: 0 };
for (const t of TARGETS) totals[t.kind] = { done: 0, skipped: 0, failed: 0 };
const failures = [];
const started = Date.now();

for (const base of bases) {
  totals.bases += 1;
  const label = base.brandLabel ?? base.baseId;
  const baseStats = { records: 0, matched: 0 };
  for (const t of TARGETS) baseStats[t.kind] = 0;
  console.log(`\n=== ${label} (${base.baseId}/${base.creatorsTableId}) ===`);
  try {
    for await (const record of listRecords(base)) {
      totals.records += 1;
      baseStats.records += 1;
      const fields = record.fields ?? {};
      const ig = normIg(pickFieldValue(fields, IG_FIELDS));
      const name = normName(pickFieldValue(fields, NAME_FIELDS));
      const row = (ig && byIg.get(ig)) || (name && byName.get(name)) || null;
      if (!row) {
        totals.unmatched += 1;
        continue;
      }
      totals.matched += 1;
      baseStats.matched += 1;

      for (const t of TARGETS) {
        const attachment = firstAttachment(pickFieldValue(fields, t.fields));
        if (!attachment) {
          totals.noAttachment += 1;
          continue;
        }
        if (isR2(row[t.column])) {
          totals[t.kind].skipped += 1;
          continue;
        }
        try {
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
          const publicUrl = await putToR2(key, body, contentType);
          await client.query(
            `UPDATE creator_registry SET ${t.column} = $1, updated_at = now(), updated_by = 'script:stream-airtable-to-r2' WHERE id = $2`,
            [publicUrl, row.id],
          );
          row[t.column] = publicUrl;
          totals[t.kind].done += 1;
          baseStats[t.kind] += 1;
          console.log(
            `  OK   ${t.kind} ${row.id} <- ${label}/${record.id} (${(body.byteLength / 1024).toFixed(0)} KB)`,
          );
        } catch (e) {
          totals[t.kind].failed += 1;
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
  } catch (e) {
    console.log(`  BASE FAIL ${label}: ${e.message}`);
    failures.push({ base: label, record: '-', registry: '-', kind: 'base', error: e.message });
  }
  console.log(
    `--- ${label}: ${baseStats.records} records, ${baseStats.matched} matched, ${TARGETS.map((t) => `${baseStats[t.kind]} ${t.kind}s uploaded`).join(', ')}`,
  );
  await sleep(300);
}

// ---------- summary + verification ----------
console.log(`\nDONE in ${((Date.now() - started) / 60_000).toFixed(1)} min`);
console.log(
  `bases ${totals.bases} · records ${totals.records} · matched ${totals.matched} · unmatched ${totals.unmatched} · no attachment ${totals.noAttachment}`,
);
for (const t of TARGETS) {
  const s = totals[t.kind];
  console.log(
    `${t.kind}s: done ${s.done} · skipped (already R2) ${s.skipped} · failed ${s.failed}`,
  );
}
if (failures.length > 0) {
  console.log(`\nfailures (${failures.length}):`);
  for (const f of failures)
    console.log(`  ${f.kind} ${f.base}/${f.record} -> ${f.registry}: ${f.error}`);
}

const verify = await client.query(
  `SELECT COUNT(*)::int AS total,
          COUNT(profile_pic_url) FILTER (WHERE profile_pic_url LIKE '%r2.dev%')::int AS pics_in_r2
          ${HAS_VIDEO ? ", COUNT(video_intro_url) FILTER (WHERE video_intro_url LIKE '%r2.dev%')::int AS videos_in_r2" : ''}
   FROM creator_registry`,
);
console.log('\nverification:');
console.table(verify.rows);
await client.end();
process.exitCode = failures.some((f) => f.kind === 'base') ? 1 : 0;
