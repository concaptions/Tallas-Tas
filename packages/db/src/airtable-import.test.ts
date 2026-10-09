import { eq } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { emptyWarnings, importAirtableExport, type AirtableExport } from './airtable-import';
import { DEMO_BRAND_ID } from './demo-data';
import {
  anglePersonas,
  angleProducts,
  angles,
  campaignConcepts,
  campaignsOffers,
  clientAssetFolders,
  collections,
  competitiveResearch,
  conceptAngles,
  conceptCollections,
  concepts,
  conceptThemes,
  copyTypes,
  copywriting,
  copywritingCampaigns,
  copywritingCopyTypes,
  creativeBriefs,
  creativeModuleAngles,
  creativeModuleDesigns,
  creativeModules,
  creativeReporting,
  creativeDimensions,
  creativeSheetItems,
  creatorConcepts,
  creatorProducts,
  creators,
  emailCampaignCampaigns,
  emailCampaignCollections,
  emailCampaignProducts,
  emailCampaigns,
  emailFlowCampaigns,
  emailFlows,
  personas,
  products,
  smCampaignFeedTasks,
  themes,
  youtubeCopy,
  youtubeCopyCampaigns,
  youtubeCopyCollections,
  youtubeCopyCopyTypes,
  youtubeCopyProducts,
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

  it('re-running UPSERTS: no duplicates, every existing row updated in place', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    const before = (await db.select({ id: products.id }).from(products)).length;
    const results = await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');

    expect(results.products?.imported).toBe(0);
    expect(results.products?.updated).toBe(2);
    expect(results.themes?.updated).toBe(1);
    expect(results.campaignsOffers?.updated).toBe(1);
    expect((await db.select({ id: products.id }).from(products)).length).toBe(before);
  });

  it('an upsert heals a field the first run mapped wrong', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    // Simulate the first import's damage: a blindly-normalized status key on the stored row.
    const [row] = await db
      .select({ id: concepts.id })
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    if (!row) throw new Error('concept missing');
    await db
      .update(concepts)
      .set({ productionStatus: 'filming_concept' as never })
      .where(eq(concepts.id, row.id));

    const withStatus: AirtableExport = {
      ...FIXTURE,
      Concepts: [
        {
          id: 'at_concept_1',
          fields: { ...FIXTURE.Concepts?.[0]?.fields, 'Production Status': 'Filming Concept' },
        },
      ],
    };
    await importAirtableExport(db, withStatus, DEMO_BRAND_ID, 'migration-actor');
    const [healed] = await db
      .select({ productionStatus: concepts.productionStatus })
      .from(concepts)
      .where(eq(concepts.id, row.id));
    expect(healed?.productionStatus).toBe('filming_in_progress');
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

describe('Youtube Copywriting has its own table (Prompt 3, 2026-10-01; was a fallback in Sprint 11)', () => {
  it('imports Youtube Copywriting into youtube_copy with the enums.ts keys, never into copywriting', async () => {
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

    expect(results.copywriting?.imported).toBe(0);
    expect(results.youtubeCopy?.imported).toBe(1);
    const [copy] = await db
      .select()
      .from(youtubeCopy)
      .where(eq(youtubeCopy.legacyAirtableId, 'at_yt_1'));
    expect(copy?.copyNumber).toBe(3);
    expect(copy?.descriptions).toBe('Wine, simplified.');
    expect(copy?.headline).toBe('Boxed but better');
    expect(copy?.newsFeed).toBe('Try the sampler');
    expect(copy?.cta).toBe('shop_now');
    expect(copy?.funnel).toBe('tof');
    expect(copy?.used).toBe(true);
    expect((await db.select().from(copywriting)).map((row) => row.legacyAirtableId)).not.toContain(
      'at_yt_1',
    );
  });

  it('Meta and Youtube copy land in their own tables when both are present', async () => {
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
    expect(results.youtubeCopy?.imported).toBe(1);
    const meta = (await db.select().from(copywriting))
      .map((row) => row.legacyAirtableId)
      .filter((id) => id === 'at_meta_1' || id === 'at_yt_2');
    expect(meta).toEqual(['at_meta_1']);
    const [yt] = await db
      .select()
      .from(youtubeCopy)
      .where(eq(youtubeCopy.legacyAirtableId, 'at_yt_2'));
    expect(yt?.descriptions).toBe('From Youtube');
  });
});

describe('Gratsi live-base shapes (Sprint 2026-09-29)', () => {
  /** A slice of the real base: per-person statuses, concept-held pairings, record-link dimensions. */
  const GRATSI: AirtableExport = {
    Products: [
      {
        id: 'g_prod_1',
        fields: {
          'Product Name / Landing Page Name': 'Gratsi Red',
          Link: 'https://gratsi.example/red',
        },
      },
    ],
    Personas: [
      {
        id: 'g_pers_1',
        fields: {
          Name: 'Boxed-wine sceptic',
          'Problem-Solution Awareness Level': 'Completely Unaware',
        },
      },
    ],
    Themes: [{ id: 'g_theme_1', fields: { Name: 'Taste Test', Status: 'Todo' } }],
    Angles: [
      { id: 'g_angle_1', fields: { Name: 'No headache wine', Description: 'low sulfites' } },
    ],
    Concepts: [
      {
        id: 'g_concept_1',
        fields: {
          Name: 'B1-No headache-Taste Test',
          Angle: ['g_angle_1'],
          Personas: ['g_pers_1'],
          Product: ['g_prod_1'],
          Batch: 'B1',
          Status: 'Pending For Approval',
          'Production Status': 'Editing Concept',
        },
      },
    ],
    '(Internal) Creative Dimensions': [
      { id: 'g_dim_1', fields: { Name: '1:1', Dimensions: '1080x1080' } },
      { id: 'g_dim_2', fields: { Name: '9:16', Dimensions: '1080x1920' } },
    ],
    'Creative Briefs': [
      {
        id: 'g_brief_1',
        fields: {
          Name: 'TAS-TV1-B1-No headache-V1',
          Type: 'Image',
          Priority: 'Average (3 days)',
          'Internal Status': 'Video editing in progress Feriel',
          'Client Status': 'Pending for Approval',
          Language: 'English(USA)',
          Platform: ['Meta', 'Tiktok'],
          Dimensions: ['g_dim_1', 'g_dim_2'],
          Source: 'Facebook Reels',
          Funnel: 'TAS',
          Concept: ['g_concept_1'],
        },
      },
    ],
    Creators: [
      {
        id: 'g_creator_1',
        fields: {
          'Creator name (Filled by UGC Manager)': 'Marta',
          Status: 'Draft',
          'Creator Status': 'Waiting for assets',
          'Partnership Activity': 'Yes',
          'Concept to film': ['g_concept_1'],
        },
      },
    ],
    'Competitive research': [
      {
        id: 'g_comp_1',
        fields: { Name: 'Boxt', Type: 'Inspirations', Insta: '@boxt', 'FB Page': 'fb.com/boxt' },
      },
    ],
    'Client Assets Organisation': [
      {
        id: 'g_folder_1',
        fields: {
          'Name [Folder]': 'Brand shots',
          Description: 'Hero photography',
          Location: 'https://drive.example/x',
        },
      },
    ],
  };

  it('maps every live select label onto the domain keys, never a minted one', async () => {
    const db = await seeded();
    await importAirtableExport(db, GRATSI, DEMO_BRAND_ID, 'migration-actor');

    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'g_concept_1'));
    expect(concept?.approvalStatus).toBe('pending_client');
    expect(concept?.productionStatus).toBe('in_progress');

    const [brief] = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.legacyAirtableId, 'g_brief_1'));
    expect(brief?.internalStatus).toBe('video_editing_in_progress');
    expect(brief?.clientStatus).toBe('pending_for_approval');
    expect(brief?.type).toBe('Static');
    expect(brief?.priority).toBe('Static Average');
    expect(brief?.language).toBe('English');
    expect(brief?.platform).toEqual(['Meta', 'TikTok']);
    // Record-link dimensions resolve to the dimension NAMES, never recXXX ids.
    expect(brief?.dimensions).toEqual(['1:1', '9:16']);
    // Junk select options fall back to the column defaults instead of importing garbage.
    expect(brief?.source).toBe('TAS');
    expect(brief?.funnel).toBe('TOF');

    const [theme] = await db.select().from(themes).where(eq(themes.legacyAirtableId, 'g_theme_1'));
    expect(theme?.status).toBe('not_started');

    const [persona] = await db
      .select()
      .from(personas)
      .where(eq(personas.legacyAirtableId, 'g_pers_1'));
    expect(persona?.stageOfAwareness).toBe('unaware');
  });

  it('routes the two creator status tracks onto their real domains (they were swapped)', async () => {
    const db = await seeded();
    await importAirtableExport(db, GRATSI, DEMO_BRAND_ID, 'migration-actor');
    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'g_creator_1'));
    expect(creator?.clientStatus).toBe('draft');
    expect(creator?.internalCreatorStatus).toBe('approved');
    expect(creator?.partnershipActivity).toBe('active');
  });

  it('infers angle→persona/product junctions from the concept-held pairing', async () => {
    const db = await seeded();
    await importAirtableExport(db, GRATSI, DEMO_BRAND_ID, 'migration-actor');
    const [angle] = await db.select().from(angles).where(eq(angles.legacyAirtableId, 'g_angle_1'));
    if (!angle) throw new Error('angle missing');
    expect(
      await db.select().from(anglePersonas).where(eq(anglePersonas.angleId, angle.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(angleProducts).where(eq(angleProducts.angleId, angle.id)),
    ).toHaveLength(1);
  });

  it('imports the two previously-skipped tables and leaves frozen creative_dimensions alone', async () => {
    const db = await seeded();
    const results = await importAirtableExport(db, GRATSI, DEMO_BRAND_ID, 'migration-actor');
    expect(results.competitiveResearch?.imported).toBe(1);
    expect(results.clientAssetFolders?.imported).toBe(1);
    // Frozen at the single-source cutover (2026-10-09): the export's dimension NAMES still resolve
    // brief dimensions, but no creative_dimensions row is written.
    expect(results.creativeDimensions).toBeUndefined();
    expect(await db.select().from(creativeDimensions)).toHaveLength(0);

    const [comp] = await db
      .select()
      .from(competitiveResearch)
      .where(eq(competitiveResearch.legacyAirtableId, 'g_comp_1'));
    expect(comp?.type).toBe('Inspiration');
    expect(comp?.instagram).toBe('@boxt');
    const [folder] = await db
      .select()
      .from(clientAssetFolders)
      .where(eq(clientAssetFolders.legacyAirtableId, 'g_folder_1'));
    expect(folder?.name).toBe('Brand shots');
    expect(folder?.locationUrl).toBe('https://drive.example/x');
  });

  it('a re-import REPLACES junction sets, so a wrong link from the first run disappears', async () => {
    const db = await seeded();
    await importAirtableExport(db, GRATSI, DEMO_BRAND_ID, 'migration-actor');
    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'g_creator_1'));
    if (!creator) throw new Error('creator missing');
    // Fabricate the first import's damage: a creator linked to a concept it never filmed.
    const [strayConcept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.brandId, DEMO_BRAND_ID))
      .limit(1);
    if (!strayConcept) throw new Error('no concept');
    await db
      .insert(creatorConcepts)
      .values({ creatorId: creator.id, conceptId: strayConcept.id })
      .onConflictDoNothing();

    await importAirtableExport(db, GRATSI, DEMO_BRAND_ID, 'migration-actor');
    const links = await db
      .select()
      .from(creatorConcepts)
      .where(eq(creatorConcepts.creatorId, creator.id));
    const [gratsiConcept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'g_concept_1'));
    expect(links).toHaveLength(1);
    expect(links[0]?.conceptId).toBe(gratsiConcept?.id);
  });
});

