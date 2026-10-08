import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { eq, TransactionRollbackError } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { insertRegistryCreator } from '../creator-registry-queries';
import { createAutoDb, type Db } from '../db';
import { isR2Available } from '../r2';
import { creatorRegistry, type RegistryBrandMembership, type RegistryCreator } from '../schema';
import { type CreatorInventory, REPO_ROOT } from './airtable-enumerate-creators';
import type { AirtableCreatorRow } from './airtable-source-bases';
import { findRegistryMatch } from './registry-match';
import { storeRegistryProfilePic } from './registry-media';

/**
 * Pulls the creators of an `airtable-enumerate-creators` inventory into the GLOBAL
 * `creator_registry` (Oct 8 Talal ask): one registry row per person, with `brands` remembering
 * every client base they were seen in. Re-running on the same inventory changes nothing.
 *
 *   pnpm --filter @tas/db import-creators-from-airtable -- --file <inventory.json>          dry run
 *   pnpm --filter @tas/db import-creators-from-airtable -- --file <inventory.json> --apply  commits
 *
 * The dry run performs the same work inside one transaction and rolls it back, so its counts are
 * exactly what `--apply` would report.
 */
const ACTOR = 'script:import-creators-from-airtable';

// Private copy of @tas/domain's normalizeIg: @tas/db must not depend on @tas/domain.
function normalizeIg(username: string | null): string | null {
  if (!username) return null;
  const cleaned = username.trim().toLowerCase().replace(/^@/, '');
  return cleaned || null;
}

export type StorePicResult = { ok: true; url: string } | { ok: false; error: string };
export type StorePic = (registryId: string, url: string) => Promise<StorePicResult>;

export interface ImportOptions {
  readonly apply: boolean;
  readonly now: Date;
  readonly storePic: StorePic;
}

export interface ImportCounts {
  matchedByInstagram: number;
  matchedByName: number;
  inserted: number;
  brandsAppended: number;
  totalBrandsIncremented: number;
  picsStored: number;
  picsPending: number;
  skipped: number;
}

export interface ImportSummary extends ImportCounts {
  errors: string[];
}

const COUNT_KEYS = [
  'matchedByInstagram',
  'matchedByName',
  'inserted',
  'brandsAppended',
  'totalBrandsIncremented',
  'picsStored',
  'picsPending',
  'skipped',
] as const satisfies readonly (keyof ImportCounts)[];

const zeroCounts = (): ImportCounts => ({
  matchedByInstagram: 0,
  matchedByName: 0,
  inserted: 0,
  brandsAppended: 0,
  totalBrandsIncremented: 0,
  picsStored: 0,
  picsPending: 0,
  skipped: 0,
});

/**
 * Drizzle wraps a driver error as "Failed query: <sql> params: <values>"; the Postgres reason is on
 * `cause`, and it is the only part worth putting in a report (the params would echo creator data).
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? error.cause.message : error.message;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (candidate: unknown): string | undefined =>
    typeof candidate === 'object' && candidate !== null && 'code' in candidate
      ? String(candidate.code)
      : undefined;
  return code(error) === '23505' || code((error as { cause?: unknown }).cause) === '23505';
}

async function storePicOrPend(
  options: ImportOptions,
  summary: ImportCounts,
  registryId: string,
  sourceUrl: string,
): Promise<string | null> {
  const stored = await options.storePic(registryId, sourceUrl);
  if (stored.ok) {
    summary.picsStored += 1;
    return stored.url;
  }
  summary.picsPending += 1;
  return null;
}

/** Apply one inventory row to an existing registry row; only writes when something changed. */
async function applyMatch(
  db: Db,
  row: AirtableCreatorRow,
  match: RegistryCreator,
  options: ImportOptions,
  summary: ImportCounts,
  matchedByInstagram: boolean,
): Promise<void> {
  const patch: Partial<typeof creatorRegistry.$inferInsert> = {};
  if (!match.brands.some((b) => b.sourceAirtableBaseId === row.baseId)) {
    patch.brands = [...match.brands, membership(row, options.now)];
    patch.totalBrands = match.totalBrands + 1;
    summary.brandsAppended += 1;
    summary.totalBrandsIncremented += 1;
  }
  if (match.profilePicUrl === null && row.profilePicUrl !== null) {
    const url = await storePicOrPend(options, summary, match.id, row.profilePicUrl);
    if (url !== null) patch.profilePicUrl = url;
  }
  if (matchedByInstagram && match.instagramUsername === null && row.instagramUsername !== null) {
    patch.instagramUsername = row.instagramUsername;
  }
  if (Object.keys(patch).length === 0) {
    summary.skipped += 1;
    return;
  }
  await db
    .update(creatorRegistry)
    .set({ ...patch, updatedBy: ACTOR, updatedAt: options.now })
    .where(eq(creatorRegistry.id, match.id));
}

function membership(row: AirtableCreatorRow, now: Date): RegistryBrandMembership {
  return {
    brandLabel: row.brandLabel,
    sourceAirtableBaseId: row.baseId,
    firstSeenAt: now.toISOString(),
  };
}

