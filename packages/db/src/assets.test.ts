import { describe, expect, it } from 'vitest';

import { getAssetById, insertAsset, listAssets, listConceptAssets } from './assets';
import { DEMO_BRAND_ID, demoAssets } from './demo-data';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('asset queries', () => {
  it('seeds demo assets and lists them', async () => {
    const { db, brandId } = await seeded();
    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listAssets(db, brandId);
    expect(rows).toHaveLength(demoAssets.length);
  });

  it('gets a single asset by id', async () => {
    const { db, brandId } = await seeded();
    const first = demoAssets[0];
    if (first === undefined) throw new Error('no demo assets');
    const row = await getAssetById(db, brandId, first.id);
    expect(row).not.toBeNull();
    if (row === null) throw new Error('unreachable');
    expect(row.filename).toBe(first.filename);
  });

  it('lists assets scoped to a concept', async () => {
    const { db, brandId } = await seeded();
    const linked = demoAssets.filter(
      (a): a is typeof a & { conceptId: string } => a.conceptId !== null,
    );
    if (linked[0] === undefined) throw new Error('no linked assets');
    const rows = await listConceptAssets(db, brandId, linked[0].conceptId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.conceptId).toBe(linked[0].conceptId);
    }
  });

  it('inserts a new asset and retrieves it', async () => {
    const { db, brandId } = await seeded();
    const asset = await insertAsset(
      db,
      brandId,
      {
        filename: 'test-upload.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 500_000,
        r2Key: `${brandId}/test/test-upload.jpg`,
        url: '/test/test-upload.jpg',
        category: 'broll',
        conceptId: null,
        caption: 'Test upload',
      },
      'actor_test',
    );
    expect(asset.filename).toBe('test-upload.jpg');
    const fetched = await getAssetById(db, brandId, asset.id);
    expect(fetched).not.toBeNull();
  });

  it('cross-brand isolation: another brand sees no assets', async () => {
    const { db, otherBrandId } = await seeded();
    const rows = await listAssets(db, otherBrandId);
    expect(rows).toHaveLength(0);
  });
});