describe('a re-import follows the base, it never keeps stale values (2026-10-01)', () => {
  it('a value cleared in Airtable becomes NULL on a nullable column', async () => {
    const db = await seeded();
    const withStatus: AirtableExport = {
      ...FIXTURE,
      Concepts: [
        {
          id: 'at_concept_1',
          fields: { ...FIXTURE.Concepts?.[0]?.fields, 'Production Status': 'Done' },
        },
      ],
    };
    await importAirtableExport(db, withStatus, DEMO_BRAND_ID, 'migration-actor');
    let [row] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    expect(row?.productionStatus).toBe('done');

    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    [row] = await db.select().from(concepts).where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    expect(row?.productionStatus).toBeNull();
  });

  it('a junk label on a NOT NULL column is overwritten with the column default on update', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    const [brief] = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.legacyAirtableId, 'at_brief_1'));
    if (!brief) throw new Error('brief missing');
    await db
      .update(creativeBriefs)
      .set({ source: 'Facebook Reels' as never, funnel: 'TAS' as never })
      .where(eq(creativeBriefs.id, brief.id));

    const junk: AirtableExport = {
      ...FIXTURE,
      'Creative Briefs': [
        {
          id: 'at_brief_1',
          fields: {
            ...FIXTURE['Creative Briefs']?.[0]?.fields,
            Source: 'Facebook Reels',
            Funnel: 'TAS',
          },
        },
      ],
    };
    await importAirtableExport(db, junk, DEMO_BRAND_ID, 'migration-actor');
    const [healed] = await db.select().from(creativeBriefs).where(eq(creativeBriefs.id, brief.id));
    expect(healed?.source).toBe('TAS');
    expect(healed?.funnel).toBe('TOF');
  });

  it('a blank creator track resets to its default instead of keeping a swapped key', async () => {
    const db = await seeded();
    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'at_creator_1'));
    if (!creator) throw new Error('creator missing');
    // The first import's damage: the client-track key sitting in the internal column.
    await db
      .update(creators)
      .set({ internalCreatorStatus: 'video_delivered' })
      .where(eq(creators.id, creator.id));

    await importAirtableExport(db, FIXTURE, DEMO_BRAND_ID, 'migration-actor');
    const [healed] = await db.select().from(creators).where(eq(creators.id, creator.id));
    expect(healed?.internalCreatorStatus).toBe('request');
  });
});

