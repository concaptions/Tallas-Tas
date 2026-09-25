import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { importAirtableExport, type AirtableExport } from './airtable-import';
import { DEMO_BRAND_ID } from './demo-data';
import {
  anglePersonas,
  angleProducts,
  angles,
  campaignsOffers,
  collections,
  conceptAngles,
  conceptCollections,
  concepts,
  conceptThemes,
  copywriting,
  creativeBriefs,
  creatorConcepts,
  creatorProducts,
  creators,
  personas,
  products,
  themes,
} from './schema';
import { seed } from './seed';
import { testDb } from './testing';

const FIXTURE: AirtableExport = {
  Products: [
    { id: 'at_prod_1', fields: { Name: 'Sleep Mattress', Link: 'https://example.com/sleep' } },
    { id: 'at_prod_2', fields: { Name: 'Pillow Pro', Link: 'https://example.com/pillow' } },
  ],
  Themes: [{ id: 'at_theme_1', fields: { Name: 'UGC Testimonial', Category: 'Framework' } }],
  'Campaigns & Offers': [
    {
      id: 'at_camp_1',
      fields: {
        Name: 'BFCM-20OFF-BF26',
        Holiday: 'BFCM',
        'Discount Offer': '20% OFF',
        Code: 'BF26',
        Interested: true,
      },
    },
  ],
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
        Type: ['UGC'],
        Winning: true,
      },
    },
  ],
  Concepts: [
    {
      id: 'at_concept_1',
      fields: {
        Name: 'B1-Pain-UGC',
        Angle: 'at_angle_1',
        Theme: 'at_theme_1',
        Batch: 'B1',
        Category: 'Performance',
        Collection: ['at_coll_1'],
      },
    },
  ],
  Collections: [
    {
      id: 'at_coll_1',
      fields: {
        Name: 'Spring Launch',
        URL: 'https://example.com/spring',
        'Campaigns & Offers': ['at_camp_1'],
        Angles: ['at_angle_1'],
        Product: ['at_prod_1'],
      },
    },
  ],
  'Creative Briefs': [
    {
      id: 'at_brief_1',
      fields: {
        Name: 'VID001-B1-Pain',
        Concept: ['at_concept_1'],
        Angle: ['at_angle_1'],
        Product: ['at_prod_1'],
        Collection: ['at_coll_1'],
        'Campaigns & Offers': ['at_camp_1'],
        Assignee: 'Editor A',
        Platform: ['Meta', 'TikTok'],
        Batch: 'B1',
      },
    },
  ],
  Copywriting: [
    {
      id: 'at_copy_1',
      fields: {
        'Creative Brief': ['at_brief_1'],
        Concept: ['at_concept_1'],
        Product: ['at_prod_1'],
        'Primary Copy': 'Sleep better tonight',
        Headline: 'Pain-Free Sleep',
        CTA: 'Shop Now',
        Winning: true,
      },
    },
  ],
  Creators: [
    {
      id: 'at_creator_1',
      fields: {
        Name: 'Jane Doe',
        Gender: 'Female',
        'Creator Link': 'https://billo.app/jane',
        'Concept to film': ['at_concept_1'],
        Products: ['at_prod_1', 'at_prod_2'],
        Platform: 'Billo',
      },
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
    expect(results.campaignsOffers?.imported).toBe(1);
    expect(results.personas?.imported).toBe(1);
    expect(results.angles?.imported).toBe(1);
    expect(results.concepts?.imported).toBe(1);
    expect(results.collections?.imported).toBe(1);
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
    const anglePersonaRows = angle
      ? await db.select().from(anglePersonas).where(eq(anglePersonas.angleId, angle.id))
      : [];
    const angleProductRows = angle
      ? await db.select().from(angleProducts).where(eq(angleProducts.angleId, angle.id))
      : [];
    expect(anglePersonaRows[0]?.personaId).toBe(persona?.id);
    expect(angleProductRows[0]?.productId).toBe(product?.id);

    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    const [theme] = await db.select().from(themes).where(eq(themes.legacyAirtableId, 'at_theme_1'));
    const conceptAngleRows = concept
      ? await db.select().from(conceptAngles).where(eq(conceptAngles.conceptId, concept.id))
      : [];
    const conceptThemeRows = concept
      ? await db.select().from(conceptThemes).where(eq(conceptThemes.conceptId, concept.id))
      : [];
    expect(conceptAngleRows[0]?.angleId).toBe(angle?.id);
    expect(conceptThemeRows[0]?.themeId).toBe(theme?.id);
  });

  it('resolves campaigns_offers FK on collections (was buggy: used conceptMap)', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    const [campaign] = await db
      .select()
      .from(campaignsOffers)
      .where(eq(campaignsOffers.legacyAirtableId, 'at_camp_1'));
    const [coll] = await db
      .select()
      .from(collections)
      .where(eq(collections.legacyAirtableId, 'at_coll_1'));
    expect(campaign).toBeDefined();
    expect(coll?.campaignId).toBe(campaign?.id);

    const [angle] = await db.select().from(angles).where(eq(angles.legacyAirtableId, 'at_angle_1'));
    expect(coll?.angleId).toBe(angle?.id);

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.legacyAirtableId, 'at_prod_1'));
    expect(coll?.productId).toBe(product?.id);
  });

  it('resolves Pass 2 FKs on creative briefs', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    const [brief] = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.legacyAirtableId, 'at_brief_1'));
    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    const [angle] = await db.select().from(angles).where(eq(angles.legacyAirtableId, 'at_angle_1'));
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.legacyAirtableId, 'at_prod_1'));
    const [coll] = await db
      .select()
      .from(collections)
      .where(eq(collections.legacyAirtableId, 'at_coll_1'));
    const [campaign] = await db
      .select()
      .from(campaignsOffers)
      .where(eq(campaignsOffers.legacyAirtableId, 'at_camp_1'));

    expect(brief?.conceptId).toBe(concept?.id);
    expect(brief?.angleId).toBe(angle?.id);
    expect(brief?.productId).toBe(product?.id);
    expect(brief?.collectionId).toBe(coll?.id);
    expect(brief?.campaignOfferId).toBe(campaign?.id);
    expect(brief?.platform).toEqual(['Meta', 'TikTok']);
  });

  it('resolves Pass 2 FKs on copywriting', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    const [copy] = await db
      .select()
      .from(copywriting)
      .where(eq(copywriting.legacyAirtableId, 'at_copy_1'));
    const [brief] = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.legacyAirtableId, 'at_brief_1'));
    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.legacyAirtableId, 'at_prod_1'));

    expect(copy?.creativeBriefId).toBe(brief?.id);
    expect(copy?.conceptId).toBe(concept?.id);
    expect(copy?.productId).toBe(product?.id);
    expect(copy?.winning).toBe(true);
  });

  it('wires creatorConcepts and creatorProducts junction tables', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'at_creator_1'));
    if (!creator) throw new Error('creator not found');

    const ccRows = await db
      .select()
      .from(creatorConcepts)
      .where(eq(creatorConcepts.creatorId, creator.id));
    expect(ccRows).toHaveLength(1);

    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    expect(ccRows[0]?.conceptId).toBe(concept?.id);

    const cpRows = await db
      .select()
      .from(creatorProducts)
      .where(eq(creatorProducts.creatorId, creator.id));
    expect(cpRows).toHaveLength(2);

    expect(creator.platform).toEqual(['Billo']);
  });

  it('resolves concept→collection junction table', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    const [coll] = await db
      .select()
      .from(collections)
      .where(eq(collections.legacyAirtableId, 'at_coll_1'));

    if (!concept) throw new Error('concept not found');
    const rows = await db
      .select()
      .from(conceptCollections)
      .where(eq(conceptCollections.conceptId, concept.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.collectionId).toBe(coll?.id);
  });

  it('is idempotent — running twice skips all records', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    const results = await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    expect(results.products?.imported).toBe(0);
    expect(results.products?.skipped).toBe(2);
    expect(results.themes?.skipped).toBe(1);
    expect(results.campaignsOffers?.skipped).toBe(1);
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

  it('handles Gratsi-style theme multipleSelects (name-match, not record links)', async () => {
    const db = await seeded();
    const gratsiFixture: AirtableExport = {
      Themes: [{ id: 'at_t_1', fields: { Name: 'Authority', Category: 'Framework' } }],
      Concepts: [
        {
          id: 'at_c_1',
          fields: { Name: 'Test Concept', Theme: ['Authority'], Batch: 'B1' },
        },
      ],
    };
    await importAirtableExport(db, gratsiFixture, DEMO_BRAND_ID, 'migration-actor');

    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_c_1'));
    const [theme] = await db.select().from(themes).where(eq(themes.legacyAirtableId, 'at_t_1'));

    if (!concept) throw new Error('concept not found');
    const rows = await db
      .select()
      .from(conceptThemes)
      .where(eq(conceptThemes.conceptId, concept.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.themeId).toBe(theme?.id);
  });

  it('handles both singleSelect and multipleSelects for creator Platform', async () => {
    const db = await seeded();
    const fixture: AirtableExport = {
      Creators: [
        { id: 'at_cr_single', fields: { Name: 'Single Platform', Platform: 'Billo' } },
        { id: 'at_cr_multi', fields: { Name: 'Multi Platform', Platform: ['Meta', 'TikTok'] } },
        { id: 'at_cr_none', fields: { Name: 'No Platform' } },
      ],
    };
    await importAirtableExport(db, fixture, DEMO_BRAND_ID, 'migration-actor');

    const [single] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'at_cr_single'));
    expect(single?.platform).toEqual(['Billo']);

    const [multi] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'at_cr_multi'));
    expect(multi?.platform).toEqual(['Meta', 'TikTok']);

    const [none] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'at_cr_none'));
    expect(none?.platform).toEqual([]);
  });
});

