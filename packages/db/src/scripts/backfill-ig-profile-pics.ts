import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb, type Db } from '../db';
import { isR2Available } from '../r2';
import { creatorRegistry } from '../schema';
import { storeRegistryProfilePic } from './registry-media';

/**
 * Oct 8 (Talal): 57 of 66 registry rows show initials because `profile_pic_url` is null. For the
 * rows that carry an Instagram handle, fetch the public avatar through unavatar.io (never Instagram
 * itself), re-host it in R2 under `creator-registry/` and store the R2 url.
 *
 *   pnpm --filter @tas/db backfill-ig-profile-pics            dry run: counts candidates, writes nothing
 *   pnpm --filter @tas/db backfill-ig-profile-pics -- --apply  resolves, uploads and writes (needs R2)
 *
 * Idempotent: only live rows with a handle and NO picture are candidates, so a second run finds
 * nothing to do. Fault-tolerant: a row whose avatar cannot be resolved (unavatar answers 404 when
 * `fallback=false` and it finds nothing) is logged, listed in the report and skipped; the run goes
 * on. Rate-limited to 5 requests per second. Both modes write a report to
 * `.audit-oct8/ig-backfill-report.md` at the repo root because the human needs the candidate count
 * before deciding to apply.
 */
export const ACTOR = 'script:backfill-ig-profile-pics';
/** unavatar.io is a shared public service: never more than 5 requests per second. */
export const MIN_GAP_MS = 200;

export const IG_REPORT_PATH = fileURLToPath(
  new URL('../../../../.audit-oct8/ig-backfill-report.md', import.meta.url),
);

/** `fallback=false` makes unavatar answer 404 instead of a placeholder when no avatar exists. */
export function igAvatarUrl(handle: string): string {
  return `https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`;
}

export type StorePicResult =
  { readonly ok: true; readonly url: string } | { readonly ok: false; readonly error: string };

export type StorePic = (registryId: string, sourceUrl: string) => Promise<StorePicResult>;

export interface IgBackfillOptions {
  /** false = dry run: count candidates, call nothing, write nothing. */
  readonly apply: boolean;
  /** Stamped into `updated_at` on every row written. */
  readonly now: Date;
  /** Re-hosts one avatar; `main` injects `storeRegistryProfilePic`, tests inject a fake. */
  readonly store: StorePic;
  /** Rate-limit hook, called with `MIN_GAP_MS` between rows; tests inject a fake. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface IgBackfillFailure {
  readonly id: string;
  readonly handle: string;
  readonly error: string;
}

export interface IgBackfillSummary {
  /** Live rows with a handle and no picture. */
  readonly candidates: number;
  /** Rows whose avatar was re-hosted and written (apply only). */
  readonly stored: number;
  /** Rows whose avatar could not be resolved or uploaded (apply only); see `failures`. */
  readonly failed: number;
  /** Candidates left untouched because this was a dry run. */
  readonly skipped: number;
  readonly failures: readonly IgBackfillFailure[];
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function runIgBackfill(
  db: Db,
  options: IgBackfillOptions,
): Promise<IgBackfillSummary> {
  const sleep = options.sleep ?? defaultSleep;
  const rows = await db
    .select({ id: creatorRegistry.id, handle: creatorRegistry.normalizedInstagram })
    .from(creatorRegistry)
    .where(
      and(
        isNull(creatorRegistry.deletedAt),
        isNotNull(creatorRegistry.normalizedInstagram),
        isNull(creatorRegistry.profilePicUrl),
      ),
    )
    .orderBy(creatorRegistry.createdAt, creatorRegistry.id);

  let stored = 0;
  const failures: IgBackfillFailure[] = [];

  for (const [index, row] of rows.entries()) {
    // The query filters on NOT NULL; the guard only narrows the type for the compiler.
    const handle = row.handle ?? '';
    if (index > 0) await sleep(MIN_GAP_MS);
    if (!options.apply) {
      console.log(`  WOULD ${row.id} @${handle} <- ${igAvatarUrl(handle)}`);
      continue;
    }
    const result = await options.store(row.id, igAvatarUrl(handle));
    if (!result.ok) {
      console.log(`  FAIL ${row.id} @${handle}: ${result.error}`);
      failures.push({ id: row.id, handle, error: result.error });
      continue;
    }
    await db
      .update(creatorRegistry)
      .set({ profilePicUrl: result.url, updatedBy: ACTOR, updatedAt: options.now })
      .where(eq(creatorRegistry.id, row.id));
    console.log(`  OK   ${row.id} @${handle} -> ${result.url}`);
    stored += 1;
  }

  return {
    candidates: rows.length,
    stored,
    failed: failures.length,
    skipped: options.apply ? 0 : rows.length,
    failures,
  };
}

export interface ReportMeta {
  readonly apply: boolean;
  readonly startedAt: Date;
  readonly finishedAt: Date;
}

/** Markdown for the human who runs this: counts plus a failures table, nothing else about anyone. */
export function renderIgReport(summary: IgBackfillSummary, meta: ReportMeta): string {
  const lines = [
    `# Instagram profile-picture backfill — ${meta.apply ? 'APPLIED' : 'DRY RUN'}`,
    '',
    `- Started: ${meta.startedAt.toISOString()}`,
    `- Finished: ${meta.finishedAt.toISOString()}`,
    `- Mode: ${meta.apply ? '--apply (R2 uploads, rows written)' : 'dry run (nothing resolved, nothing written)'}`,
    `- Avatar source: unavatar.io (fallback=false), max ${String(1000 / MIN_GAP_MS)} req/s`,
    '',
    '| Candidates | Stored | Failed | Skipped |',
    '| --- | --- | --- | --- |',
    `| ${String(summary.candidates)} | ${String(summary.stored)} | ${String(summary.failed)} | ${String(summary.skipped)} |`,
    '',
    '## Failures',
    '',
  ];
  if (summary.failures.length === 0) {
    lines.push('None.');
  } else {
    lines.push('| Registry id | Handle | Error |', '| --- | --- | --- |');
    for (const failure of summary.failures) {
      lines.push(`| ${failure.id} | @${failure.handle} | ${failure.error.replace(/\|/g, '\\|')} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const env = serverEnv();
  if (env.DATABASE_URL === undefined) throw new Error('DATABASE_URL is required');
  if (apply && !isR2Available()) {
    console.error(
      '--apply needs R2 credentials (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / …). None are set.',
    );
    process.exit(1);
  }

  const startedAt = new Date();
  console.log(`\nInstagram profile-picture backfill — ${apply ? 'APPLY' : 'DRY RUN'}`);
  const db = createAutoDb(env.DATABASE_URL);
  try {
    const summary = await runIgBackfill(db, {
      apply,
      now: startedAt,
      store: storeRegistryProfilePic,
    });
    const finishedAt = new Date();
    mkdirSync(dirname(IG_REPORT_PATH), { recursive: true });
    writeFileSync(IG_REPORT_PATH, renderIgReport(summary, { apply, startedAt, finishedAt }));
    console.log(
      `\n${apply ? '[APPLIED]' : '[DRY RUN — NOTHING WRITTEN]'} ${String(summary.candidates)} candidate(s), ${String(summary.stored)} stored, ${String(summary.failed)} failed. Report: ${IG_REPORT_PATH}`,
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('backfill-ig-profile-pics.ts')) await main();
