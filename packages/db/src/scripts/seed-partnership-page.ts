import { and, eq, isNull } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb, type Db } from '../db';
import { insertCustomPage, upsertBrandCustomPageFromTemplate } from '../custom-interface-pages';
import { brands, customInterfacePages } from '../schema';

/**
 * Seed the first MODULE page (Scope A, ticket B5): Partnership Ads Tracking, PRD §5.8.1, as one
 * TEMPLATE row of `custom_interface_pages` every brand can switch on, hidden by default, and
 * switched on for GRATSI only — the one client running partnership ads today.
 *
 *   pnpm --filter @tas/db seed-partnership-page -- --dry-run   (default)
 *   pnpm --filter @tas/db seed-partnership-page -- --apply
 *
 * The page draws from `creators` with the preset filter `for_partnership_ads = true` and the
 * §5.8.1 columns in order — WITHOUT `partnership_price_per_30_days`: a partnership price never
 * reaches a client (non-negotiable 10; `clientVisibleColumns` would drop it anyway). The portal
 * renders it through the custom-page route like any non-standard row; the nav shows it where the
 * brand's row says. Idempotent: a template row with the slug is left alone, Gratsi's row is
 * upserted to visible. A database without Gratsi reports it and seeds the template row only.
 */
export const PARTNERSHIP_PAGE_SLUG = 'partnership-ads';
export const PARTNERSHIP_MODULE_KEY = 'partnership_ads';
const ACTOR = 'script:seed-partnership-page';
const GRATSI_SLUG = 'gratsi';

/** PRD §5.8.1, in the order the client list reads them; the price is deliberately absent. */
export const PARTNERSHIP_COLUMNS = [
  ['name', 'Creator name'],
  ['instagram_username', 'Instagram username'],
  ['partnership_activity', 'Partnership activity'],
  ['partnership_activated_at', 'Date of activation'],
  ['partnership_period_days', 'Period (days)'],
  ['continue_working_with', 'Continue working with?'],
  ['extension_days', 'Extension (days)'],
  ['partnership_notes', 'Notes'],
  ['facebook_profile_url', 'Facebook profile'],
] as const;

export interface PartnershipSeedResult {
  readonly templatePageId: string;
  readonly templateInserted: boolean;
  readonly gratsiBrandId: string | null;
  readonly gratsiEnabled: boolean;
}

export async function seedPartnershipPage(
  db: Db,
  actor: string = ACTOR,
): Promise<PartnershipSeedResult> {
  const [existing] = await db
    .select()
    .from(customInterfacePages)
    .where(
      and(
        isNull(customInterfacePages.brandId),
        eq(customInterfacePages.slug, PARTNERSHIP_PAGE_SLUG),
        isNull(customInterfacePages.deletedAt),
      ),
    )
    .limit(1);
  const template =
    existing ??
    (await insertCustomPage(db, {
      brandId: null,
      slug: PARTNERSHIP_PAGE_SLUG,
      title: 'Partnership Ads Tracking',
      sourceTableKey: 'creators',
      filterConfig: { column: 'for_partnership_ads', op: 'is', value: 'true' },
      columnConfig: PARTNERSHIP_COLUMNS.map(([columnKey, displayLabel], displayOrder) => ({
        columnKey,
        displayLabel,
        displayOrder,
      })),
      sortOrder: 20,
      isVisible: false,
      isInherited: true,
      pageKind: 'module',
      moduleKey: PARTNERSHIP_MODULE_KEY,
      createdBy: actor,
      updatedBy: actor,
    }));

  const [gratsi] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.slug, GRATSI_SLUG), isNull(brands.deletedAt)))
    .limit(1);
  if (gratsi === undefined) {
    return {
      templatePageId: template.id,
      templateInserted: existing === undefined,
      gratsiBrandId: null,
      gratsiEnabled: false,
    };
  }
  await upsertBrandCustomPageFromTemplate(db, gratsi.id, template, { isVisible: true }, actor, [
    'is_visible',
  ]);
  return {
    templatePageId: template.id,
    templateInserted: existing === undefined,
    gratsiBrandId: gratsi.id,
    gratsiEnabled: true,
  };
}

class DryRunRollback extends Error {
  constructor() {
    super('dry run: rolling back');
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = createAutoDb(databaseUrl);
  let result: PartnershipSeedResult | null = null;
  try {
    try {
      await db.transaction(async (tx) => {
        result = await seedPartnershipPage(tx);
        if (!apply) throw new DryRunRollback();
      });
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n${apply ? '[APPLIED]' : '[DRY RUN — ROLLED BACK]'}`);
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('seed-partnership-page.ts')) await main();
