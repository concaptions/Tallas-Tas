import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { loadAllAngleProducts, loadAllConceptAngles } from './junction-queries';
import { angles, concepts, products, type NewProduct, type Product } from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Products page's data access (PRD §5.1: the landing page link is the required part, the
 * collection link is optional). Every function takes the database as its first argument (no
 * module-level singleton) and reads and writes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose
 * its own brand. Nothing here contains business logic; the domain functions call these.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What a form or a parsed CSV row submits for create (`name` and `link` required), or patches. */
export type ProductInput = Omit<NewProduct, ManagedColumn>;

/**
 * A product as the list and the panel render it: the row plus `conceptCount`, the number of live
 * concepts of the brand whose angle points at this product. `demoProducts` satisfies
 * `ProductListRow[]`, so the page reads demo fixtures and database rows through one type.
 */
export type ProductListRow = Product & { conceptCount: number };

/**
 * `productId -> live concept count`, counted in TypeScript over junction table lookups.
 *
 * `concepts` has no product of its own: the link is concept→angle (via conceptAngles junction)
 * → product (via angleProducts junction), two hops through junction tables. The counting happens
 * here rather than in SQL because `withBrand` hands back a sealed query surface with no join,
 * `where` or `$dynamic` (TICKET-005 round 3), which is the guarantee that a scoped read cannot be
 * widened. Junction tables are loaded in bulk; an angle with no linked products simply contributes
 * to no product's count.
 */
async function conceptCounts(db: Db, scope: BrandScope): Promise<Map<string, number>> {
  const [brandConcepts, brandAngles, conceptAngleMap, angleProductMap] = await Promise.all([
    scope.select(concepts),
    scope.select(angles),
    loadAllConceptAngles(db),
    loadAllAngleProducts(db),
  ]);
  const liveAngleIds = new Set(brandAngles.map((a) => a.id));
  const counts = new Map<string, number>();
  for (const concept of brandConcepts) {
    const angleIds = conceptAngleMap.get(concept.id) ?? [];
    for (const angleId of angleIds) {
      if (!liveAngleIds.has(angleId)) continue;
      const productIds = angleProductMap.get(angleId) ?? [];
      for (const productId of productIds) {
        counts.set(productId, (counts.get(productId) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** The brand's live products, newest edit first, each with its linked concept count. */
export async function listProducts(db: Db, brandId: string): Promise<ProductListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, counts] = await Promise.all([
    scope.select(products).orderBy(desc(products.updatedAt)),
    conceptCounts(db, scope),
  ]);
  return rows.map((row) => ({ ...row, conceptCount: counts.get(row.id) ?? 0 }));
}

/** One live product of the brand, with its concept count, or null: another brand's id never resolves. */
export async function getProductById(
  db: Db,
  brandId: string,
  id: string,
): Promise<ProductListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(products, eq(products.id, id)).limit(1);
  if (row === undefined) return null;
  return { ...row, conceptCount: (await conceptCounts(db, scope)).get(row.id) ?? 0 };
}

/** Creates a product in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertProduct(
  db: Db,
  brandId: string,
  values: ProductInput,
  actorId: string,
): Promise<Product> {
  const [row] = await withBrand(db, brandId)
    .insert(products, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('products insert returned no row');
  }
  return row;
}

/**
 * Patches one live product of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateProduct(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<ProductInput>,
  actorId: string,
): Promise<Product | null> {
  const [row] = await withBrand(db, brandId)
    .update(products, { ...patch, updatedBy: actorId, updatedAt: new Date() }, eq(products.id, id))
    .returning();
  return row ?? null;
}
