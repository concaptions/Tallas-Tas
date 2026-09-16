import { and, countDistinct, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { concepts, themes, type NewTheme, type Theme } from './schema';

/**
 * The Themes page's data access (PRD §5.5: the creative vehicle, the *how*). Every function takes
 * the database as its first argument (no module-level singleton) and none of them contains business
 * logic; the domain functions call these.
 *
 * NOT `withBrand`, and that is the point. Themes are the one GLOBAL library (CLAUDE.md
 * non-negotiable 3): one shared table across every brand, `brand_id` null on every row and the
 * `themes_global` check constraint enforcing it in Postgres. There is no brand to scope to, so
 * `withBrand` does not apply here and `withBrand(...).select(themes)` deliberately does not compile
 * — `themes` keeps `brand_id` nullable, so it is not a `BrandedTable`. Each function below carries
 * that note, so a later reader does not "fix" the missing scope and quietly make the library
 * per-brand. What IS scoped is the live filter: every read carries `deleted_at IS NULL`, the half of
 * the scope that still means something for a global table.
 */

/** The columns the library, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/**
 * What the create dialog submits (`name` and `category` required) and, partially, for update.
 * `brandId` is absent: a theme belongs to the platform, so there is no brand for a caller to pick.
 */
export type ThemeInput = Omit<NewTheme, ManagedColumn>;

/**
 * A theme as the library grid renders it: the row plus `usedByBrandCount`, the number of DISTINCT
 * brands whose live concepts reference it — the one number that shows a global library is being
 * shared rather than sitting unused. `demoThemes` satisfies `ThemeListRow[]`, so the page reads demo
 * fixtures and database rows through one type.
 */
export type ThemeListRow = Theme & { usedByBrandCount: number };

/**
 * `themeId -> number of distinct brands with a live concept on it`.
 *
 * Counted in SQL, unscoped and across every brand ON PURPOSE: the question this answers is "how many
 * of the platform's brands use this theme", which no single brand's scope can see. Deliberately NOT
 * `withBrand` — see the module note. `concepts.theme_id` is nullable (a concept need not name a
 * theme, CLAUDE.md non-negotiable 5's sibling rule), so the null group is excluded before the
 * grouping rather than filtered out of the map afterwards, and a theme nobody references simply has
 * no row here and reads back as 0. Soft-deleted concepts never count; the brand row itself is not
 * joined, because `concepts.brand_id` is NOT NULL and points at a live brand by foreign key.
 */
async function brandCounts(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ themeId: concepts.themeId, brands: countDistinct(concepts.brandId) })
    .from(concepts)
    .where(and(isNotNull(concepts.themeId), isNull(concepts.deletedAt)))
    .groupBy(concepts.themeId);
  return new Map(rows.map((row) => [row.themeId ?? '', row.brands]));
}

/**
 * Every live theme in the library, newest edit first, each with its distinct-brand count.
 *
 * Takes no `brandId` and never goes through `withBrand`, because the library is global: the same six
 * rows answer for every brand in the platform. Do not add a brand argument here.
 */
export async function listThemes(db: Db): Promise<ThemeListRow[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(themes).where(isNull(themes.deletedAt)).orderBy(desc(themes.updatedAt)),
    brandCounts(db),
  ]);
  return rows.map((row) => ({ ...row, usedByBrandCount: counts.get(row.id) ?? 0 }));
}

/**
 * One live theme with its distinct-brand count, or null. No `brandId` and no `withBrand`: the
 * library is global, so a theme resolves the same for every brand — see the module note.
 */
export async function getThemeById(db: Db, id: string): Promise<ThemeListRow | null> {
  const [row] = await db
    .select()
    .from(themes)
    .where(and(eq(themes.id, id), isNull(themes.deletedAt)))
    .limit(1);
  if (row === undefined) return null;
  return { ...row, usedByBrandCount: (await brandCounts(db)).get(row.id) ?? 0 };
}

/**
 * Creates a theme in the global library. Unscoped on purpose (see the module note): `brand_id` is
 * left unset, so it defaults to null and the `themes_global` check constraint accepts the row. The
 * name is the strategist's own words — themes are the one table whose name is typed, not generated.
 */
export async function insertTheme(db: Db, values: ThemeInput, actorId: string): Promise<Theme> {
  const [row] = await db
    .insert(themes)
    .values({ ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('themes insert returned no row');
  }
  return row;
}

/**
 * Patches one live theme and returns it, or null when the id is unknown or soft-deleted — the same
 * outcome either way: zero rows changed. Unscoped on purpose (see the module note); `brand_id` is
 * never in the patch, so an update cannot pull a shared theme into one brand.
 */
export async function updateTheme(
  db: Db,
  id: string,
  patch: Partial<ThemeInput>,
  actorId: string,
): Promise<Theme | null> {
  const [row] = await db
    .update(themes)
    .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
    .where(and(eq(themes.id, id), isNull(themes.deletedAt)))
    .returning();
  return row ?? null;
}
