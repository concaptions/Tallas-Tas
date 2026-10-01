import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { emailFlowCampaigns, emailFlows } from './schema/email-flows';
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

describe('email_flows migration on PGlite', () => {
  it('creates the table with its brand and template-row indexes, and the campaigns junction', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'email_flows')).toEqual([
      'email_flows_brand_id_idx',
      'email_flows_pkey',
      'email_flows_template_row_id_idx',
    ]);
    // A junction's only index is its composite primary key; its presence proves the table exists.
    expect(await indexNames(db, 'email_flow_campaigns')).toEqual([
      'email_flow_campaigns_email_flow_id_campaign_offer_id_pk',
    ]);
  });
});

describe('email_flows through withBrand', () => {
  it('inserts into the scoped brand and reads the row back from that brand only', async () => {
    const db = await testDb();
    const { childBrand, templateBrand } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    const [inserted] = await scope
      .insert(emailFlows, {
        flowName: 'Welcome Series',
        status: 'template_design',
        expectedSetupDate: '2026-10-15',
        type: 'email',
        inspo: ['https://r2.example/email/welcome-inspo.png'],
      })
      .returning();

    expect(inserted).toMatchObject({
      brandId: childBrand.id,
      flowName: 'Welcome Series',
      status: 'template_design',
      expectedSetupDate: '2026-10-15',
      type: 'email',
      inspo: ['https://r2.example/email/welcome-inspo.png'],
      deletedAt: null,
    });
    expect(await scope.select(emailFlows, eq(emailFlows.flowName, 'Welcome Series'))).toHaveLength(
      1,
    );
    expect(await withBrand(db, templateBrand.id).select(emailFlows)).toHaveLength(0);
  });

  it('links an email flow to one of the brand’s campaign offers through the junction', async () => {
    const db = await testDb();
    const { childBrand, campaigns } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    const [flow] = await scope.insert(emailFlows, { flowName: 'Abandoned Cart' }).returning();
    const [offer] = campaigns;
    if (flow === undefined || offer === undefined) throw new Error('setup rows are missing');
    await db.insert(emailFlowCampaigns).values({ emailFlowId: flow.id, campaignOfferId: offer.id });

    expect(
      await db.select().from(emailFlowCampaigns).where(eq(emailFlowCampaigns.emailFlowId, flow.id)),
    ).toEqual([{ emailFlowId: flow.id, campaignOfferId: offer.id }]);
  });
});
