import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_BRAND_ID, demoCampaigns, demoUsers } from './demo-data';
import {
  DEMO_EMAIL_FLOW_CAMPAIGN_BFCM_ID,
  DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID,
  demoEmailFlows,
} from './demo-email-flows';
import {
  emailFlowDueDates,
  getEmailFlowById,
  insertEmailFlow,
  listEmailFlowCampaignIds,
  listEmailFlows,
  syncEmailFlowCampaigns,
  updateEmailFlow,
  type EmailFlowInput,
  type EmailFlowListRow,
} from './email-flows';
import { campaignsOffers } from './schema/campaigns';
import { emailFlowCampaigns, emailFlows, type EmailFlow } from './schema/email-flows';
import { seed } from './seed';
import { withBrand, type ScopedInsertValue } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/** The first fixture — the abandoned-cart flow, the one with a campaign link — past `noUncheckedIndexedAccess`. */
function abandonedCart(): EmailFlowListRow {
  const [row] = demoEmailFlows;
  if (row === undefined) throw new Error('demoEmailFlows is empty');
  return row;
}

/** A fixture row minus `brand_id` (the scope's) and the five derived columns the query computes. */
function storedColumns(row: EmailFlowListRow): ScopedInsertValue<typeof emailFlows> {
  const rest: Record<string, unknown> = { ...row };
  delete rest['brandId'];
  delete rest['campaignIds'];
  delete rest['campaignNames'];
  delete rest['assigneeName'];
  delete rest['designDueDate'];
  delete rest['copywritingDueDate'];
  return rest as ScopedInsertValue<typeof emailFlows>;
}

/**
 * A fresh database with every migration applied, the demo content seeded into the child brand, and
 * the email-flow fixtures written on top of it (the shared seed does not carry this table), links
 * included.
 */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  await withBrand(db, childBrand.id).insert(emailFlows, demoEmailFlows.map(storedColumns));
  const links = demoEmailFlows.flatMap((flow) =>
    flow.campaignIds.map((campaignOfferId) => ({ emailFlowId: flow.id, campaignOfferId })),
  );
  if (links.length > 0) await db.insert(emailFlowCampaigns).values(links);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
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

describe('emailFlowDueDates', () => {
  it('puts design five days and copywriting ten days before the expected setup date', () => {
    expect(emailFlowDueDates('2026-10-20')).toEqual({
      designDueDate: '2026-10-15',
      copywritingDueDate: '2026-10-10',
    });
  });

  it('crosses a month boundary as calendar days, in UTC', () => {
    expect(emailFlowDueDates('2026-03-04')).toEqual({
      designDueDate: '2026-02-27',
      copywritingDueDate: '2026-02-22',
    });
  });

  it('is null without a setup date, and null for a value that is not a calendar date', () => {
    expect(emailFlowDueDates(null)).toEqual({ designDueDate: null, copywritingDueDate: null });
    expect(emailFlowDueDates('next week')).toEqual({
      designDueDate: null,
      copywritingDueDate: null,
    });
  });
});

