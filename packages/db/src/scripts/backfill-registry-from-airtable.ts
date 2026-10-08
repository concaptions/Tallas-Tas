import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb, type Db } from '../db';
import { isR2Available } from '../r2';
import { creatorRegistry } from '../schema';
import type { AirtableCreatorRow } from './airtable-source-bases';
import { findRegistryMatch } from './registry-match';
import { storeRegistryProfilePic } from './registry-media';

/**
 * Oct 8 (Talal): fill a registry creator's missing profile picture from the SAME person's row in
 * one of the other client Airtable bases. Input is the inventory JSON `airtable-enumerate-creators`
 * writes (`{ generatedAt, bases, creators: AirtableCreatorRow[] }`); this script never calls Airtable.
 *
 *   pnpm --filter @tas/db backfill-registry-from-airtable -- --file inventory.json            dry run
 *   pnpm --filter @tas/db backfill-registry-from-airtable -- --file inventory.json --apply    writes
 *
 * Matching is `findRegistryMatch` (Instagram handle, then case-insensitive name). An unmatched row
 * is counted and skipped: creating registry rows belongs to the import script. A matched row that
 * already has a picture is skipped (idempotent). The stored value is always the R2 url, never the
 * Airtable CDN url (those expire). One row's failure never stops the loop. Both modes write
 * `.audit-oct8/airtable-pic-backfill-report.md` at the repo root.
 */
export const ACTOR = 'script:backfill-registry-from-airtable';

export const AIRTABLE_PIC_REPORT_PATH = fileURLToPath(
  new URL('../../../../.audit-oct8/airtable-pic-backfill-report.md', import.meta.url),
);

// Private copy of @tas/domain's normalizeIg: @tas/db must not depend on @tas/domain.
function normalizeIg(username: string | null): string | null {
  if (!username) return null;
  const cleaned = username.trim().toLowerCase().replace(/^@/, '');
  return cleaned || null;
}

export type StorePicResult =
  { readonly ok: true; readonly url: string } | { readonly ok: false; readonly error: string };

export type StorePic = (registryId: string, sourceUrl: string) => Promise<StorePicResult>;

export interface AirtablePicBackfillOptions {
  /** false = dry run: match and count, call nothing, write nothing. */
  readonly apply: boolean;
  /** Stamped into `updated_at` on every row written. */
  readonly now: Date;
  /** Re-hosts one photo; `main` injects `storeRegistryProfilePic`, tests inject a fake. */
  readonly store: StorePic;
}

export interface AirtablePicBackfillFailure {
  readonly airtableId: string;
  readonly error: string;
}

export interface AirtablePicBackfillSummary {
  /** Inventory rows that carry a profile photo. */
  readonly considered: number;
  /** Considered rows that matched a live registry row. */
  readonly matched: number;
  /** Matched rows whose photo was re-hosted and written (apply only). */
  readonly stored: number;
  /** Matched rows skipped because the registry already has a picture. */
  readonly alreadyHadPic: number;
  /** Considered rows with no registry match; left for the import script. */
  readonly unmatched: number;
  /** Rows whose photo could not be re-hosted (apply only); see `failures`. */
  readonly failed: number;
  readonly failures: readonly AirtablePicBackfillFailure[];
}

export async function runAirtablePicBackfill(
  db: Db,
  creators: readonly AirtableCreatorRow[],
  options: AirtablePicBackfillOptions,
): Promise<AirtablePicBackfillSummary> {
  let considered = 0;
  let matched = 0;
  let stored = 0;
  let alreadyHadPic = 0;
  let unmatched = 0;
  const failures: AirtablePicBackfillFailure[] = [];

  for (const row of creators) {
    if (row.profilePicUrl === null) continue;
    considered += 1;
    const match = await findRegistryMatch(
      db,
      { normalizedInstagram: normalizeIg(row.instagramUsername), name: row.name },
      { nameMatchRequiresBrands: false },
    );
    if (match.by === 'none') {
      console.log(`  NONE ${row.airtableId} (${row.brandLabel}): no registry match`);
      unmatched += 1;
      continue;
    }
    matched += 1;
    if (match.row.profilePicUrl !== null) {
      console.log(`  SKIP ${row.airtableId} -> ${match.row.id}: already has a picture`);
      alreadyHadPic += 1;
      continue;
    }
    if (!options.apply) {
      console.log(`  WOULD ${row.airtableId} -> ${match.row.id} (by ${match.by})`);
      continue;
    }
    const result = await options.store(match.row.id, row.profilePicUrl);
    if (!result.ok) {
      console.log(`  FAIL ${row.airtableId} -> ${match.row.id}: ${result.error}`);
      failures.push({ airtableId: row.airtableId, error: result.error });
      continue;
    }
    await db
      .update(creatorRegistry)
      .set({ profilePicUrl: result.url, updatedBy: ACTOR, updatedAt: options.now })
      .where(eq(creatorRegistry.id, match.row.id));
    console.log(`  OK   ${row.airtableId} -> ${match.row.id} (by ${match.by}): ${result.url}`);
    stored += 1;
  }

  return {
    considered,
    matched,
    stored,
    alreadyHadPic,
    unmatched,
    failed: failures.length,
    failures,
  };
}

