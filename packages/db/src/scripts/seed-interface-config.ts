import { and, eq, isNull } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb, type Db } from '../db';
import { brands, interfaceTabVisibility } from '../schema';

/**
 * Seed the four shipped `interface_tab_visibility` rows for the TEMPLATE brand.
 *
 *   pnpm --filter @tas/db seed-interface-config -- --dry-run   (default)
 *   pnpm --filter @tas/db seed-interface-config -- --apply
 *
 * The seed is idempotent: `ON CONFLICT (brand_id, tab_key) DO NOTHING` means a re-run never
 * duplicates and never overwrites a row an admin has already edited. A brand the database does
 * not carry (no template brand yet, before `seed.ts` runs) is REPORTED, never fatal — this script
 * runs after the first migration and before the first team sign-in, so the one case it has to
 * handle gracefully is "no template brand exists yet".
 *
 * `brand_id = <template brand>` and NOT NULL on this table on purpose: `interface_tab_visibility`
 * carries CHILD overrides of a standard tab. The seed row IS the template default — every child
 * reads it when it has no row of its own (see `mergeTabVisibility` in `@tas/domain`). The row set:
 *
 *   concepts         sort_order = 1  is_visible = true
 *   creative_sheet   sort_order = 2  is_visible = true
 *   ugc_management   sort_order = 3  is_visible = true
 *   copywriting      sort_order = 4  is_visible = true
 */
const ACTOR = 'script:seed-interface-config';

const STANDARD_TAB_SEEDS = [
  { tabKey: 'concepts', sortOrder: 1 },
  { tabKey: 'creative_sheet', sortOrder: 2 },
  { tabKey: 'ugc_management', sortOrder: 3 },
  { tabKey: 'copywriting', sortOrder: 4 },
] as const;

export interface SeedResult {
  readonly templateBrandId: string | null;
  readonly inserted: number;
  readonly skipped: number;
}

/** The function tests mount against pglite. The script's `main` wraps it in a dry-run transaction. */
export async function seedInterfaceConfig(db: Db, actor: string = ACTOR): Promise<SeedResult> {
  const [templateBrand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.isTemplate, true), isNull(brands.deletedAt)))
    .limit(1);
  if (!templateBrand) {
    return { templateBrandId: null, inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  for (const seed of STANDARD_TAB_SEEDS) {
    const result = await db
      .insert(interfaceTabVisibility)
      .values({
        brandId: templateBrand.id,
        tabKey: seed.tabKey,
        isVisible: true,
        sortOrder: seed.sortOrder,
        createdBy: actor,
        updatedBy: actor,
      })
      .onConflictDoNothing({
        target: [interfaceTabVisibility.brandId, interfaceTabVisibility.tabKey],
      })
      .returning({ id: interfaceTabVisibility.id });
    if (result.length > 0) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }
  return { templateBrandId: templateBrand.id, inserted, skipped };
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
  let result: SeedResult = { templateBrandId: null, inserted: 0, skipped: 0 };
  try {
    try {
      await db.transaction(async (tx) => {
        result = await seedInterfaceConfig(tx);
        if (!apply) throw new DryRunRollback();
      });
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }
    if (result.templateBrandId === null) {
      console.log('  no template brand found — nothing to seed');
    } else {
      console.log(
        `  template brand ${result.templateBrandId}: inserted ${String(result.inserted)}, skipped ${String(result.skipped)}`,
      );
    }
    console.log(
      `\n${apply ? '[APPLIED]' : '[DRY RUN — ROLLED BACK]'} ${String(result.inserted)} tab-visibility rows against the template.`,
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('seed-interface-config.ts')) await main();
