import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { campaignConcepts, copywritingCampaigns } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/** Index names from `pg_indexes` for one table; a primary key's index carries the constraint's name. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/**
 * Drizzle wraps a driver error as `Failed query: ...` and keeps the Postgres error in `cause`, where
 * the constraint name is. Resolves to that message so a test can name the constraint it expects.
 */
async function rejection(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error: unknown) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return cause instanceof Error ? cause.message : String(cause);
  }
  throw new Error('expected the query to be rejected');
}

describe('campaign link junctions on PGlite', () => {
  it('creates copywriting_campaigns and campaign_concepts with their composite primary keys', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'copywriting_campaigns')).toEqual([
      'copywriting_campaigns_copy_id_campaign_offer_id_pk',
    ]);
    expect(await indexNames(db, 'campaign_concepts')).toEqual([
      'campaign_concepts_campaign_offer_id_concept_id_pk',
    ]);
  });

  it('links a seeded copy and concept to a seeded campaign, and rejects an unknown campaign', async () => {
    const db = await testDb();
    const { copy, concepts, campaigns } = await seed(db);
    const [aCopy, aConcept, aCampaign] = [copy[0], concepts[0], campaigns[0]];
    if (aCopy === undefined || aConcept === undefined || aCampaign === undefined) {
      throw new Error('seed returned no copy, concept or campaign');
    }
    const unknownCampaign = '00000000-0000-4000-8000-000000000000';

    await db
      .insert(copywritingCampaigns)
      .values({ copyId: aCopy.id, campaignOfferId: aCampaign.id });
    await db
      .insert(campaignConcepts)
      .values({ campaignOfferId: aCampaign.id, conceptId: aConcept.id });

    expect(await db.select().from(copywritingCampaigns)).toContainEqual({
      copyId: aCopy.id,
      campaignOfferId: aCampaign.id,
    });
    expect(await db.select().from(campaignConcepts)).toContainEqual({
      campaignOfferId: aCampaign.id,
      conceptId: aConcept.id,
    });
    expect(
      await rejection(
        db
          .insert(campaignConcepts)
          .values({ campaignOfferId: unknownCampaign, conceptId: aConcept.id }),
      ),
    ).toMatch(/campaign_concepts_campaign_offer_id_campaigns_offers_id_fk/);
  });
});
