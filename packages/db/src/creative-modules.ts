import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  angles,
  creativeBriefs,
  creativeModuleAngles,
  creativeModuleDesigns,
  creativeModules,
  type CreativeModule,
  type NewCreativeModule,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Creative Modules page's data access (Airtable "(Internal) Creative Modules", `tblzS73a9JrJGiV2J`,
 * audit §2.4): a per-brand grouping of briefs around one creative pattern with a Foreplay board as
 * its reference. A copy of `products.ts`, function for function. Every function takes the database
 * as its first argument (no module-level singleton) and reads and writes the module rows through
 * `withBrand(db, brandId)`, so `brand_id = $brandId AND deleted_at IS NULL` is on every statement and
 * an insert cannot choose its own brand. Nothing here contains business logic.
 *
 * The two Airtable record links are the junctions `creative_module_angles` (the field Airtable NAMES
 * "Concepts" but which links to the Angles table — see the schema comment) and
 * `creative_module_designs` (briefs). They are synced delete-then-insert like every junction in
 * `junction-queries.ts`, and read back in bulk so a list of N modules costs a fixed number of queries.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel form submits for create (`moduleName` required), or patches. */
export type CreativeModuleInput = Omit<NewCreativeModule, ManagedColumn>;

/**
 * A module as the list and the panel render it: the row plus its links, ids and names side by side
 * (`angleIds[i]` is `angleNames[i]`), restricted to the brand's LIVE angles and briefs and ordered by
 * name. The counts the grid shows are `angleIds.length` and `briefIds.length`, computed by the page.
 * `demoCreativeModules` satisfies `CreativeModuleListRow[]`, so the page reads demo fixtures and
 * database rows through one type.
 */
export type CreativeModuleListRow = CreativeModule & {
  angleIds: string[];
  angleNames: string[];
  briefIds: string[];
  briefNames: string[];
};

// ── Junction bulk loaders (list view: every link of every module in one read each) ──────────────

/** `moduleId -> angleIds`, every row of `creative_module_angles`. */
export async function loadAllCreativeModuleAngles(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(creativeModuleAngles);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.moduleId);
    if (existing) existing.push(row.angleId);
    else map.set(row.moduleId, [row.angleId]);
  }
  return map;
}

/** `moduleId -> briefIds`, every row of `creative_module_designs`. */
export async function loadAllCreativeModuleDesigns(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(creativeModuleDesigns);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.moduleId);
    if (existing) existing.push(row.briefId);
    else map.set(row.moduleId, [row.briefId]);
  }
  return map;
}

// ── Junction sync helpers (delete-then-insert, the `junction-queries.ts` contract) ───────────────

/** Replaces the module's angle links with exactly `angleIds`. */
export async function syncCreativeModuleAngles(
  db: Db,
  moduleId: string,
  angleIds: string[],
): Promise<void> {
  await db.delete(creativeModuleAngles).where(eq(creativeModuleAngles.moduleId, moduleId));
  if (angleIds.length > 0) {
    await db
      .insert(creativeModuleAngles)
      .values(angleIds.map((angleId) => ({ moduleId, angleId })));
  }
}

/** Replaces the module's brief ("Creative Design") links with exactly `briefIds`. */
export async function syncCreativeModuleDesigns(
  db: Db,
  moduleId: string,
  briefIds: string[],
): Promise<void> {
  await db.delete(creativeModuleDesigns).where(eq(creativeModuleDesigns.moduleId, moduleId));
  if (briefIds.length > 0) {
    await db
      .insert(creativeModuleDesigns)
      .values(briefIds.map((briefId) => ({ moduleId, briefId })));
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────

interface Links {
  ids: string[];
  names: string[];
}

interface LinkedWork {
  angles: Map<string, Links>;
  briefs: Map<string, Links>;
}

/**
 * Pairs each module's junction ids with the names of the brand's live rows, dropping a link whose
 * target is soft-deleted or belongs to another brand (the junction has no brand of its own; the
 * scoped read of the target table is what keeps a foreign id from surfacing). Ordered by name,
 * because the scoped read carries no ORDER BY and heap order is not a contract.
 */
function resolveLinks(
  junction: Map<string, string[]>,
  live: Map<string, string>,
): Map<string, Links> {
  const resolved = new Map<string, Links>();
  for (const [moduleId, targetIds] of junction) {
    const pairs: { id: string; name: string }[] = [];
    for (const id of targetIds) {
      const name = live.get(id);
      if (name !== undefined) pairs.push({ id, name });
    }
    pairs.sort((a, b) => a.name.localeCompare(b.name));
    resolved.set(moduleId, {
      ids: pairs.map((pair) => pair.id),
      names: pairs.map((pair) => pair.name),
    });
  }
  return resolved;
}

async function linkedWork(db: Db, scope: BrandScope): Promise<LinkedWork> {
  const [brandAngles, brandBriefs, angleMap, designMap] = await Promise.all([
    scope.select(angles),
    scope.select(creativeBriefs),
    loadAllCreativeModuleAngles(db),
    loadAllCreativeModuleDesigns(db),
  ]);
  return {
    angles: resolveLinks(angleMap, new Map(brandAngles.map((row) => [row.id, row.name]))),
    briefs: resolveLinks(designMap, new Map(brandBriefs.map((row) => [row.id, row.name]))),
  };
}

/** A fresh empty link set per row, never a shared array two rows could both push into. */
function none(): Links {
  return { ids: [], names: [] };
}

function withLinks(row: CreativeModule, linked: LinkedWork): CreativeModuleListRow {
  const linkedAngles = linked.angles.get(row.id) ?? none();
  const linkedBriefs = linked.briefs.get(row.id) ?? none();
  return {
    ...row,
    angleIds: linkedAngles.ids,
    angleNames: linkedAngles.names,
    briefIds: linkedBriefs.ids,
    briefNames: linkedBriefs.names,
  };
}

/** The brand's live modules, newest edit first, each with its linked angles and briefs. */
export async function listCreativeModules(
  db: Db,
  brandId: string,
): Promise<CreativeModuleListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, linked] = await Promise.all([
    scope.select(creativeModules).orderBy(desc(creativeModules.updatedAt)),
    linkedWork(db, scope),
  ]);
  return rows.map((row) => withLinks(row, linked));
}

/** One live module of the brand, with its links, or null: another brand's id never resolves. */
export async function getCreativeModuleById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CreativeModuleListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(creativeModules, eq(creativeModules.id, id)).limit(1);
  if (row === undefined) return null;
  return withLinks(row, await linkedWork(db, scope));
}

// ── Writes ───────────────────────────────────────────────────────────────────────────────────────

/** Creates a module in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertCreativeModule(
  db: Db,
  brandId: string,
  values: CreativeModuleInput,
  actorId: string,
): Promise<CreativeModule> {
  const [row] = await withBrand(db, brandId)
    .insert(creativeModules, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('creative_modules insert returned no row');
  }
  return row;
}

/**
 * Patches one live module of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateCreativeModule(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CreativeModuleInput>,
  actorId: string,
): Promise<CreativeModule | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      creativeModules,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(creativeModules.id, id),
    )
    .returning();
  return row ?? null;
}
