import { and, eq, isNull } from 'drizzle-orm';
import { serverEnv } from '@tas/env';

import { createAutoDb, type Db } from '../db';
import { brands, customInterfacePages, interfaceTabVisibility } from '../schema';

/**
 * Seed the four shipped `interface_tab_visibility` rows for the TEMPLATE brand AND the two
 * default custom pages that mirror the shipped internal / client queues.
 *
 *   pnpm --filter @tas/db seed-interface-config -- --dry-run   (default)
 *   pnpm --filter @tas/db seed-interface-config -- --apply
 *
 * The seed is idempotent: `ON CONFLICT ... DO NOTHING` for every row. A re-run never duplicates
 * and never overwrites an admin's edits. A brand the database does not carry (no template brand
 * yet, before `seed.ts` runs) is REPORTED, never fatal.
 *
 * `brand_id = <template brand>` and NOT NULL on `interface_tab_visibility` on purpose:
 * `interface_tab_visibility` carries CHILD overrides of a standard tab. The seed row IS the
 * template default — every child reads it when it has no row of its own (see
 * `mergeTabVisibility` in `@tas/domain`). The row set:
 *
 *   concepts         sort_order = 1  is_visible = true
 *   creative_sheet   sort_order = 2  is_visible = true
 *   ugc_management   sort_order = 3  is_visible = true
 *   copywriting      sort_order = 4  is_visible = true
 *
 * `custom_interface_pages` carries `brand_id = NULL` for the template defaults: the two queue
 * pages below are visible on every brand's portal unless the brand overrides them with its own
 * slug.
 */
const ACTOR = 'script:seed-interface-config';

const STANDARD_TAB_SEEDS = [
  { tabKey: 'concepts', sortOrder: 1 },
  { tabKey: 'creative_sheet', sortOrder: 2 },
  { tabKey: 'ugc_management', sortOrder: 3 },
  { tabKey: 'copywriting', sortOrder: 4 },
] as const;

const DEFAULT_CUSTOM_PAGE_SEEDS = [
  {
    slug: 'internal-queue',
    title: 'Internal Queue',
    sourceTableKey: 'creative_briefs',
    filterConfig: { column: 'internal_status', op: 'is_not_empty' as const },
    columnConfig: [],
    sortOrder: 10,
    isVisible: true,
  },
  {
    slug: 'client-queue',
    title: 'Client Queue',
    sourceTableKey: 'creative_briefs',
    filterConfig: {
      column: 'client_status',
      op: 'is' as const,
      value: 'pending_for_approval',
    },
    columnConfig: [],
    sortOrder: 11,
    isVisible: true,
  },
] as const;

export interface SeedResult {
  readonly templateBrandId: string | null;
  readonly inserted: number;
  readonly skipped: number;
  readonly pagesInserted: number;
  readonly pagesSkipped: number;
}

/** The function tests mount against pglite. The script's `main` wraps it in a dry-run transaction. */
export async function seedInterfaceConfig(db: Db, actor: string = ACTOR): Promise<SeedResult> {
  const [templateBrand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.isTemplate, true), isNull(brands.deletedAt)))
    .limit(1);
  if (!templateBrand) {
    return {
      templateBrandId: null,
      inserted: 0,
      skipped: 0,
      pagesInserted: 0,
      pagesSkipped: 0,
    };
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

  // `custom_interface_pages.brand_id` is nullable; Postgres treats two NULLs as DISTINCT in a
  // UNIQUE constraint, so `ON CONFLICT (brand_id, slug)` cannot catch a duplicate template row.
  // The seed therefore reads first and inserts only when no live row with (brand_id IS NULL,
  // slug) exists yet — the same idempotence contract the tab seeds use through ON CONFLICT.
  let pagesInserted = 0;
  let pagesSkipped = 0;
  for (const seed of DEFAULT_CUSTOM_PAGE_SEEDS) {
    const [existing] = await db
      .select({ id: customInterfacePages.id })
      .from(customInterfacePages)
      .where(
        and(
          isNull(customInterfacePages.brandId),
          eq(customInterfacePages.slug, seed.slug),
          isNull(customInterfacePages.deletedAt),
        ),
      )
      .limit(1);
    if (existing) {
      pagesSkipped += 1;
      continue;
    }
    await db.insert(customInterfacePages).values({
      brandId: null,
      slug: seed.slug,
      title: seed.title,
      sourceTableKey: seed.sourceTableKey,
      filterConfig: seed.filterConfig,
      columnConfig: seed.columnConfig,
      sortOrder: seed.sortOrder,
      isVisible: seed.isVisible,
      isInherited: true,
      createdBy: actor,
      updatedBy: actor,
    });
    pagesInserted += 1;
  }

  return {
    templateBrandId: templateBrand.id,
    inserted,
    skipped,
    pagesInserted,
    pagesSkipped,
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
  let result: SeedResult = {
    templateBrandId: null,
    inserted: 0,
    skipped: 0,
    pagesInserted: 0,
    pagesSkipped: 0,
  };
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
        `  template brand ${result.templateBrandId}: tabs inserted ${String(result.inserted)} / skipped ${String(result.skipped)}, pages inserted ${String(result.pagesInserted)} / skipped ${String(result.pagesSkipped)}`,
      );
    }
    const totalInserted = result.inserted + result.pagesInserted;
    console.log(
      `\n${apply ? '[APPLIED]' : '[DRY RUN — ROLLED BACK]'} ${String(totalInserted)} rows written against the template.`,
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.endsWith('seed-interface-config.ts')) await main();