describe('email flow queries', () => {
  it('lists the four fixtures row for row, links, assignee names and due dates included', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoEmailFlows).toHaveLength(4);
    expect(await listEmailFlows(db, brandId)).toEqual(demoEmailFlows);
  });

  it('orders newest edit first and derives every column the fixtures spell out', async () => {
    const { db, brandId } = await seeded();

    const rows = await listEmailFlows(db, brandId);

    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
    for (const row of rows) {
      expect(row).toMatchObject(emailFlowDueDates(row.expectedSetupDate));
      expect(row.campaignNames).toEqual([...row.campaignNames].sort((a, b) => a.localeCompare(b)));
      expect(row.campaignIds).toHaveLength(row.campaignNames.length);
    }
    // The fixtures' campaign ids are the demo campaigns', so the names come from real rows.
    const campaignIds = new Set(demoCampaigns.map((campaign) => campaign.id));
    expect(campaignIds.has(DEMO_EMAIL_FLOW_CAMPAIGN_BFCM_ID)).toBe(true);
    expect(campaignIds.has(DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID)).toBe(true);
    // The assignee is a seeded Clerk id, resolved to that person's name; unassigned stays null.
    const names = new Map(demoUsers.map((user) => [user.clerkUserId, user.fullName]));
    for (const row of rows) {
      expect(row.assigneeName).toBe(row.assigneeId === null ? null : names.get(row.assigneeId));
    }
    expect(rows.filter((row) => row.assigneeName === null)).toHaveLength(1);
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = abandonedCart();

    expect(await listEmailFlows(db, otherBrandId)).toEqual([]);
    expect(await getEmailFlowById(db, otherBrandId, target.id)).toBeNull();

    await db
      .update(emailFlows)
      .set({ deletedAt: new Date() })
      .where(sql`${emailFlows.id} = ${target.id}`);

    expect(await listEmailFlows(db, brandId)).toHaveLength(3);
    expect(await getEmailFlowById(db, brandId, target.id)).toBeNull();
  });

  it('drops a link whose campaign is soft-deleted, so names only ever come from live rows', async () => {
    const { db, brandId } = await seeded();
    const target = abandonedCart();

    expect((await getEmailFlowById(db, brandId, target.id))?.campaignNames).toEqual([
      'BFCM-20%OFF-BFCM26',
    ]);

    await db
      .update(campaignsOffers)
      .set({ deletedAt: new Date() })
      .where(sql`true`);

    const row = await getEmailFlowById(db, brandId, target.id);
    expect(row?.campaignIds).toEqual([]);
    expect(row?.campaignNames).toEqual([]);
  });

  it('insertEmailFlow forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      flowName: 'Smuggled flow',
      status: 'copywriting',
      brandId: otherBrandId,
    } as unknown as EmailFlowInput;

    const row = await insertEmailFlow(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      flowName: 'Smuggled flow',
      status: 'copywriting',
      expectedSetupDate: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listEmailFlows(db, brandId)).toHaveLength(5);
    expect(await listEmailFlows(db, otherBrandId)).toEqual([]);
    // A fresh row has no links, no assignee and no due dates: nulls and empties, never undefined.
    expect(await getEmailFlowById(db, brandId, row.id)).toMatchObject({
      campaignIds: [],
      campaignNames: [],
      assigneeName: null,
      designDueDate: null,
      copywritingDueDate: null,
    });
  });

  it('updateEmailFlow cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = abandonedCart();

    const escaped = await updateEmailFlow(
      db,
      otherBrandId,
      target.id,
      { flowName: 'Hijacked' },
      'thief',
    );
    const own = await updateEmailFlow(
      db,
      brandId,
      target.id,
      { status: 'design_submitted', expectedSetupDate: '2026-10-25' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      flowName: target.flowName,
      status: 'design_submitted',
      expectedSetupDate: '2026-10-25',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
    // The due dates follow the new setup date on the next read.
    expect(await getEmailFlowById(db, brandId, target.id)).toMatchObject({
      designDueDate: '2026-10-20',
      copywritingDueDate: '2026-10-15',
    });
  });

  it('syncEmailFlowCampaigns replaces the links, keeps only the brand’s campaigns, and refuses another brand', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = abandonedCart();
    const [foreign] = await withBrand(db, otherBrandId)
      .insert(campaignsOffers, { name: 'Elsewhere-10%OFF-ELSE' })
      .returning();
    if (foreign === undefined) throw new Error('foreign campaign was not inserted');

    // Delete-then-insert: the BFCM link goes, Valentine arrives, the foreign id and the duplicate
    // are dropped on the floor.
    expect(
      await syncEmailFlowCampaigns(db, brandId, target.id, [
        DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID,
        DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID,
        foreign.id,
      ]),
    ).toBe(true);
    expect(await listEmailFlowCampaignIds(db, target.id)).toEqual([
      DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID,
    ]);
    expect((await getEmailFlowById(db, brandId, target.id))?.campaignNames).toEqual([
      'Valentine-15%OFF-VDAY27',
    ]);

    // Another brand cannot rewrite the links of a flow it does not own.
    expect(
      await syncEmailFlowCampaigns(db, otherBrandId, target.id, [DEMO_EMAIL_FLOW_CAMPAIGN_BFCM_ID]),
    ).toBe(false);
    expect(await listEmailFlowCampaignIds(db, target.id)).toEqual([
      DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID,
    ]);

    // An empty list clears every link.
    expect(await syncEmailFlowCampaigns(db, brandId, target.id, [])).toBe(true);
    expect(
      await db
        .select()
        .from(emailFlowCampaigns)
        .where(eq(emailFlowCampaigns.emailFlowId, target.id)),
    ).toEqual([]);
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoEmailFlows).toEqualTypeOf<EmailFlowListRow[]>();
    expectTypeOf(await listEmailFlows(db, brandId)).toEqualTypeOf<EmailFlowListRow[]>();
    expectTypeOf<EmailFlowListRow>().toExtend<EmailFlow>();
    expectTypeOf<EmailFlowListRow['designDueDate']>().toEqualTypeOf<string | null>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<EmailFlowInput>().not.toHaveProperty('brandId');
    expectTypeOf<EmailFlowInput>().not.toHaveProperty('createdBy');
    expectTypeOf<EmailFlowInput>().toHaveProperty('flowName');
    expectTypeOf<EmailFlowInput>().toHaveProperty('klaviyoLink');
  });
});