/** One row's counts, merged into the summary only once the row's transaction has committed. */
async function importRow(
  db: Db,
  row: AirtableCreatorRow,
  options: ImportOptions,
): Promise<ImportCounts> {
  const summary = zeroCounts();
  const key = { normalizedInstagram: normalizeIg(row.instagramUsername), name: row.name };
  const strict = { nameMatchRequiresBrands: true };
  let match = await findRegistryMatch(db, key, strict);

  if (match.by === 'none') {
    try {
      // A savepoint, so a unique violation does not abort the enclosing (dry-run) transaction.
      const created = await db.transaction((tx) =>
        insertRegistryCreator(tx, {
          name: row.name,
          instagramUsername: row.instagramUsername,
          normalizedInstagram: key.normalizedInstagram,
          totalBrands: 1,
          brands: [membership(row, options.now)],
          legacyAirtableId: row.airtableId,
        }),
      );
      summary.inserted += 1;
      // `insertRegistryCreator` owns the managed columns, so the actor (and the re-hosted pic,
      // which needs the new id) land in one follow-up write.
      const profilePicUrl =
        row.profilePicUrl === null
          ? null
          : await storePicOrPend(options, summary, created.id, row.profilePicUrl);
      await db
        .update(creatorRegistry)
        .set({ profilePicUrl, createdBy: ACTOR, updatedBy: ACTOR, updatedAt: options.now })
        .where(eq(creatorRegistry.id, created.id));
      return summary;
    } catch (error) {
      // Two inventory rows carry the same handle: the first insert won, so this one is a match.
      if (!isUniqueViolation(error)) throw error;
      match = await findRegistryMatch(db, key, strict);
      if (match.by === 'none') throw error;
    }
  }

  if (match.by === 'instagram') summary.matchedByInstagram += 1;
  else summary.matchedByName += 1;
  await applyMatch(db, row, match.row, options, summary, match.by === 'instagram');
  return summary;
}

export async function importInventory(
  db: Db,
  creators: readonly AirtableCreatorRow[],
  options: ImportOptions,
): Promise<ImportSummary> {
  const summary: ImportSummary = { ...zeroCounts(), errors: [] };
  const run = async (handle: Db): Promise<void> => {
    for (const row of creators) {
      try {
        // Each row in its own (sub)transaction so a failed row never poisons the next one.
        const delta = await handle.transaction((tx) => importRow(tx, row, options));
        for (const key of COUNT_KEYS) summary[key] += delta[key];
      } catch (error) {
        summary.errors.push(
          `${row.airtableId} ${row.name} [${row.brandLabel}]: ${describeError(error)}`,
        );
      }
    }
  };
  if (options.apply) {
    await run(db);
    return summary;
  }
  try {
    await db.transaction(async (tx) => {
      await run(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
  return summary;
}

export function formatReport(
  summary: ImportSummary,
  file: string,
  now: Date,
  apply: boolean,
): string {
  const lines = [
    `# Airtable creator import — ${now.toISOString()}`,
    '',
    `Inventory: \`${file}\` · mode: ${apply ? 'APPLIED' : 'DRY RUN (nothing written)'}`,
    '',
    `| metric | count |`,
    `| --- | --- |`,
    `| matched by Instagram | ${String(summary.matchedByInstagram)} |`,
    `| matched by name | ${String(summary.matchedByName)} |`,
    `| inserted | ${String(summary.inserted)} |`,
    `| brands appended | ${String(summary.brandsAppended)} |`,
    `| total_brands incremented | ${String(summary.totalBrandsIncremented)} |`,
    `| pics stored | ${String(summary.picsStored)} |`,
    `| pics pending (no R2 / failed) | ${String(summary.picsPending)} |`,
    `| skipped (already up to date) | ${String(summary.skipped)} |`,
    `| errors | ${String(summary.errors.length)} |`,
  ];
  if (summary.errors.length > 0)
    lines.push('', '## Errors', '', ...summary.errors.map((e) => `- ${e}`));
  return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const fileIndex = argv.indexOf('--file');
  const file = fileIndex === -1 ? undefined : argv[fileIndex + 1];
  if (file === undefined) {
    throw new Error('Usage: import-creators-from-airtable -- --file <inventory.json> [--apply]');
  }
  const apply = argv.includes('--apply');
  const env = serverEnv();
  if (env.DATABASE_URL === undefined) throw new Error('DATABASE_URL is required');

  const inventory = JSON.parse(await readFile(resolve(file), 'utf8')) as CreatorInventory;
  if (!Array.isArray(inventory.creators))
    throw new Error(`${file} is not an inventory (no creators array)`);
  console.log(
    `${String(inventory.creators.length)} creator(s) in ${file} (generated ${inventory.generatedAt})`,
  );

  const r2 = isR2Available();
  if (!r2) console.warn('R2 is not configured: profile pictures are left pending.');
  const storePic: StorePic =
    apply && r2
      ? storeRegistryProfilePic
      : // A dry run predicts the outcome without uploading anything.
        (_id, url) =>
          Promise.resolve(r2 ? { ok: true, url } : { ok: false, error: 'R2 not configured' });

  const now = new Date();
  const db = createAutoDb(env.DATABASE_URL);
  try {
    const summary = await importInventory(db, inventory.creators, { apply, now, storePic });
    const report = formatReport(summary, file, now, apply);
    console.log(`\n${report}`);
    if (apply) {
      const reportPath = join(REPO_ROOT, '.audit-oct8', 'airtable-import-report.md');
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, report);
      console.log(`Report written to ${reportPath}`);
    } else {
      console.log('[DRY RUN — NOTHING WRITTEN] re-run with --apply to commit.');
    }
    if (summary.errors.length > 0) process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('import-creators-from-airtable.ts')) await main();
