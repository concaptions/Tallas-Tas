import { describe, expect, it } from 'vitest';

import { healthCheck } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

describe('seed', () => {
  it('applies the migrations, inserts one health_check row and reads it back', async () => {
    const db = await testDb();

    const seeded = await seed(db);
    const rows = await db.select().from(healthCheck);

    expect(rows).toEqual([seeded]);
    expect(seeded.note).toBe('seeded by @tas/db db:seed');
  });

  it('fills the shared columns from their defaults', async () => {
    const db = await testDb();

    const row = await seed(db);

    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
    expect(row).toMatchObject({ brandId: null, createdBy: null, updatedBy: null, deletedAt: null });
  });
});
