import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { emailCampaignCampaigns, emailCampaigns } from './schema/email-campaigns';
import { seed } from './seed';
import { withBrand } from './tenancy';
import { testDb } from './testing';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(
  db: Awaited<ReturnType<typeof testDb>>,
  table: string,
): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
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
