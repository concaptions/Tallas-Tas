/* eslint-disable */
// Applies 0069_brief_content_fields to Railway. Four new nullable columns on creative_briefs
// (brief_text, music, voiceover_type, voiceover_script) plus the voiceover_type CHECK constraint.
// Idempotent: if the columns are already present AND the hash is already recorded, does nothing;
// if the hash is missing but the columns are present (applied by hand), records the hash only;
// otherwise runs the SQL inside a transaction and records the hash.
// From packages/db:  DATABASE_URL="postgresql://..." node apply69.mjs
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const TAG = '0069_brief_content_fields';
const COLUMNS = ['brief_text', 'music', 'voiceover_type', 'voiceover_script'];
const sql = fs.readFileSync(`drizzle/${TAG}.sql`, 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entry = journal.entries.find((e) => e.tag === TAG);
if (!entry) {
  console.error('journal entry missing');
  process.exit(1);
}

const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const presentColumns = async () =>
  (
    await c.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'creative_briefs' AND column_name = ANY($1::text[])",
      [COLUMNS],
    )
  ).rows.map((r) => r.column_name);
const voiceoverCheck = async () =>
  (
    await c.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'creative_briefs_voiceover_type_check'",
    )
  ).rowCount > 0;
try {
  const already = await c.query('SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1', [
    hash,
  ]);
  if (already.rowCount > 0) {
    console.log(`${TAG} already recorded (hash ${hash}); nothing to do`);
  } else {
    await c.query('BEGIN');
    const before = await presentColumns();
    const beforeCheck = await voiceoverCheck();
    console.log('BEFORE columns present:', before);
    console.log('BEFORE voiceover_type check present:', beforeCheck);
    if (before.length < COLUMNS.length || !beforeCheck) {
      console.log('applying SQL');
      for (const statement of sql.split('--> statement-breakpoint')) await c.query(statement);
    } else {
      console.log('already applied by hand; recording the hash only');
    }
    const after = await presentColumns();
    const afterCheck = await voiceoverCheck();
    if (after.length !== COLUMNS.length || !afterCheck) {
      throw new Error(
        `verify failed in txn: ${JSON.stringify({ columns: after, check: afterCheck })}`,
      );
    }
    await c.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [hash, entry.when.toString()],
    );
    await c.query('COMMIT');
    console.log(`${TAG} recorded. hash=`, hash);
    console.log('AFTER columns present:', after);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('FAILED, rolled back:', e.message);
  process.exitCode = 1;
}
await c.end();
