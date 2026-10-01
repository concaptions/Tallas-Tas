import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_BRAND_ID } from './demo-data';
import { demoEmailCampaigns } from './demo-email-campaigns';
import {
  emailCampaignDueDates,
  getEmailCampaignById,
  insertEmailCampaign,
  listEmailCampaigns,
  syncEmailCampaignCampaigns,
  syncEmailCampaignCollections,
  syncEmailCampaignProducts,
  updateEmailCampaign,
  type EmailCampaignInput,
  type EmailCampaignListRow,
} from './email-campaigns';
import { emailCampaignCampaigns, emailCampaigns, products, type EmailCampaign } from './schema';
import { seed, type SeedResult } from './seed';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/** The first row of a seeded list, past `noUncheckedIndexedAccess`. */
function first<T>(rows: readonly T[], what: string): T {
  const [row] = rows;
  if (row === undefined) throw new Error(`${what} is empty`);
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<
  { db: PgliteDb; brandId: string; otherBrandId: string } & SeedResult
> {
  const db = await testDb();
  const result = await seed(db);
  return { db, brandId: result.childBrand.id, otherBrandId: result.templateBrand.id, ...result };
}

describe('email_campaigns migration on PGlite', () => {
  it('creates the table with its brand and template-row indexes, and the three junctions', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'email_campaigns')).toEqual([
      'email_campaigns_brand_id_idx',
      'email_campaigns_pkey',
      'email_campaigns_template_row_id_idx',
    ]);
    // A junction's only index is its composite primary key; its presence proves the table exists.
    expect(await indexNames(db, 'email_campaign_campaigns')).toEqual([
      'email_campaign_campaigns_email_campaign_id_campaign_offer_id_pk',
    ]);
    expect(await indexNames(db, 'email_campaign_products')).toEqual([
      'email_campaign_products_email_campaign_id_product_id_pk',
    ]);
    expect(await indexNames(db, 'email_campaign_collections')).toEqual([
      'email_campaign_collections_email_campaign_id_collection_id_pk',
    ]);
  });
});

describe('email_campaigns through withBrand', () => {
  it('inserts into the scoped brand and reads the row back from that brand only', async () => {
    const db = await testDb();
    const { childBrand, templateBrand } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    const [inserted] = await scope
      .insert(emailCampaigns, {
        name: 'BFCM Early Access',
        status: 'copywriting',
        sendDate: '2026-11-20',
        type: 'sale_campaign',
        channel: 'email',
        design: ['https://r2.example/email/bfcm-early-access.png'],
      })
      .returning();

    expect(inserted).toMatchObject({
      brandId: childBrand.id,
      name: 'BFCM Early Access',
      status: 'copywriting',
      sendDate: '2026-11-20',
      type: 'sale_campaign',
      channel: 'email',
      design: ['https://r2.example/email/bfcm-early-access.png'],
      deletedAt: null,
    });
    expect(
      await scope.select(emailCampaigns, eq(emailCampaigns.name, 'BFCM Early Access')),
    ).toHaveLength(1);
    expect(await withBrand(db, templateBrand.id).select(emailCampaigns)).toHaveLength(0);
  });

  it('links an email campaign to one of the brand’s campaign offers through the junction', async () => {
    const db = await testDb();
    const { childBrand, campaigns } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    const [campaign] = await scope.insert(emailCampaigns, { name: 'Cyber Monday' }).returning();
    const [offer] = campaigns;
    if (campaign === undefined || offer === undefined) throw new Error('setup rows are missing');
    await db
      .insert(emailCampaignCampaigns)
      .values({ emailCampaignId: campaign.id, campaignOfferId: offer.id });

    expect(
      await db
        .select()
        .from(emailCampaignCampaigns)
        .where(eq(emailCampaignCampaigns.emailCampaignId, campaign.id)),
    ).toEqual([{ emailCampaignId: campaign.id, campaignOfferId: offer.id }]);
  });
});