describe('Gratsi module parity: every live table imports (Prompt 3, 2026-10-01)', () => {
  /**
   * One record per new table, shaped like the live base's field dump (scratchpad
   * new-tables-fields.txt / gratsi-meta.json), with the links between them and a few of the
   * lookups and formulas Airtable ships alongside the stored fields.
   */
  const PARITY: AirtableExport = {
    Products: [
      {
        id: 'p_prod_1',
        fields: {
          'Product Name / Landing Page Name': 'Gratsi White',
          Link: 'https://gratsi.example/white',
        },
      },
    ],
    Collections: [
      {
        id: 'p_coll_1',
        fields: { 'Main Collection': 'Summer Whites', URL: 'https://gratsi.example/summer' },
      },
    ],
    'Campaigns & Offers': [
      {
        id: 'p_camp_1',
        fields: {
          Name: 'July 4-15% OFF-JULY15',
          Holiday: 'July 4',
          'Discount Offer': '15% OFF',
          Code: 'JULY15',
          // Named "Angles" in the base, links the CONCEPTS table.
          Angles: ['p_concept_1'],
          Product: ['Gratsi White'],
        },
      },
    ],
    Angles: [{ id: 'p_angle_1', fields: { Name: 'Summer sipping' } }],
    Concepts: [
      {
        id: 'p_concept_1',
        fields: { Name: 'B2-Summer sipping-Taste Test', Angle: ['p_angle_1'], Batch: 'B2' },
      },
    ],
    'Creative Briefs': [
      {
        id: 'p_brief_1',
        fields: {
          Name: 'TAS-SV1-B2-Summer sipping-V1',
          Type: 'Static',
          'Internal Status': 'Approved',
          'Client Status': 'Approved',
        },
      },
    ],
    '(Internal) Copy Type': [
      { id: 'p_ct_1', fields: { Name: 'Testimonial', Description: 'Customer words' } },
    ],
    Copywriting: [
      {
        id: 'p_meta_1',
        fields: {
          'Copy #': 'Copy 2',
          Descriptions: 'Chilled and ready',
          Status: 'Approved',
          'Copy Type': ['p_ct_1'],
          'Campaign Code': ['p_camp_1'],
          Creative: ['p_brief_1'],
          Offer: ['15% OFF'],
        },
      },
    ],
    'Youtube Copywriting': [
      {
        id: 'p_yt_1',
        fields: {
          'Copy #': 'Copy 7',
          Status: 'Edited By Client',
          Collections: ['p_coll_1'],
          Product: ['p_prod_1'],
          Angle: 'Summer sipping',
          'Descriptions (90 caractères max)': 'Pour, sip, repeat.',
          Headline: 'Boxed, better',
          'News Feed': 'Summer sampler',
          CTA: 'Get Offer',
          'Campaign Code': ['p_camp_1'],
          Offer: ['15% OFF'],
          Funnel: 'MOF & BOF',
          'Copy Type': ['p_ct_1'],
          USED: true,
          Winning: true,
          'Meta Rating': 4,
          'Created By': { id: 'usrAbc', email: 'c@tas.example', name: 'Copywriter' },
        },
      },
    ],
    '(Internal) Creative Modules': [
      {
        id: 'p_mod_1',
        fields: {
          'Module Name': 'Taste-test pattern',
          // Named "Concepts" in the base, links the ANGLES table.
          Concepts: ['p_angle_1'],
          'Foreplay Link': 'https://foreplay.co/board/1',
          '(Internal) Creative Design': ['p_brief_1'],
        },
      },
    ],
    'Creative Sheet': [
      {
        id: 'p_sheet_1',
        fields: {
          Name: 'September-TAS-SV1-B2-Summer sipping-V1',
          'Creative Name': ['p_brief_1'],
          'Performance (from Creative Name)': ['Winner'],
          'Internal Status': 'Static Design in Progress',
          Status: 'Revisions Submitted',
          'QA Checklist Doc': [{ url: 'https://dl.airtable.example/qa.pdf' }],
          'Video Editor QA': true,
          'Graphic Designer QA': false,
          "Client's Comments": 'Bigger logo please',
          Used: true,
          'Denied/revisions needed': true,
          Winning: 'Best Performing',
          Created: '2026-09-02T10:00:00.000Z',
          'Click for AI Spell Checker Again': true,
          'Spelling Feedback': 'No issues',
        },
      },
      // A sheet row whose brief is not in the export: lands with brief_id NULL, counted once.
      { id: 'p_sheet_2', fields: { 'Creative Name': ['recNotInExport'], Status: 'Denied' } },
    ],
    'SM Campaign Management Feed': [
      {
        id: 'p_sm_1',
        fields: {
          'Task Name': 'Post the July reel',
          Platform: 'Tiktok',
          'Due Date': '2026-07-03T15:00:00.000Z',
          Status: 'In progress',
          Notes: 'Vertical cut',
          'Reminder Trigger': 'No',
        },
      },
    ],
    'Email Campaigns Management': [
      {
        id: 'p_ec_1',
        fields: {
          Name: 'July 4 blast',
          'Campaign Purpose': 'Holiday promo',
          Status: 'Client: Design Pending for Approval',
          'Send Date': '2026-07-01',
          'Copywriting Due Date': '2026-06-21',
          Copywriting: 'Celebrate with a glass',
          'Design Due Date': '2026-06-26',
          Assignee: { id: 'usrEll', email: 'ella@tas.example', name: 'Ella' },
          'Copy Link': 'https://docs.example/copy',
          Design: [{ url: 'https://dl.airtable.example/design.png' }],
          'Klaviyo Link': 'https://klaviyo.example/1',
          Assets: [
            { url: 'https://dl.airtable.example/a1.png' },
            { url: 'https://dl.airtable.example/a2.png' },
          ],
          Type: 'Blog Post/Educational',
          Channel: 'Push Notification',
          'Campaigns & Offers': ['p_camp_1'],
          '(Internal) Product': ['p_prod_1'],
          '(Internal) Collections': ['p_coll_1'],
        },
      },
    ],
    'Email Flows Management': [
      {
        id: 'p_ef_1',
        fields: {
          'Flow Name': 'Welcome series',
          'Expected Setup Date': '2026-08-15',
          'Flow Purpose': 'Onboard new subscribers',
          Status: 'Live',
          Copywriting: 'Hi there',
          Design: [{ url: 'https://dl.airtable.example/flow.png' }],
          'Klaviyo Link': 'https://klaviyo.example/flow',
          Type: 'SMS',
          'Campaigns & Offers': ['p_camp_1'],
          Inspo: [{ url: 'https://dl.airtable.example/inspo.png' }],
          Assignee: { id: 'usrFin', name: 'Finn' },
        },
      },
    ],
    'Creative Reporting': [
      {
        id: 'p_rep_1',
        fields: {
          'Name + Angle + Offer': 'SV1 - Summer sipping - 15% OFF',
          Notes: 'Strong hook',
          'Ad Design': [{ url: 'https://dl.airtable.example/ad.png' }],
          'Ad Link': 'https://fb.example/ads/1',
          CTR: 0.0412,
          'Thumb-Stop Rate': 31.5,
          Results: 42,
          CPA: 18.75,
          'Target CPA': 20,
          'Difference CPA': -1.25,
          ROAS: 3.21,
          'Target ROAS': 3,
        },
      },
    ],
  };

  it('lands a row in every new table, with every select stored as its vocabulary key', async () => {
    const db = await seeded();
    const results = await importAirtableExport(db, PARITY, DEMO_BRAND_ID, 'migration-actor');

    for (const table of [
      'copyTypes',
      'youtubeCopy',
      'creativeModules',
      'smCampaignFeedTasks',
      'emailCampaigns',
      'emailFlows',
      'creativeReporting',
    ]) {
      expect(results[table]?.records, table).toBe(1);
      expect(results[table]?.imported, table).toBe(1);
      expect(results[table]?.failed, table).toBe(0);
    }
    // The Creative Sheet table is FROZEN (single-source cutover, 2026-10-09): the sheet is a view
    // over creative_briefs, so a re-import writes no sheet row, and the brief it would have linked
    // is imported as before.
    expect(results.creativeSheetItems).toBeUndefined();
    expect(await db.select().from(creativeSheetItems)).toHaveLength(0);
    const [brief] = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.legacyAirtableId, 'p_brief_1'));
    expect(brief).toBeDefined();

    const [yt] = await db
      .select()
      .from(youtubeCopy)
      .where(eq(youtubeCopy.legacyAirtableId, 'p_yt_1'));
    expect(yt?.copyNumber).toBe(7);
    expect(yt?.status).toBe('edited_by_client');
    expect(yt?.cta).toBe('get_offer');
    expect(yt?.funnel).toBe('mof_bof');
    expect(yt?.angle).toBe('Summer sipping');
    expect(yt?.metaRating).toBe(4);
    expect(yt?.winning).toBe(true);

    const [module] = await db
      .select()
      .from(creativeModules)
      .where(eq(creativeModules.legacyAirtableId, 'p_mod_1'));
    expect(module?.moduleName).toBe('Taste-test pattern');
    expect(module?.foreplayLink).toBe('https://foreplay.co/board/1');

    const [sm] = await db
      .select()
      .from(smCampaignFeedTasks)
      .where(eq(smCampaignFeedTasks.legacyAirtableId, 'p_sm_1'));
    expect(sm?.platform).toBe('tiktok');
    expect(sm?.status).toBe('in_progress');
    expect(sm?.dueDate).toEqual(new Date('2026-07-03T15:00:00.000Z'));

    const [ec] = await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.legacyAirtableId, 'p_ec_1'));
    expect(ec?.status).toBe('client_design_pending_for_approval');
    expect(ec?.type).toBe('blog_post_educational');
    expect(ec?.channel).toBe('push_notification');
    expect(ec?.sendDate).toBe('2026-07-01');
    expect(ec?.assigneeId).toBe('Ella');
    expect(ec?.assets).toEqual([
      'https://dl.airtable.example/a1.png',
      'https://dl.airtable.example/a2.png',
    ]);

    const [ef] = await db
      .select()
      .from(emailFlows)
      .where(eq(emailFlows.legacyAirtableId, 'p_ef_1'));
    expect(ef?.status).toBe('live');
    expect(ef?.type).toBe('sms');
    expect(ef?.expectedSetupDate).toBe('2026-08-15');
    expect(ef?.inspo).toEqual(['https://dl.airtable.example/inspo.png']);
    expect(ef?.assigneeId).toBe('Finn');

    const [report] = await db
      .select()
      .from(creativeReporting)
      .where(eq(creativeReporting.legacyAirtableId, 'p_rep_1'));
    expect(report?.nameAngleOffer).toBe('SV1 - Summer sipping - 15% OFF');
    expect(report?.briefId).toBeNull();
    expect(report?.ctr).toBe('0.0412');
    expect(report?.thumbStopRate).toBe('31.50');
    expect(report?.results).toBe('42.0');
    expect(report?.cpa).toBe('18.75');
    expect(report?.targetCpa).toBe('20.00');
    expect(report?.roas).toBe('3.21');
    expect(report?.targetRoas).toBe('3.0');
    expect(report?.adDesign).toEqual(['https://dl.airtable.example/ad.png']);

    const [copyType] = await db
      .select()
      .from(copyTypes)
      .where(eq(copyTypes.legacyAirtableId, 'p_ct_1'));
    expect(copyType?.name).toBe('Testimonial');
  });

  it('resolves every new junction, including the two links the base mis-names', async () => {
    const db = await seeded();
    await importAirtableExport(db, PARITY, DEMO_BRAND_ID, 'migration-actor');

    const one = async (
      table: PgTable & { legacyAirtableId: AnyPgColumn; id: AnyPgColumn },
      legacyId: string,
    ): Promise<string> => {
      const [row] = await db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.legacyAirtableId, legacyId));
      if (!row) throw new Error(`${legacyId} not imported`);
      return String(row.id);
    };
    const [angleId, conceptId, briefId, campaignId, productId, collectionId, copyTypeId] =
      await Promise.all([
        one(angles, 'p_angle_1'),
        one(concepts, 'p_concept_1'),
        one(creativeBriefs, 'p_brief_1'),
        one(campaignsOffers, 'p_camp_1'),
        one(products, 'p_prod_1'),
        one(collections, 'p_coll_1'),
        one(copyTypes, 'p_ct_1'),
      ]);
    const moduleId = await one(creativeModules, 'p_mod_1');
    const ytId = await one(youtubeCopy, 'p_yt_1');
    const metaId = await one(copywriting, 'p_meta_1');
    const ecId = await one(emailCampaigns, 'p_ec_1');
    const efId = await one(emailFlows, 'p_ef_1');

    // Creative Modules."Concepts" → angles; "(Internal) Creative Design" → briefs.
    expect(
      await db
        .select()
        .from(creativeModuleAngles)
        .where(eq(creativeModuleAngles.moduleId, moduleId)),
    ).toEqual([{ moduleId, angleId }]);
    expect(
      await db
        .select()
        .from(creativeModuleDesigns)
        .where(eq(creativeModuleDesigns.moduleId, moduleId)),
    ).toEqual([{ moduleId, briefId }]);

    // Campaigns & Offers."Angles" → concepts.
    expect(
      await db
        .select()
        .from(campaignConcepts)
        .where(eq(campaignConcepts.campaignOfferId, campaignId)),
    ).toEqual([{ campaignOfferId: campaignId, conceptId }]);

    // Youtube copy: Collections, Product, Campaign Code, Copy Type.
    expect(
      await db
        .select()
        .from(youtubeCopyCollections)
        .where(eq(youtubeCopyCollections.youtubeCopyId, ytId)),
    ).toEqual([{ youtubeCopyId: ytId, collectionId }]);
    expect(
      await db
        .select()
        .from(youtubeCopyProducts)
        .where(eq(youtubeCopyProducts.youtubeCopyId, ytId)),
    ).toEqual([{ youtubeCopyId: ytId, productId }]);
    expect(
      await db
        .select()
        .from(youtubeCopyCampaigns)
        .where(eq(youtubeCopyCampaigns.youtubeCopyId, ytId)),
    ).toEqual([{ youtubeCopyId: ytId, campaignOfferId: campaignId }]);
    expect(
      await db
        .select()
        .from(youtubeCopyCopyTypes)
        .where(eq(youtubeCopyCopyTypes.youtubeCopyId, ytId)),
    ).toEqual([{ youtubeCopyId: ytId, copyTypeId }]);

    // Meta copy: Copy Type and Campaign Code (the brief FK still lands through "Creative").
    expect(
      await db.select().from(copywritingCopyTypes).where(eq(copywritingCopyTypes.copyId, metaId)),
    ).toEqual([{ copyId: metaId, copyTypeId }]);
    expect(
      await db.select().from(copywritingCampaigns).where(eq(copywritingCampaigns.copyId, metaId)),
    ).toEqual([{ copyId: metaId, campaignOfferId: campaignId }]);
    const [meta] = await db.select().from(copywriting).where(eq(copywriting.id, metaId));
    expect(meta?.creativeBriefId).toBe(briefId);

    // Email campaigns: three junctions; email flows: one.
    expect(
      await db
        .select()
        .from(emailCampaignCampaigns)
        .where(eq(emailCampaignCampaigns.emailCampaignId, ecId)),
    ).toEqual([{ emailCampaignId: ecId, campaignOfferId: campaignId }]);
    expect(
      await db
        .select()
        .from(emailCampaignProducts)
        .where(eq(emailCampaignProducts.emailCampaignId, ecId)),
    ).toEqual([{ emailCampaignId: ecId, productId }]);
    expect(
      await db
        .select()
        .from(emailCampaignCollections)
        .where(eq(emailCampaignCollections.emailCampaignId, ecId)),
    ).toEqual([{ emailCampaignId: ecId, collectionId }]);
    expect(
      await db.select().from(emailFlowCampaigns).where(eq(emailFlowCampaigns.emailFlowId, efId)),
    ).toEqual([{ emailFlowId: efId, campaignOfferId: campaignId }]);
  });

  it('a re-run upserts every new table in place and rebuilds its junctions without duplicates', async () => {
    const db = await seeded();
    await importAirtableExport(db, PARITY, DEMO_BRAND_ID, 'migration-actor');
    const countAll = async () =>
      Promise.all([
        db.select().from(youtubeCopy),
        db.select().from(creativeSheetItems),
        db.select().from(creativeModules),
        db.select().from(emailCampaigns),
        db.select().from(emailFlows),
        db.select().from(creativeReporting),
        db.select().from(smCampaignFeedTasks),
        db.select().from(copyTypes),
        db.select().from(youtubeCopyCollections),
        db.select().from(creativeModuleAngles),
        db.select().from(campaignConcepts),
        db.select().from(emailCampaignProducts),
        db.select().from(emailFlowCampaigns),
        db.select().from(copywritingCopyTypes),
      ]).then((sets) => sets.map((rows) => rows.length));
    const before = await countAll();

    const results = await importAirtableExport(db, PARITY, DEMO_BRAND_ID, 'migration-actor');

    for (const table of [
      'copyTypes',
      'youtubeCopy',
      'creativeModules',
      'smCampaignFeedTasks',
      'emailCampaigns',
      'emailFlows',
      'creativeReporting',
    ]) {
      expect(results[table]?.imported, table).toBe(0);
      expect(results[table]?.updated, table).toBe(1);
    }
    expect(results.creativeSheetItems).toBeUndefined();
    expect(await countAll()).toEqual(before);
  });

  it('reports every exported field no mapper or pass-2 step read, and nothing one did', async () => {
    const db = await seeded();
    const warnings = emptyWarnings();
    await importAirtableExport(db, PARITY, DEMO_BRAND_ID, 'migration-actor', warnings);

    // The Creative Sheet is a frozen table (single-source cutover, 2026-10-09): nothing of it is
    // read, so nothing of it is reported field by field — the skip is one general note instead.
    expect(warnings.unmappedFields.has('Creative Sheet')).toBe(false);
    expect(warnings.general.some((note) => note.startsWith('Creative Sheet: frozen table'))).toBe(
      true,
    );

    expect(
      warnings.unmappedFields.get('SM Campaign Management Feed')?.get('Reminder Trigger'),
    ).toBe(1);
    expect(warnings.unmappedFields.get('Creative Reporting')?.get('Difference CPA')).toBe(1);
    expect(warnings.unmappedFields.get('Email Campaigns Management')?.get('Design Due Date')).toBe(
      1,
    );
    const yt = warnings.unmappedFields.get('Youtube Copywriting');
    expect(yt?.get('Offer')).toBe(1);
    expect(yt?.get('Created By')).toBe(1);
    expect(yt?.has('Campaign Code')).toBe(false);
    expect(warnings.unmappedFields.get('Campaigns & Offers')?.has('Angles')).toBe(false);
    // Every field of a Creative Module is read, so the table has no entry at all.
    expect(warnings.unmappedFields.has('(Internal) Creative Modules')).toBe(false);

    // No sheet row is written, so no sheet link can be broken.
    expect(warnings.brokenRefs.has("creativeSheetItems.'Creative Name'")).toBe(false);
  });
  it('stores the Gratsi-only fields: angle status, concept description/pain points/USP/client comments, creator payment date/info request/Slack flag, campaign promotional ideas', async () => {
    const db = await seeded();
    const fixture: AirtableExport = {
      ...FIXTURE,
      Angles: [
        { id: 'at_angle_1', fields: { ...FIXTURE.Angles?.[0]?.fields, Status: 'Needs Revisions' } },
      ],
      Concepts: [
        {
          id: 'at_concept_1',
          fields: {
            ...FIXTURE.Concepts?.[0]?.fields,
            Decription: 'Reframe the rota as the problem',
            'Pain Points': 'Cannot sleep in daylight',
            USP: 'Pressure without heat',
            "Client's Comments": 'Keep the uniforms generic',
          },
        },
      ],
      Creators: [
        {
          id: 'at_creator_1',
          fields: {
            ...FIXTURE.Creators?.[0]?.fields,
            'Payment Date': '2026-09-12',
            'Creator Info Request': 'Send the shipping address',
            'Slack Notified ': true,
          },
        },
      ],
      'Campaigns & Offers': [
        {
          id: 'at_camp_1',
          fields: {
            ...FIXTURE['Campaigns & Offers']?.[0]?.fields,
            'Promotional Ideas': 'Bundle the pillow',
          },
        },
      ],
      'Creative Briefs': [
        {
          id: 'at_brief_1',
          fields: {
            ...FIXTURE['Creative Briefs']?.[0]?.fields,
            Performance: 'Winning (ROAS/CPA Goal)',
          },
        },
      ],
    };
    await importAirtableExport(db, fixture, DEMO_BRAND_ID, 'migration-actor');

    const [angle] = await db.select().from(angles).where(eq(angles.legacyAirtableId, 'at_angle_1'));
    expect(angle?.status).toBe('needs_revisions');
    const [concept] = await db
      .select()
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, 'at_concept_1'));
    expect(concept).toMatchObject({
      description: 'Reframe the rota as the problem',
      painPoints: 'Cannot sleep in daylight',
      usp: 'Pressure without heat',
      clientComments: 'Keep the uniforms generic',
    });
    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.legacyAirtableId, 'at_creator_1'));
    expect(creator?.paymentDate?.toISOString().slice(0, 10)).toBe('2026-09-12');
    expect(creator?.creatorInfoRequest).toBe('Send the shipping address');
    expect(creator?.slackNotified).toBe(true);
    const [campaign] = await db
      .select()
      .from(campaignsOffers)
      .where(eq(campaignsOffers.legacyAirtableId, 'at_camp_1'));
    expect(campaign?.promotionalIdeas).toBe('Bundle the pillow');
    const [brief] = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.legacyAirtableId, 'at_brief_1'));
    expect(brief?.performance).toBe('Winning');
  });
  it("reads persona fields from either base: the template names, and Gratsi's renamed aliases, land in the same columns", async () => {
    const db = await seeded();
    const fixture: AirtableExport = {
      ...FIXTURE,
      Personas: [
        {
          // The TEMPLATE base (appnaSGAgOUbJ0f9m) spells every field with its framework in
          // parentheses. A short-name read missed eleven of these.
          id: 'at_pers_template',
          fields: {
            'Persona Name': 'Template Pat',
            'A Day in the Life': 'Up at six, school run, back by nine',
            Demographic: '35-44, salaried, two kids',
            Psychographic: 'Risk averse, researches everything',
            'Core Desires (Cashvertising)': 'To stop waking at 3am',
            'Emotional Triggers (Cashvertising)': 'Being told it is just her age',
            'Pain Points (Cashvertising)': 'Wakes every ninety minutes',
            'Success Factors (Buyer Personas)': 'Sleeps through by week two',
            'Perceived Barriers (Buyer Personas)': 'Has returned two blankets already',
            'Stage of Market Awareness (Breakthrough Advertising)': 'Problem-aware',
            'Buying Triggers (Breakthrough Advertising)': 'A ninety-night trial',
            'Problem/Challenge (StoryBrand)': 'Cannot stay asleep',
            'Success/Transformation (StoryBrand)': 'Wakes once, not four times',
            'Trigger Words (Mindstates)': 'Drenched. Weighted. Ninety nights.',
          },
        },
        {
          // The GRATSI client base (appllDG4OmkK2Hdnn) renamed five of them and carries only seven.
          id: 'at_pers_gratsi',
          fields: {
            Name: 'Gratsi Gina',
            'Description  [Age Status Salary]': '25-34, hospitality, hourly',
            Personality: 'Sociable, spontaneous',
            'Drivers for this persona': 'Wants the table to feel like a holiday',
            Passion: 'Natural wine and long lunches',
            'Problem-Solution Awareness Level': 'Problem-aware',
          },
        },
      ],
    };
    await importAirtableExport(db, fixture, DEMO_BRAND_ID, 'migration-actor');

    const [template] = await db
      .select()
      .from(personas)
      .where(eq(personas.legacyAirtableId, 'at_pers_template'));
    expect(template).toMatchObject({
      name: 'Template Pat',
      dayInTheLife: 'Up at six, school run, back by nine',
      coreDesires: 'To stop waking at 3am',
      emotionalTriggers: 'Being told it is just her age',
      painPoints: 'Wakes every ninety minutes',
      successFactors: 'Sleeps through by week two',
      perceivedBarriers: 'Has returned two blankets already',
      buyingTriggers: 'A ninety-night trial',
      problemChallenge: 'Cannot stay asleep',
      successTransformation: 'Wakes once, not four times',
      triggerWords: 'Drenched. Weighted. Ninety nights.',
    });

    const [gratsi] = await db
      .select()
      .from(personas)
      .where(eq(personas.legacyAirtableId, 'at_pers_gratsi'));
    // The five renamed Gratsi fields land in the template's columns...
    expect(gratsi).toMatchObject({
      name: 'Gratsi Gina',
      demographic: '25-34, hospitality, hourly',
      psychographic: 'Sociable, spontaneous',
      coreDesires: 'Wants the table to feel like a holiday',
    });
    // ...and "Passion" is NOT forced into one. It has no template equivalent, so it stays
    // unimported with a decision-doc entry rather than displacing Core Desires, which is the bug
    // this replaced: Gratsi's Passion used to land in coreDesires and Drivers in emotionalTriggers.
    expect(gratsi?.coreDesires).not.toContain('Natural wine');
    expect(gratsi?.emotionalTriggers).toBeNull();
    // Nine template fields have no Gratsi source at all, so they are legitimately empty.
    expect(gratsi).toMatchObject({ dayInTheLife: null, painPoints: null, triggerWords: null });
  });
});

