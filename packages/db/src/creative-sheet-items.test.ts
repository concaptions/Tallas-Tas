import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { insertBrief, listBriefs, updateBrief } from './briefs';
import {
  getCreativeSheetItemById,
  listCreativeSheetItems,
  sheetRowFromBrief,
} from './creative-sheet-items';
import { DEMO_BRAND_ID, demoBriefs } from './demo-data';
import { demoCreativeSheetItems } from './demo-creative-sheet-items';
import { creativeSheetName } from './formulas';
import { creativeBriefs } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/**
 * The Creative Sheet as a VIEW over `creative_briefs` (single-source cutover, 2026-10-09). There
 * is no second table to drift from any more: a row is a live brief, named by the month formula,
 * and the 19 production briefs that never had a legacy sheet row are on the sheet like the rest.
 */
const ACTOR = 'user_2TESTACTOR';

async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('the Creative Sheet view over creative_briefs', () => {
  it('lists one row per live brief of the brand, newest edit first, sheet row or not', async () => {
    const { db, brandId } = await seeded();
    const briefs = await listBriefs(db, brandId);
    expect(briefs.length).toBeGreaterThan(0);

    const before = await listCreativeSheetItems(db, brandId);
    expect(before.map((row) => row.id).sort()).toEqual(briefs.map((brief) => brief.id).sort());
    const updated = before.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));

    // A brief that never had a legacy sheet row (the 19 at the cutover) is on the sheet at once.
    const fresh = await insertBrief(db, brandId, { name: 'TAS-TOF-V099-Fresh' }, ACTOR);
    const after = await listCreativeSheetItems(db, brandId);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]?.id).toBe(fresh.id);
  });

  it('counts the same as the live briefs of EACH brand — the two never diverge', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    for (const brand of [brandId, otherBrandId]) {
      const briefs = await listBriefs(db, brand);
      const rows = await listCreativeSheetItems(db, brand);
      expect(rows).toHaveLength(briefs.length);
    }
  });

  it('reads every status, flag, checklist and ratio from the brief itself', async () => {
    const { db, brandId } = await seeded();
    const brief = await insertBrief(
      db,
      brandId,
      {
        name: 'TAS-TOF-V042-Read-Through',
        internalStatus: 'ad_submitted',
        clientStatus: 'revisions_needed',
        qaVideoEditor: true,
        qaStrategist: true,
        clickForAiSpellChecker: true,
        spellingFeedback: 'teh → the',
        qaChecklistDoc: ['https://docs.example/qa'],
        dimensions: ['9:16', '1:1'],
      },
      ACTOR,
    );

    const row = await getCreativeSheetItemById(db, brandId, brief.id);
    expect(row).toMatchObject({
      id: brief.id,
      briefId: brief.id,
      brandId,
      internalStatus: 'ad_submitted',
      status: 'revisions_needed',
      qaVideoEditor: true,
      qaDesigner: false,
      qaStrategist: true,
      spellCheckRequested: true,
      spellingFeedback: 'teh → the',
      qaChecklistDoc: ['https://docs.example/qa'],
      dimensions: ['9:16', '1:1'],
      briefName: 'TAS-TOF-V042-Read-Through',
      briefType: 'Video',
      briefFunnel: 'TOF',
    });
    expect(row?.name).toBe(creativeSheetName(brief.createdAt, brief.name));

    // An edit on the brief is on the sheet on the next read: there is nothing to sync.
    await updateBrief(db, brandId, brief.id, { qaDesigner: true, dimensions: ['4:5'] }, ACTOR);
    expect(await getCreativeSheetItemById(db, brandId, brief.id)).toMatchObject({
      qaDesigner: true,
      dimensions: ['4:5'],
    });
  });

  it('returns nothing for another brand, and nothing once a brief is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const brief = await insertBrief(db, brandId, { name: 'TAS-TOF-V043-Scoped' }, ACTOR);

    expect(await getCreativeSheetItemById(db, otherBrandId, brief.id)).toBeNull();
    const otherRows = await listCreativeSheetItems(db, otherBrandId);
    expect(otherRows.some((row) => row.id === brief.id)).toBe(false);

    await db
      .update(creativeBriefs)
      .set({ deletedAt: new Date() })
      .where(eq(creativeBriefs.id, brief.id));
    expect(await getCreativeSheetItemById(db, brandId, brief.id)).toBeNull();
    expect((await listCreativeSheetItems(db, brandId)).some((row) => row.id === brief.id)).toBe(
      false,
    );
  });
});

describe('demoCreativeSheetItems', () => {
  it('are the demo briefs, one row each, in the demo brand, newest edit first', () => {
    expect(demoCreativeSheetItems).toHaveLength(demoBriefs.length);
    expect(demoCreativeSheetItems.every((row) => row.brandId === DEMO_BRAND_ID)).toBe(true);
    expect(new Set(demoCreativeSheetItems.map((row) => row.id)).size).toBe(demoBriefs.length);
    const updated = demoCreativeSheetItems.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('are named by the formula and read every field from the brief fixture', () => {
    for (const row of demoCreativeSheetItems) {
      const brief = demoBriefs.find((candidate) => candidate.id === row.id);
      if (brief === undefined) throw new Error(`no demo brief ${row.id}`);
      expect(row).toEqual(sheetRowFromBrief(brief));
      expect(row.name).toBe(creativeSheetName(brief.createdAt, brief.name));
      expect(row.status).toBe(brief.clientStatus);
      expect(row.internalStatus).toBe(brief.internalStatus);
    }
  });

  it('are what a seeded database lists for the demo brand', async () => {
    const { db, brandId } = await seeded();
    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listCreativeSheetItems(db, brandId);
    expect(rows.map((row) => row.id).sort()).toEqual(
      demoCreativeSheetItems.map((row) => row.id).sort(),
    );
    for (const row of rows) {
      const fixture = demoCreativeSheetItems.find((candidate) => candidate.id === row.id);
      expect(row).toMatchObject({
        name: fixture?.name,
        internalStatus: fixture?.internalStatus,
        status: fixture?.status,
        dimensions: fixture?.dimensions,
      });
    }
  });
});