describe('Youtube Copywriting fallback (Sprint 11)', () => {
  it('imports Youtube Copywriting when Meta is empty, mapping its fields to the copywriting columns', async () => {
    const db = await seeded();
    const fixture: AirtableExport = {
      'Youtube Copywriting': [
        {
          id: 'at_yt_1',
          fields: {
            'Copy #': 'Copy 3',
            'Descriptions (90 caractères max)': 'Wine, simplified.',
            Headline: 'Boxed but better',
            'News Feed': 'Try the sampler',
            CTA: 'Shop Now',
            Funnel: 'TOF',
            USED: true,
            Winning: false,
          },
        },
      ],
    };

    const results = await importAirtableExport(db, fixture, DEMO_BRAND_ID, 'migration-actor');

    expect(results.copywriting?.imported).toBe(1);
    const [copy] = await db
      .select()
      .from(copywriting)
      .where(eq(copywriting.legacyAirtableId, 'at_yt_1'));
    expect(copy?.copyNumber).toBe(3);
    expect(copy?.primaryCopy).toBe('Wine, simplified.');
    expect(copy?.headline).toBe('Boxed but better');
    expect(copy?.linkDescription).toBe('Try the sampler');
    expect(copy?.used).toBe(true);
  });

  it('prefers Meta Copywriting when both are present, ignoring the Youtube source', async () => {
    const db = await seeded();
    const fixture: AirtableExport = {
      Copywriting: [
        { id: 'at_meta_1', fields: { 'Primary Copy': 'From Meta', Headline: 'Meta H' } },
      ],
      'Youtube Copywriting': [
        { id: 'at_yt_2', fields: { 'Descriptions (90 caractères max)': 'From Youtube' } },
      ],
    };

    const results = await importAirtableExport(db, fixture, DEMO_BRAND_ID, 'migration-actor');

    expect(results.copywriting?.imported).toBe(1);
    const imported = (await db.select().from(copywriting))
      .map((row) => row.legacyAirtableId)
      .filter((id) => id === 'at_meta_1' || id === 'at_yt_2');
    expect(imported).toEqual(['at_meta_1']);
  });
});