/**
 * The concept's two LINK fields, read from EITHER base.
 *
 * Pass 2 read `rec.fields.Angle` and `rec.fields.Theme` only. The template base
 * (`appnaSGAgOUbJ0f9m`) names those fields `Angles` and `Themes` — plural, read live off the meta
 * API on 2026-10-04 — so a template import wrote zero `concept_angles` and zero `concept_themes`,
 * and every concept's Angle and Theme cell on the Concepts grid was an em dash. Nothing failed and
 * nothing was logged: a field the engine never asks for cannot report a broken reference.
 *
 * Gratsi's singular names are asserted beside the plural ones in the same test, because the one
 * thing an alias list must never do is fix one base by breaking the other — and a wrong alias here
 * is unusually expensive, since pass 2 CLEARS a concept's junction rows before re-inserting them
 * (`import-slicing-hazard`: a re-run that resolves nothing deletes the links it cannot restore).
 */
describe('concept links read either base’s field name (action item 35)', () => {
  const BOTH: AirtableExport = {
    Angles: [
      { id: 'at_angle_plural', fields: { Name: 'It Is Not Just Your Age' } },
      { id: 'at_angle_singular', fields: { Name: 'Your Body Clock Is Not Broken' } },
    ],
    Themes: [
      { id: 'at_theme_plural', fields: { Name: 'Authority' } },
      { id: 'at_theme_singular', fields: { Name: 'Green Screen' } },
    ],
    Concepts: [
      {
        // The TEMPLATE base: both links plural, both record-link arrays.
        id: 'at_concept_template',
        fields: {
          Name: 'B1-Template',
          Batch: 'B1',
          Angles: ['at_angle_plural'],
          Themes: ['at_theme_plural'],
        },
      },
      {
        // The GRATSI base: both links singular, which is what used to be the only name read.
        id: 'at_concept_gratsi',
        fields: {
          Name: 'B2-Gratsi',
          Batch: 'B2',
          Angle: ['at_angle_singular'],
          Theme: ['at_theme_singular'],
        },
      },
    ],
  };

  async function linksOf(
    db: Awaited<ReturnType<typeof seeded>>,
    legacyId: string,
  ): Promise<{ angleIds: string[]; themeIds: string[] }> {
    const [concept] = await db
      .select({ id: concepts.id })
      .from(concepts)
      .where(eq(concepts.legacyAirtableId, legacyId));
    if (concept === undefined) throw new Error(`${legacyId} was not imported`);
    const angleRows = await db
      .select({ angleId: conceptAngles.angleId })
      .from(conceptAngles)
      .where(eq(conceptAngles.conceptId, concept.id));
    const themeRows = await db
      .select({ themeId: conceptThemes.themeId })
      .from(conceptThemes)
      .where(eq(conceptThemes.conceptId, concept.id));
    return {
      angleIds: angleRows.map((row) => row.angleId),
      themeIds: themeRows.map((row) => row.themeId),
    };
  }

  async function idOf(
    db: Awaited<ReturnType<typeof seeded>>,
    table: typeof angles | typeof themes,
    legacyId: string,
  ): Promise<string> {
    const [row] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.legacyAirtableId, legacyId));
    if (row === undefined) throw new Error(`${legacyId} was not imported`);
    return row.id;
  }

  it('writes the junctions for the plural TEMPLATE names and the singular Gratsi ones alike', async () => {
    const db = await seeded();
    await importAirtableExport(db, BOTH, DEMO_BRAND_ID, 'migration-actor');

    const template = await linksOf(db, 'at_concept_template');
    expect(template.angleIds).toEqual([await idOf(db, angles, 'at_angle_plural')]);
    expect(template.themeIds).toEqual([await idOf(db, themes, 'at_theme_plural')]);

    const gratsi = await linksOf(db, 'at_concept_gratsi');
    expect(gratsi.angleIds).toEqual([await idOf(db, angles, 'at_angle_singular')]);
    expect(gratsi.themeIds).toEqual([await idOf(db, themes, 'at_theme_singular')]);
  });

  it('COUNTS an angle or theme reference that resolves to nothing instead of dropping it', async () => {
    const db = await seeded();
    const warnings = emptyWarnings();
    const broken: AirtableExport = {
      ...BOTH,
      Concepts: [
        {
          id: 'at_concept_broken',
          fields: {
            Name: 'B3-Broken',
            Batch: 'B3',
            // Two record ids that are not in the export at all — the shape a sliced import makes.
            Angles: ['at_angle_plural', 'recNOTINEXPORT1'],
            Themes: ['recNOTINEXPORT2'],
          },
        },
      ],
    };

    await importAirtableExport(db, broken, DEMO_BRAND_ID, 'migration-actor', warnings);

    expect(warnings.brokenRefs.get('concepts.Angles')).toBe(1);
    expect(warnings.brokenRefs.get('concepts.Themes')).toBe(1);
    // The reference that DID resolve is still written: a broken sibling drops nothing.
    const links = await linksOf(db, 'at_concept_broken');
    expect(links.angleIds).toEqual([await idOf(db, angles, 'at_angle_plural')]);
  });

  /**
   * Reading through an alias list must not make the import claim it read everything.
   *
   * `trackExport` counts field reads with a Proxy, so a resolver that ENUMERATES the record marks
   * every key as read and the "fields no mapper touched" report comes back empty for that table —
   * the report going quiet looks exactly like a table with nothing left behind. `firstField` tries
   * the exact names before it ever enumerates, which is what keeps the two apart.
   */
  it('leaves the unread-field report honest for a table read through aliases', async () => {
    const db = await seeded();
    const warnings = emptyWarnings();
    const withExtra: AirtableExport = {
      ...BOTH,
      Concepts: [
        {
          id: 'at_concept_template',
          fields: {
            ...BOTH.Concepts?.[0]?.fields,
            'Last Modified By': 'someone@tasdigital.com',
          },
        },
      ],
    };

    await importAirtableExport(db, withExtra, DEMO_BRAND_ID, 'migration-actor', warnings);

    const unread = warnings.unmappedFields.get('Concepts');
    expect(unread?.get('Last Modified By')).toBe(1);
    // The two links were read, under their plural names, so neither is reported unread.
    expect(unread?.has('Angles')).toBe(false);
    expect(unread?.has('Themes')).toBe(false);
  });
});