describe('emailCampaignDueDates', () => {
  it('puts design due five days and copywriting due ten days before the send', () => {
    expect(emailCampaignDueDates('2026-11-20')).toEqual({
      designDueDate: '2026-11-15',
      copywritingDueDate: '2026-11-10',
    });
  });

  it('crosses a month and a year boundary by calendar days, in UTC', () => {
    expect(emailCampaignDueDates('2026-03-03')).toEqual({
      designDueDate: '2026-02-26',
      copywritingDueDate: '2026-02-21',
    });
    expect(emailCampaignDueDates('2027-01-04')).toEqual({
      designDueDate: '2026-12-30',
      copywritingDueDate: '2026-12-25',
    });
  });

  it('has no due dates without a send date', () => {
    expect(emailCampaignDueDates(null)).toEqual({ designDueDate: null, copywritingDueDate: null });
  });
});

describe('email campaign queries', () => {
  it('lists nothing for a freshly seeded brand, then the inserted row with its lookups', async () => {
    const { db, brandId, campaigns, products: seededProducts, collections } = await seeded();
    const offer = first(campaigns, 'campaigns');
    const product = first(seededProducts, 'products');
    const collection = first(collections, 'collections');

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(await listEmailCampaigns(db, brandId)).toEqual([]);

    const created = await insertEmailCampaign(
      db,
      brandId,
      {
        name: 'BFCM Early Access — VIP list',
        status: 'template_design',
        sendDate: '2026-11-20',
        assigneeId: 'user_seed_designer',
        type: 'sale_campaign',
        channel: 'email',
      },
      'user_test',
    );
    expect(await syncEmailCampaignCampaigns(db, brandId, created.id, [offer.id])).toEqual([
      offer.id,
    ]);
    expect(await syncEmailCampaignProducts(db, brandId, created.id, [product.id])).toEqual([
      product.id,
    ]);
    expect(await syncEmailCampaignCollections(db, brandId, created.id, [collection.id])).toEqual([
      collection.id,
    ]);

    const rows = await listEmailCampaigns(db, brandId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: created.id,
      brandId,
      name: 'BFCM Early Access — VIP list',
      designDueDate: '2026-11-15',
      copywritingDueDate: '2026-11-10',
      assigneeName: 'Rhiannon Okafor',
      campaignOfferIds: [offer.id],
      campaignOfferNames: [offer.name],
      productIds: [product.id],
      productNames: [product.name],
      collectionIds: [collection.id],
      collectionNames: [collection.name],
    });
    expect(await getEmailCampaignById(db, brandId, created.id)).toEqual(rows[0]);
  });

  it('orders newest edit first and resolves an unknown assignee to no name', async () => {
    const { db, brandId } = await seeded();
    const older = await insertEmailCampaign(db, brandId, { name: 'Older' }, 'user_test');
    const newer = await insertEmailCampaign(
      db,
      brandId,
      { name: 'Newer', assigneeId: 'user_who_left' },
      'user_test',
    );
    await updateEmailCampaign(db, brandId, older.id, { name: 'Older, edited' }, 'user_test');

    const rows = await listEmailCampaigns(db, brandId);

    expect(rows.map((row) => row.name)).toEqual(['Older, edited', 'Newer']);
    expect(rows.find((row) => row.id === newer.id)).toMatchObject({
      assigneeId: 'user_who_left',
      assigneeName: null,
      designDueDate: null,
      copywritingDueDate: null,
    });
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const created = await insertEmailCampaign(db, brandId, { name: 'Isolated' }, 'user_test');

    expect(await listEmailCampaigns(db, otherBrandId)).toEqual([]);
    expect(await getEmailCampaignById(db, otherBrandId, created.id)).toBeNull();

    await db
      .update(emailCampaigns)
      .set({ deletedAt: new Date() })
      .where(eq(emailCampaigns.id, created.id));

    expect(await listEmailCampaigns(db, brandId)).toEqual([]);
    expect(await getEmailCampaignById(db, brandId, created.id)).toBeNull();
  });

  it('insertEmailCampaign forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = { name: 'Smuggled', brandId: otherBrandId } as unknown as EmailCampaignInput;

    const row = await insertEmailCampaign(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'Smuggled',
      status: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listEmailCampaigns(db, brandId)).toHaveLength(1);
    expect(await listEmailCampaigns(db, otherBrandId)).toEqual([]);
  });

  it('updateEmailCampaign cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const created = await insertEmailCampaign(db, brandId, { name: 'Mine' }, 'user_test');

    const escaped = await updateEmailCampaign(
      db,
      otherBrandId,
      created.id,
      { name: 'Hijacked' },
      'thief',
    );
    const own = await updateEmailCampaign(
      db,
      brandId,
      created.id,
      { status: 'scheduled', sendDate: '2026-12-01' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: created.id,
      brandId,
      name: 'Mine',
      status: 'scheduled',
      sendDate: '2026-12-01',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });

  it('a junction sync replaces the links, drops foreign ids, and refuses another brand’s owner', async () => {
    const { db, brandId, otherBrandId, products: seededProducts } = await seeded();
    const [one, two] = seededProducts;
    if (one === undefined || two === undefined) throw new Error('seeded products are missing');
    const created = await insertEmailCampaign(db, brandId, { name: 'Linked' }, 'user_test');
    const [foreign] = await withBrand(db, otherBrandId)
      .insert(products, { name: 'Foreign', link: 'https://elsewhere.example/p' })
      .returning();
    if (foreign === undefined) throw new Error('foreign product insert returned no row');

    // Another brand's product id is silently dropped; a duplicate id is stored once.
    expect(
      await syncEmailCampaignProducts(db, brandId, created.id, [
        one.id,
        foreign.id,
        one.id,
        two.id,
      ]),
    ).toEqual([one.id, two.id]);
    // The sync is a replace, not a merge.
    expect(await syncEmailCampaignProducts(db, brandId, created.id, [two.id])).toEqual([two.id]);
    expect((await getEmailCampaignById(db, brandId, created.id))?.productNames).toEqual([two.name]);
    // The other brand cannot relink a row it does not own.
    expect(await syncEmailCampaignProducts(db, otherBrandId, created.id, [foreign.id])).toBeNull();
    expect((await getEmailCampaignById(db, brandId, created.id))?.productIds).toEqual([two.id]);
    // Clearing works, and a soft-deleted target vanishes from the row without a sync.
    expect(await syncEmailCampaignProducts(db, brandId, created.id, [])).toEqual([]);
    expect(await syncEmailCampaignProducts(db, brandId, created.id, [one.id])).toEqual([one.id]);
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, one.id));
    expect((await getEmailCampaignById(db, brandId, created.id))?.productNames).toEqual([]);
  });

  it('exposes one row type for demo fixtures and database rows, and fixtures that agree with the formulas', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoEmailCampaigns).toEqualTypeOf<EmailCampaignListRow[]>();
    expectTypeOf(await listEmailCampaigns(db, brandId)).toEqualTypeOf<EmailCampaignListRow[]>();
    expectTypeOf<EmailCampaignListRow>().toExtend<EmailCampaign>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<EmailCampaignInput>().not.toHaveProperty('brandId');
    expectTypeOf<EmailCampaignInput>().not.toHaveProperty('createdBy');
    expectTypeOf<EmailCampaignInput>().toHaveProperty('sendDate');

    expect(demoEmailCampaigns).toHaveLength(5);
    for (const row of demoEmailCampaigns) {
      expect(row.brandId).toBe(DEMO_BRAND_ID);
      expect(emailCampaignDueDates(row.sendDate)).toEqual({
        designDueDate: row.designDueDate,
        copywritingDueDate: row.copywritingDueDate,
      });
      expect(row.campaignOfferIds).toHaveLength(row.campaignOfferNames.length);
      expect(row.productIds).toHaveLength(row.productNames.length);
      expect(row.collectionIds).toHaveLength(row.collectionNames.length);
    }
    // Newest edit first, as the query returns them.
    const updated = demoEmailCampaigns.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });
});
