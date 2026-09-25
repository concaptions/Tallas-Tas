import { randomUUID } from 'node:crypto';

import { eq, isNull } from 'drizzle-orm';

import { serverEnv } from '@tas/env';

import { createAutoDb } from '../db';
import { downloadFromUrl, isR2Available, uploadToR2 } from '../r2';
import { creativeBriefs, creators } from '../schema';
import {
  isAirtableUrl,
  planMigration,
  summarise,
  type BriefAttachmentRow,
  type CreatorAttachmentRow,
} from '../url-migration';

/**
 * Sprint 10: re-host expiring Airtable CDN attachment URLs to R2 (see `../url-migration.ts` for the
 * field list and the detection rules). Two modes:
 *   --dry-run   count the Airtable URLs still present, print a summary, write nothing (needs no R2)
 *   --live      download each from Airtable, upload to R2, and rewrite the stored URL (needs R2 creds)
 *
 * Idempotent (already-R2 URLs are skipped) and fault-tolerant (a file that will not download — an
 * expired link — is logged and skipped; the run continues). It does NOT run against prod here: no R2
 * credentials exist in this environment, so `--live` refuses up front. Run with:
 *   pnpm --filter @tas/db migrate-urls -- --dry-run
 */

/** Re-host one URL: download from Airtable, upload to R2, return the new URL — or null on failure. */
async function rehost(url: string, rowId: string, field: string): Promise<string | null> {
  const downloaded = await downloadFromUrl(url);
  if (!downloaded.ok) {
    console.log(`  SKIP ${field} of ${rowId}: could not download (${downloaded.error}) — ${url}`);
    return null;
  }
  const key = `migrated/${rowId}/${field}-${randomUUID()}`;
  const uploaded = await uploadToR2(key, downloaded.body, downloaded.contentType);
  if (!uploaded.ok) {
    console.log(`  SKIP ${field} of ${rowId}: R2 upload failed (${uploaded.error}) — ${url}`);
    return null;
  }
  console.log(`  OK   ${field} of ${rowId}: ${url} -> ${uploaded.url}`);
  return uploaded.url;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const live = process.argv.includes('--live');
  if (dryRun === live) {
    console.error('Usage: migrate-urls --dry-run | --live');
    process.exit(1);
  }

  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required.');
  }
  if (live && !isR2Available()) {
    console.error(
      '--live needs R2 credentials (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / …). None are set.',
    );
    process.exit(1);
  }

  const db = createAutoDb(databaseUrl);
  try {
    const briefRows: BriefAttachmentRow[] = await db
      .select({
        id: creativeBriefs.id,
        inspirationImage: creativeBriefs.inspirationImage,
        qaChecklistDoc: creativeBriefs.qaChecklistDoc,
        designFile: creativeBriefs.designFile,
        scriptAndBriefBreakdown: creativeBriefs.scriptAndBriefBreakdown,
      })
      .from(creativeBriefs)
      .where(isNull(creativeBriefs.deletedAt));

    const creatorRows: CreatorAttachmentRow[] = await db
      .select({
        id: creators.id,
        profilePicUrl: creators.profilePicUrl,
        videoIntroUrl: creators.videoIntroUrl,
        rawAssetsUrl: creators.rawAssetsUrl,
      })
      .from(creators)
      .where(isNull(creators.deletedAt));

    const items = planMigration(briefRows, creatorRows);
    const summary = summarise(items);

    console.log(`\nAirtable URL migration — ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(
      `  ${String(summary.totalUrls)} Airtable URLs in ${String(summary.rowsAffected)} rows`,
    );
    console.log(`  by table: ${JSON.stringify(summary.byTable)}`);
    console.log(`  by field: ${JSON.stringify(summary.byField)}`);

    if (dryRun) {
      console.log('\nDry run — nothing written.');
      return;
    }

    let rehosted = 0;
    let skipped = 0;

    const briefFields = [
      'inspirationImage',
      'qaChecklistDoc',
      'designFile',
      'scriptAndBriefBreakdown',
    ] as const;
    for (const brief of briefRows) {
      const updates: Partial<Record<(typeof briefFields)[number], string[]>> = {};
      for (const field of briefFields) {
        const values = brief[field];
        if (values === null || !values.some(isAirtableUrl)) continue;
        const next: string[] = [];
        let changed = false;
        for (const url of values) {
          if (!isAirtableUrl(url)) {
            next.push(url);
            continue;
          }
          const newUrl = await rehost(url, brief.id, field);
          if (newUrl === null) {
            next.push(url);
            skipped += 1;
          } else {
            next.push(newUrl);
            changed = true;
            rehosted += 1;
          }
        }
        if (changed) updates[field] = next;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(creativeBriefs).set(updates).where(eq(creativeBriefs.id, brief.id));
      }
    }

    const creatorFields = ['profilePicUrl', 'videoIntroUrl', 'rawAssetsUrl'] as const;
    for (const creator of creatorRows) {
      const updates: Partial<Record<(typeof creatorFields)[number], string>> = {};
      for (const field of creatorFields) {
        const url = creator[field];
        if (url === null || !isAirtableUrl(url)) continue;
        const newUrl = await rehost(url, creator.id, field);
        if (newUrl === null) {
          skipped += 1;
        } else {
          updates[field] = newUrl;
          rehosted += 1;
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(creators).set(updates).where(eq(creators.id, creator.id));
      }
    }

    console.log(`\nDone: ${String(rehosted)} re-hosted, ${String(skipped)} skipped.`);
  } finally {
    await db.$client.end();
  }
}

await main();