export interface ReportMeta {
  readonly apply: boolean;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly inventoryFile: string;
}

/** Markdown for the human who runs this: counts plus a failures table, nothing else about anyone. */
export function renderAirtablePicReport(
  summary: AirtablePicBackfillSummary,
  meta: ReportMeta,
): string {
  const lines = [
    `# Airtable profile-picture backfill — ${meta.apply ? 'APPLIED' : 'DRY RUN'}`,
    '',
    `- Started: ${meta.startedAt.toISOString()}`,
    `- Finished: ${meta.finishedAt.toISOString()}`,
    `- Mode: ${meta.apply ? '--apply (R2 uploads, rows written)' : 'dry run (nothing uploaded, nothing written)'}`,
    `- Inventory: ${meta.inventoryFile}`,
    '',
    '| Considered | Matched | Stored | Already had pic | Unmatched | Failed |',
    '| --- | --- | --- | --- | --- | --- |',
    `| ${String(summary.considered)} | ${String(summary.matched)} | ${String(summary.stored)} | ${String(summary.alreadyHadPic)} | ${String(summary.unmatched)} | ${String(summary.failed)} |`,
    '',
    '## Failures',
    '',
  ];
  if (summary.failures.length === 0) {
    lines.push('None.');
  } else {
    lines.push('| Airtable record | Error |', '| --- | --- |');
    for (const failure of summary.failures) {
      lines.push(`| ${failure.airtableId} | ${failure.error.replace(/\|/g, '\\|')} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

interface Inventory {
  readonly generatedAt: string;
  readonly creators: readonly AirtableCreatorRow[];
}

/** The inventory file as `airtable-enumerate-creators` writes it; anything else is rejected. */
export function parseInventory(raw: string): Inventory {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('inventory must be an object');
  const record = parsed as Record<string, unknown>;
  if (typeof record['generatedAt'] !== 'string') throw new Error('inventory.generatedAt missing');
  if (!Array.isArray(record['creators'])) throw new Error('inventory.creators must be an array');
  const creators = record['creators'].map((entry: unknown, index): AirtableCreatorRow => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`inventory.creators[${String(index)}] must be an object`);
    }
    const row = entry as Record<string, unknown>;
    const text = (key: string): string => {
      const value = row[key];
      if (typeof value !== 'string')
        throw new Error(`inventory.creators[${String(index)}].${key} missing`);
      return value;
    };
    const nullableText = (key: string): string | null => {
      const value = row[key];
      return typeof value === 'string' && value !== '' ? value : null;
    };
    return {
      airtableId: text('airtableId'),
      baseId: text('baseId'),
      brandLabel: text('brandLabel'),
      name: text('name'),
      instagramUsername: nullableText('instagramUsername'),
      profilePicUrl: nullableText('profilePicUrl'),
    };
  });
  return { generatedAt: record['generatedAt'], creators };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const fileIndex = process.argv.indexOf('--file');
  const fileArg = fileIndex === -1 ? undefined : process.argv[fileIndex + 1];
  if (fileArg === undefined || fileArg.startsWith('--')) {
    console.error('Usage: backfill-registry-from-airtable --file <inventory.json> [--apply]');
    process.exit(1);
  }
  const env = serverEnv();
  if (env.DATABASE_URL === undefined) throw new Error('DATABASE_URL is required');
  if (apply && !isR2Available()) {
    console.error(
      '--apply needs R2 credentials (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / …). None are set.',
    );
    process.exit(1);
  }

  const inventoryFile = resolve(fileArg);
  const inventory = parseInventory(readFileSync(inventoryFile, 'utf8'));
  const startedAt = new Date();
  console.log(
    `\nAirtable profile-picture backfill — ${apply ? 'APPLY' : 'DRY RUN'}: ${String(inventory.creators.length)} inventory row(s) generated ${inventory.generatedAt}`,
  );
  const db = createAutoDb(env.DATABASE_URL);
  try {
    const summary = await runAirtablePicBackfill(db, inventory.creators, {
      apply,
      now: startedAt,
      store: storeRegistryProfilePic,
    });
    const finishedAt = new Date();
    mkdirSync(dirname(AIRTABLE_PIC_REPORT_PATH), { recursive: true });
    writeFileSync(
      AIRTABLE_PIC_REPORT_PATH,
      renderAirtablePicReport(summary, { apply, startedAt, finishedAt, inventoryFile }),
    );
    console.log(
      `\n${apply ? '[APPLIED]' : '[DRY RUN — NOTHING WRITTEN]'} ${String(summary.considered)} considered, ${String(summary.matched)} matched, ${String(summary.stored)} stored, ${String(summary.alreadyHadPic)} already had a picture, ${String(summary.unmatched)} unmatched, ${String(summary.failed)} failed. Report: ${AIRTABLE_PIC_REPORT_PATH}`,
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('backfill-registry-from-airtable.ts')) await main();
