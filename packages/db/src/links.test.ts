import { describe, expect, it } from 'vitest';

import { listAngles } from './angles';
import { listConcepts } from './concepts';
import { listCreators } from './creators';
import { listLinkedIds, syncLinks, type LinkSpec } from './links';
import { listPersonas } from './personas';
import { listProducts } from './products';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const { childBrand } = await seed(db);
  const brandId = childBrand.id;
  const [concepts, angles, creators, products, personas] = await Promise.all([
    listConcepts(db, brandId),
    listAngles(db, brandId),
    listCreators(db, brandId),
    listProducts(db, brandId),
    listPersonas(db, brandId),
  ]);
  return { db, brandId, concepts, angles, creators, products, personas };
}

const CONCEPT_CREATORS: LinkSpec = {
  junction: 'creator_concepts',
  source: 'concept',
  target: 'creator',
};
const CREATOR_CONCEPTS: LinkSpec = {
  junction: 'creator_concepts',
  source: 'creator',
  target: 'concept',
};
const CONCEPT_ANGLES: LinkSpec = { junction: 'concept_angles', source: 'concept', target: 'angle' };
const ANGLE_CONCEPTS: LinkSpec = { junction: 'concept_angles', source: 'angle', target: 'concept' };
const ANGLE_PRODUCTS: LinkSpec = { junction: 'angle_products', source: 'angle', target: 'product' };
const PRODUCT_ANGLES: LinkSpec = { junction: 'angle_products', source: 'product', target: 'angle' };
const ANGLE_PERSONAS: LinkSpec = { junction: 'angle_personas', source: 'angle', target: 'persona' };
const PERSONA_ANGLES: LinkSpec = { junction: 'angle_personas', source: 'persona', target: 'angle' };
const CREATOR_PRODUCTS: LinkSpec = {
  junction: 'creator_products',
  source: 'creator',
  target: 'product',
};
const PRODUCT_CREATORS: LinkSpec = {
  junction: 'creator_products',
  source: 'product',
  target: 'creator',
};

describe('two-way links (one junction, both sides)', () => {
  it('a creator linked from the concept side is read back from the creator side', async () => {
    const { db, concepts, creators } = await seeded();
    const concept = concepts[0];
    const creator = creators[0];
    if (concept === undefined || creator === undefined) throw new Error('fixtures missing');

    await syncLinks(db, CONCEPT_CREATORS, concept.id, [creator.id]);

    expect(await listLinkedIds(db, CREATOR_CONCEPTS, creator.id)).toContain(concept.id);
    expect(await listLinkedIds(db, CONCEPT_CREATORS, concept.id)).toEqual([creator.id]);
  });

  it('a concept linked from the creator side is read back from the concept side, replacing the old set', async () => {
    const { db, concepts, creators } = await seeded();
    const [first, second] = concepts;
    const creator = creators[1];
    if (first === undefined || second === undefined || creator === undefined) {
      throw new Error('fixtures missing');
    }

    await syncLinks(db, CREATOR_CONCEPTS, creator.id, [first.id]);
    await syncLinks(db, CREATOR_CONCEPTS, creator.id, [second.id, second.id, ' ']);

    expect(await listLinkedIds(db, CREATOR_CONCEPTS, creator.id)).toEqual([second.id]);
    expect(await listLinkedIds(db, CONCEPT_CREATORS, first.id)).not.toContain(creator.id);
    expect(await listLinkedIds(db, CONCEPT_CREATORS, second.id)).toContain(creator.id);
  });

  it('angle ↔ concept, product ↔ angle and persona ↔ angle all read from both sides', async () => {
    const { db, concepts, angles, products, personas } = await seeded();
    const concept = concepts[0];
    const angle = angles[0];
    const product = products[0];
    const persona = personas[0];
    if (!concept || !angle || !product || !persona) throw new Error('fixtures missing');

    await syncLinks(db, ANGLE_CONCEPTS, angle.id, [concept.id]);
    expect(await listLinkedIds(db, CONCEPT_ANGLES, concept.id)).toEqual([angle.id]);

    await syncLinks(db, PRODUCT_ANGLES, product.id, [angle.id]);
    expect(await listLinkedIds(db, ANGLE_PRODUCTS, angle.id)).toContain(product.id);

    await syncLinks(db, PERSONA_ANGLES, persona.id, [angle.id]);
    expect(await listLinkedIds(db, ANGLE_PERSONAS, angle.id)).toContain(persona.id);

    // The list rows resolve the same junction, so the inherited lookups follow the write.
    const [row] = (await listAngles(db, angle.brandId)).filter((entry) => entry.id === angle.id);
    expect(row?.productIds).toContain(product.id);
    expect(row?.personaIds).toContain(persona.id);
  });

  /**
   * `creator_products` is the junction the UGC panel used to own alone: it wrote the rows from a row
   * of toggle buttons of its own and the product panel only listed them, telling the user to go to
   * the other panel. Both ends go through one spec now, so a product booked from the creator and a
   * creator booked from the product are the same row.
   */
  it('a product booked from the creator side is read back from the product side, and the reverse', async () => {
    const { db, creators, products } = await seeded();
    const [firstCreator, secondCreator] = creators;
    const [firstProduct, secondProduct] = products;
    if (!firstCreator || !secondCreator || !firstProduct || !secondProduct) {
      throw new Error('fixtures missing');
    }

    await syncLinks(db, CREATOR_PRODUCTS, firstCreator.id, [firstProduct.id]);
    expect(await listLinkedIds(db, PRODUCT_CREATORS, firstProduct.id)).toContain(firstCreator.id);

    // Written from the PRODUCT side, the creator reads it back — and replacing that side's set
    // leaves the other creator's own booking alone.
    await syncLinks(db, PRODUCT_CREATORS, secondProduct.id, [secondCreator.id]);
    expect(await listLinkedIds(db, CREATOR_PRODUCTS, secondCreator.id)).toEqual([secondProduct.id]);
    expect(await listLinkedIds(db, CREATOR_PRODUCTS, firstCreator.id)).toEqual([firstProduct.id]);
  });

  it('an empty list clears the side without touching the other pairs of the target', async () => {
    const { db, concepts, angles } = await seeded();
    const [a, b] = concepts;
    const angle = angles[0];
    if (!a || !b || !angle) throw new Error('fixtures missing');

    await syncLinks(db, CONCEPT_ANGLES, a.id, [angle.id]);
    await syncLinks(db, CONCEPT_ANGLES, b.id, [angle.id]);
    await syncLinks(db, CONCEPT_ANGLES, a.id, []);

    expect(await listLinkedIds(db, CONCEPT_ANGLES, a.id)).toEqual([]);
    expect(await listLinkedIds(db, ANGLE_CONCEPTS, angle.id)).toEqual([b.id]);
  });
});
