import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { sql } from 'drizzle-orm';

import { serverEnv } from '@tas/env';

import { createAutoDb, type Db } from '../db';

/**
 * Prod's DDL is AHEAD of its migration journal in places (verified 2026-09-29: `launched_at`
 * exists with no 0033 journal row), so neither a journal count nor drizzle's own migrator can
 * apply the tail cleanly. This applies every journal entry newer than the last recorded one,
 * statement by statement inside a SAVEPOINT, tolerating "already exists" (42701/42P07/42710) —
 * and then records the journal row exactly as drizzle would (sha256 of the file, the journal
 * timestamp). Runs inside the import transaction: a dry run rolls all of it back.
 */
export async function applyPendingMigrations(
  tx: Db,
  onStatement: (statement: string) => void = () => undefined,
): Promise<string[]> {
  const journal = JSON.parse(
    readFileSync(path.join('drizzle', 'meta', '_journal.json'), 'utf-8'),
  ) as { entries: { tag: string; when: number }[] };
  const latestRes = (await tx.execute(
    sql.raw(
      'SELECT coalesce(max(created_at), 0)::bigint AS latest FROM drizzle.__drizzle_migrations',
    ),
  )) as { rows?: { latest: string | number }[] };
  const latest = Number(latestRes.rows?.[0]?.latest ?? 0);
  const pending = journal.entries.filter((entry) => entry.when > latest);

  for (const entry of pending) {
    const file = readFileSync(path.join('drizzle', `${entry.tag}.sql`), 'utf-8');
    for (const statement of file.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length === 0) continue;
      onStatement(trimmed);
      try {
        await tx.transaction(async (sp) => {
          await sp.execute(sql.raw(trimmed));
        });
      } catch (e) {
        const code = (e as { cause?: { code?: string } }).cause?.code;
        if (code === '42701' || code === '42P07' || code === '42710') {
          console.log(`  [migrations] already in place, skipping: ${trimmed.slice(0, 80)}`);
          continue;
        }
        throw e;
      }
    }
    const hash = createHash('sha256').update(file).digest('hex');
    await tx.execute(
      sql.raw(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('${hash}', ${String(entry.when)})`,
      ),
    );
  }
  return pending.map((entry) => entry.tag);
}

/** Thrown after a --dry-run so the surrounding transaction rolls everything back. */
class DryRunRollback extends Error {
  constructor() {
    super('dry run: rolling back');
  }
}

/**
 * Apply the journal migrations prod is missing, inside one transaction.
 *   pnpm --filter @tas/db migrate-prod -- --dry-run   executes every statement, prints it, rolls back
 *   pnpm --filter @tas/db migrate-prod -- --apply     commits and records the journal rows
 * The importer (`airtable-import`) calls the same `applyPendingMigrations` before importing.
 */
async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = createAutoDb(databaseUrl);
  let applied: string[] = [];
  try {
    await db.transaction(async (tx) => {
      applied = await applyPendingMigrations(tx, (statement) => {
        console.log(`  ${statement.replace(/\s+/g, ' ').slice(0, 140)}`);
      });
      if (!apply) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }
  console.log(
    `\n${apply ? '[APPLIED]' : '[DRY RUN — ROLLED BACK]'} pending migrations: ${applied.length === 0 ? 'none' : applied.join(', ')}`,
  );
  await db.$client.end();
}

if (process.argv[1]?.endsWith('migrate-prod.ts')) await main();
