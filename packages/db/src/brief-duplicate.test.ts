import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { duplicateBrief, listBriefs } from './briefs';
import { creativeBriefs } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

const RESET = {
  name: 'TV9-B1-A Fresh Copy-Educational Content-V1',
  sequence: 99,
  internalStatus: 'sent_to_video_editor',
  clientStatus: 'pending_for_approval',
};

describe('duplicateBrief', () => {
  it('copies the editable fields but takes the given name and number, and resets status/launch/QA', async () => {
    const { db, brandId } = await seeded();
    // A launched, QA-ticked source so the reset is observable.
    const [source] = await db
      .insert(creativeBriefs)
      .values({
        brandId,
        name: 'ORIGINAL',
        batch: 'B1',
        funnel: 'Retargeting',
        type: 'Static',
        version: 3,
        sequence: 4,
        assignee: 'Dorian Vance',
        briefToDesign: 'carry me over',
        internalStatus: 'approved',
        clientStatus: 'launched',
        launchedAt: new Date('2026-09-20T00:00:00Z'),
        launchPriority: 2,
        qaVideoEditor: true,
        qaDesigner: true,
        qaStrategist: true,
        performance: 'Winning',
      })
      .returning();
    if (source === undefined) throw new Error('source');

    const copy = await duplicateBrief(db, brandId, source.id, RESET, 'user_buyer');
    if (copy === null) throw new Error('no copy');

    expect(copy.id).not.toBe(source.id);
    // Carried over.
    expect(copy.batch).toBe('B1');
    expect(copy.funnel).toBe('Retargeting');
    expect(copy.type).toBe('Static');
    expect(copy.version).toBe(3);
    expect(copy.assignee).toBe('Dorian Vance');
    expect(copy.briefToDesign).toBe('carry me over');
    // Regenerated / reset.
    expect(copy.name).toBe(RESET.name);
    expect(copy.sequence).toBe(99);
    expect(copy.internalStatus).toBe('sent_to_video_editor');
    expect(copy.clientStatus).toBe('pending_for_approval');
    expect(copy.launchedAt).toBeNull();
    expect(copy.launchPriority).toBeNull();
    expect(copy.performance).toBeNull();
    expect(copy.qaVideoEditor).toBe(false);
    expect(copy.qaDesigner).toBe(false);
    expect(copy.qaStrategist).toBe(false);
    expect(copy.createdBy).toBe('user_buyer');
  });

  it('adds exactly one live brief to the brand', async () => {
    const { db, brandId } = await seeded();
    const before = await listBriefs(db, brandId);
    const [source] = before;
    if (source === undefined) throw new Error('no seeded brief');

    await duplicateBrief(db, brandId, source.id, RESET, 'user_buyer');

    const after = await listBriefs(db, brandId);
    expect(after).toHaveLength(before.length + 1);
    expect(after.filter((b) => b.name === RESET.name)).toHaveLength(1);
  });

  it("cannot duplicate another brand's brief: the scoped read finds nothing", async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const [mine] = await listBriefs(db, brandId);
    if (mine === undefined) throw new Error('no seeded brief');

    const copy = await duplicateBrief(db, otherBrandId, mine.id, RESET, 'thief');

    expect(copy).toBeNull();
    // And nothing was written into the other brand.
    const theirs = await listBriefs(db, otherBrandId);
    expect(theirs.some((b) => b.name === RESET.name)).toBe(false);
  });

  it('is null for a soft-deleted source', async () => {
    const { db, brandId } = await seeded();
    const [source] = await listBriefs(db, brandId);
    if (source === undefined) throw new Error('no seeded brief');
    await db
      .update(creativeBriefs)
      .set({ deletedAt: new Date() })
      .where(eq(creativeBriefs.id, source.id));

    expect(await duplicateBrief(db, brandId, source.id, RESET, 'user')).toBeNull();
  });
});
