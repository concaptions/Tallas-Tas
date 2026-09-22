import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_BRAND_ID, PRODUCT_CSV_COLUMNS, demoProducts } from './demo-data';
import {
  getProductById,
  insertProduct,
  listProducts,
  updateProduct,
  type ProductInput,
  type ProductListRow,
} from './products';
import { angleProducts, angles, concepts, products, type Product } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/** The first demo product — the weighted blanket, the only one with a concept — past `noUncheckedIndexedAccess`. */
function demoProduct(): ProductListRow {
  const [row] = demoProducts;
  if (row === undefined) throw new Error('demoProducts is empty');
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('product queries', () => {
  it('seeds the three fixtures row for row, concept count included', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoProducts).toHaveLength(3);
    expect(await listProducts(db, brandId)).toEqual(demoProducts);
  });

  it('lists the brand’s products newest edit first, counting the concepts behind each angle', async () => {
    const { db, brandId } = await seeded();

    const rows = await listProducts(db, brandId);

    expect(rows.map((row) => row.name)).toEqual([
      'Niagara Deep Sleep Weighted Blanket',
      'Niagara Cooling Blackout Sleep Mask',
      'Niagara Night Reset Bundle (Blanket + Mask)',
    ]);
    // Ordered by updated_at desc, not by insertion order.
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
    expect(rows.map((row) => row.conceptCount)).toEqual([2, 2, 0]);
    // The optional column is visibly optional: one product has no collection link.
    expect(rows.filter((row) => row.collectionLink === null)).toHaveLength(1);
  });

  it('counts a concept only while both it and its angle are live', async () => {
    const { db, brandId } = await seeded();
    const target = demoProduct();

    expect((await getProductById(db, brandId, target.id))?.conceptCount).toBe(2);

    await db
      .update(concepts)
      .set({ deletedAt: new Date() })
      .where(sql`true`);
    expect((await getProductById(db, brandId, target.id))?.conceptCount).toBe(0);

    await db
      .update(concepts)
      .set({ deletedAt: null })
      .where(sql`true`);
    await db
      .update(angles)
      .set({ deletedAt: new Date() })
      .where(sql`true`);
    expect((await getProductById(db, brandId, target.id))?.conceptCount).toBe(0);
  });

  it('returns zero, never null, for a product no angle points at', async () => {
    const { db, brandId } = await seeded();

    const fresh = await insertProduct(
      db,
      brandId,
      { name: 'Niagara Cooling Pillow Protector', link: 'https://niagarasleep.example/x' },
      'user_test',
    );
    // An angle with no product at all must not fall into anyone's count either.
    await db.delete(angleProducts).where(sql`true`);

    const row = await getProductById(db, brandId, fresh.id);

    expect(row).toMatchObject({ name: 'Niagara Cooling Pillow Protector', conceptCount: 0 });
    expect(row?.collectionLink).toBeNull();
    expect((await listProducts(db, brandId)).every((item) => item.conceptCount === 0)).toBe(true);
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoProduct();

    expect(await listProducts(db, otherBrandId)).toEqual([]);
    expect(await getProductById(db, otherBrandId, target.id)).toBeNull();

    await db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(sql`${products.id} = ${target.id}`);

    expect(await listProducts(db, brandId)).toHaveLength(2);
    expect(await getProductById(db, brandId, target.id)).toBeNull();
  });

  it('insertProduct forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      name: 'Smuggled product',
      link: 'https://elsewhere.example/products/smuggled',
      brandId: otherBrandId,
    } as unknown as ProductInput;

    const row = await insertProduct(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'Smuggled product',
      collectionLink: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listProducts(db, brandId)).toHaveLength(4);
    expect(await listProducts(db, otherBrandId)).toEqual([]);
  });

  it('updateProduct cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoProduct();

    const escaped = await updateProduct(db, otherBrandId, target.id, { name: 'Hijacked' }, 'thief');
    const own = await updateProduct(
      db,
      brandId,
      target.id,
      { collectionLink: 'https://niagarasleep.example/collections/deep-sleep' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      name: target.name,
      collectionLink: 'https://niagarasleep.example/collections/deep-sleep',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows, and a CSV header of writable columns', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoProducts).toEqualTypeOf<ProductListRow[]>();
    expectTypeOf(await listProducts(db, brandId)).toEqualTypeOf<ProductListRow[]>();
    expectTypeOf<ProductListRow>().toExtend<Product>();
    expectTypeOf<ProductListRow['conceptCount']>().toEqualTypeOf<number>();
    // `brand_id` and the audit columns are the scope's, never the form's or the CSV's.
    expectTypeOf<ProductInput>().not.toHaveProperty('brandId');
    expectTypeOf<ProductInput>().not.toHaveProperty('createdBy');
    expectTypeOf<ProductInput>().toHaveProperty('link');
    expectTypeOf<ProductInput>().toHaveProperty('collectionLink');
    expect(PRODUCT_CSV_COLUMNS).toEqual(['name', 'link', 'collection_link']);
  });
});
