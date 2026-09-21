import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { importAirtableExport, type AirtableExport } from './airtable-import';
import { DEMO_BRAND_ID } from './demo-data';
import { angles, concepts, creators, personas, products, themes } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

const FIXTURE: AirtableExport = {
  Products: [
    { id: 'at_prod_1', fields: { Name: 'Sleep Mattress', Link: 'https://example.com/sleep' } },
    { id: 'at_prod_2', fields: { Name: 'Pillow Pro', Link: 'https://example.com/pillow' } },
  ],
  Themes: [{ id: 'at_theme_1', fields: { Name: 'UGC Testimonial', Category: 'Framework' } }],
  Personas: [
    {
      id: 'at_pers_1',
      fields: { Name: 'Budget Buyer', Product: 'at_prod_1', Demographic: '25-34 male' },
    },
  ],
  Angles: [
    {
      id: 'at_angle_1',
      fields: {
        Name: 'Pain Relief',
        Persona: 'at_pers_1',
        Product: 'at_prod_1',
        Description: 'Back pain angle',
      },
    },
  ],
  Concepts: [
    {
      id: 'at_concept_1',
      fields: { Name: 'B1-Pain-UGC', Angle: 'at_angle_1', Theme: 'at_theme_1', Batch: 'B1' },
    },
  ],
  'Creative Briefs': [
    {
      id: 'at_brief_1',
      fields: { Name: 'VID001-B1-Pain', Concept: 'at_concept_1', Assignee: 'Editor A' },
    },
  ],
  Copywriting: [
    {
      id: 'at_copy_1',
      fields: {
        'Creative Brief': 'at_brief_1',
        'Primary Copy': 'Sleep better tonight',
        Headline: 'Pain-Free Sleep',
      },
    },
  ],
  Creators: [
    {
      id: 'at_creator_1',
      fields: { Name: 'Jane Doe', Gender: 'Female', 'Creator Link': 'https://billo.app/jane' },
    },
  ],
};

async function seeded() {
  const db = await testDb();
  await seed(db);
  return db;
}

describe('importAirtableExport', () => {
  it('imports all tables from an Airtable export', async () => {
    const db = await seeded();
    const results = await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    expect(results.products?.imported).toBe(2);
    expect(results.themes?.imported).toBe(1);
    expect(results.personas?.imported).toBe(1);
    expect(results.angles?.imported).toBe(1);
    expect(results.concepts?.imported).toBe(1);
    expect(results.creativeBriefs?.imported).toBe(1);
    expect(results.copywriting?.imported).toBe(1);
    expect(results.creators?.imported).toBe(1);
  });

  it('preserves FK relationships through Airtable ID mapping', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    const [persona] = await db
      .select()
      .from(personas)
      .where(eq(personas.legacyAirtableId, 'at_pers_1'));
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.legacyAirtableId, 'at_prod_1'));
    expect(persona?.productId).toBe(product?.id);

    const [angle] = await db.select().from(angles).where(eq(angles.legacyAirtableId, 'at_angle_1'));
    expect(angle?.personaId).toBe(persona?.id);
    expect(angle?.productId).toBe(product?.id);

    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    const [theme] = await db.select().from(themes).where(eq(themes.legacyAirtableId, 'at_theme_1'));
    expect(concept?.angleId).toBe(angle?.id);
    expect(concept?.themeId).toBe(theme?.id);
  });

  it('is idempotent — running twice skips all records', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    const results = await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    expect(results.products?.imported).toBe(0);
    expect(results.products?.skipped).toBe(2);
    expect(results.themes?.skipped).toBe(1);
  });

  it('handles empty export gracefully', async () => {
    const db = await seeded();
    const results = await importAirtableExport(db, {}, DEMO_BRAND_ID, 'migration-actor');

    for (const r of Object.values(results)) {
      expect(r.imported).toBe(0);
      expect(r.failed).toBe(0);
    }
  });

  it('stores legacyAirtableId on imported rows', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    const [row] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'at_creator_1'));
    expect(row?.name).toBe('Jane Doe');
    expect(row?.legacyAirtableId).toBe('at_creator_1');
  });
});
