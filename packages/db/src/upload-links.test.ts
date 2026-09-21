import { describe, expect, it } from 'vitest';

import { DEMO_BRAND_ID, demoUploadLinks } from './demo-data';
import { seed } from './seed';
import { testDb } from './testing';
import { getUploadLinkByToken, insertUploadLink, listUploadLinks } from './upload-links';

async function seeded() {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('upload link queries', () => {
  it('seeds demo links and lists them', async () => {
    const { db, brandId } = await seeded();
    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listUploadLinks(db, brandId);
    expect(rows).toHaveLength(demoUploadLinks.length);
  });

  it('finds a link by token', async () => {
    const { db } = await seeded();
    const first = demoUploadLinks[0];
    if (first === undefined) throw new Error('no demo upload links');
    const row = await getUploadLinkByToken(db, first.token);
    expect(row).not.toBeNull();
    expect(row?.label).toBe(first.label);
  });

  it('inserts a new link and retrieves it', async () => {
    const { db, brandId } = await seeded();
    const link = await insertUploadLink(
      db,
      brandId,
      {
        token: 'tok_test_new',
        label: 'Test Upload',
        recipientName: null,
        recipientEmail: null,
        maxUploads: '5',
        expiresAt: null,
        isActive: true,
        uploadsUsed: '0',
        notes: null,
      },
      'actor_test',
    );
    expect(link.label).toBe('Test Upload');
    const all = await listUploadLinks(db, brandId);
    expect(all.find((r) => r.id === link.id)).toBeDefined();
  });

  it('cross-brand isolation: another brand sees no links', async () => {
    const { db, otherBrandId } = await seeded();
    const rows = await listUploadLinks(db, otherBrandId);
    expect(rows).toHaveLength(0);
  });
});
