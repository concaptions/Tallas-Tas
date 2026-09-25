/**
 * The pure half of the Airtable → R2 attachment-URL migration (Sprint 10). The Gratsi import
 * (docs/decisions.md D-032 era) loaded attachment fields holding Airtable CDN URLs
 * (`*.airtableusercontent.com`), which expire within hours. This module decides WHICH stored URLs
 * are Airtable URLs still needing re-hosting and plans the work; the script `scripts/migrate-airtable-
 * urls.ts` does the download/upload/replace using the existing R2 helper. No side effects here, so the
 * detection and the dry-run counts are unit-tested without a database or R2.
 *
 * The five attachment fields the import populated (verified during the Gratsi load): three brief jsonb
 * arrays — `inspiration_image`, `qa_checklist_doc`, `design_file` — plus `script_and_brief_breakdown`,
 * and two creator text columns — `profile_pic_url`, `video_intro_url` — plus `raw_assets_url`.
 */

/** An Airtable-hosted attachment URL: the CDN whose links expire, so these are what we re-host. */
export function isAirtableUrl(url: string): boolean {
  return /airtable(?:usercontent)?\.com/i.test(url) || /(?:^|\/\/)dl\.airtable\.com/i.test(url);
}

/** An R2-hosted URL: already migrated, so the run skips it (idempotency). */
export function isR2Url(url: string): boolean {
  return /\.r2\.cloudflarestorage\.com\//i.test(url) || /\.r2\.dev\//i.test(url);
}

/** Replace one URL in a jsonb array, preserving order and every other entry unchanged. */
export function replaceInArray(
  values: readonly string[],
  oldUrl: string,
  newUrl: string,
): string[] {
  return values.map((value) => (value === oldUrl ? newUrl : value));
}

/** The two tables the migration touches. */
export type MigrationTable = 'creative_briefs' | 'creators';

/** One URL that needs re-hosting: enough to find it, replace it, and log it. */
export interface MigrationItem {
  readonly table: MigrationTable;
  readonly rowId: string;
  readonly field: string;
  readonly url: string;
}

/** A brief's attachment columns, as the migration reads them. */
export interface BriefAttachmentRow {
  readonly id: string;
  readonly inspirationImage: readonly string[] | null;
  readonly qaChecklistDoc: readonly string[] | null;
  readonly designFile: readonly string[] | null;
  readonly scriptAndBriefBreakdown: readonly string[] | null;
}

/** A creator's attachment columns (single-URL text). */
export interface CreatorAttachmentRow {
  readonly id: string;
  readonly profilePicUrl: string | null;
  readonly videoIntroUrl: string | null;
  readonly rawAssetsUrl: string | null;
}

const BRIEF_ARRAY_FIELDS = [
  'inspirationImage',
  'qaChecklistDoc',
  'designFile',
  'scriptAndBriefBreakdown',
] as const satisfies readonly (keyof BriefAttachmentRow)[];

const CREATOR_TEXT_FIELDS = [
  'profilePicUrl',
  'videoIntroUrl',
  'rawAssetsUrl',
] as const satisfies readonly (keyof CreatorAttachmentRow)[];

/**
 * Every Airtable URL across the given briefs and creators, one `MigrationItem` each. Non-Airtable
 * URLs — already-migrated R2 links, external links a strategist pasted — are skipped, so a re-run
 * after a partial migration finds only what is left.
 */
export function planMigration(
  briefs: readonly BriefAttachmentRow[],
  creators: readonly CreatorAttachmentRow[],
): MigrationItem[] {
  const items: MigrationItem[] = [];

  for (const brief of briefs) {
    for (const field of BRIEF_ARRAY_FIELDS) {
      for (const url of brief[field] ?? []) {
        if (isAirtableUrl(url)) {
          items.push({ table: 'creative_briefs', rowId: brief.id, field, url });
        }
      }
    }
  }

  for (const creator of creators) {
    for (const field of CREATOR_TEXT_FIELDS) {
      const url = creator[field];
      if (url !== null && isAirtableUrl(url)) {
        items.push({ table: 'creators', rowId: creator.id, field, url });
      }
    }
  }

  return items;
}

export interface MigrationSummary {
  readonly totalUrls: number;
  readonly rowsAffected: number;
  readonly byTable: Readonly<Record<MigrationTable, number>>;
  readonly byField: Readonly<Record<string, number>>;
}

/** The dry-run summary: how many URLs, in how many rows, by table and by field. */
export function summarise(items: readonly MigrationItem[]): MigrationSummary {
  const byTable: Record<MigrationTable, number> = { creative_briefs: 0, creators: 0 };
  const byField: Record<string, number> = {};
  const rows = new Set<string>();
  for (const item of items) {
    byTable[item.table] += 1;
    byField[item.field] = (byField[item.field] ?? 0) + 1;
    rows.add(`${item.table}:${item.rowId}`);
  }
  return { totalUrls: items.length, rowsAffected: rows.size, byTable, byField };
}
