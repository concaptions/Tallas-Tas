import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { insertRegistryCreator } from '../creator-registry-queries';
import { creatorRegistry } from '../schema';
import { testDb } from '../testing';
import { findRegistryMatch } from './registry-match';

const STRICT = { nameMatchRequiresBrands: true };
const LOOSE = { nameMatchRequiresBrands: false };

describe('findRegistryMatch', () => {
  it('matches on the Instagram handle before anything else', async () => {
    const db = await testDb();
    const ada = await insertRegistryCreator(db, {
      name: 'Someone Else',
      normalizedInstagram: 'ada',
    });
    await insertRegistryCreator(db, { name: 'Ada Lovelace', totalBrands: 2 });

    const match = await findRegistryMatch(
      db,
      { normalizedInstagram: 'ada', name: 'Ada Lovelace' },
      STRICT,
    );

    expect(match.by).toBe('instagram');
    expect(match.row?.id).toBe(ada.id);
  });

  it('falls back to a case-insensitive name match', async () => {
    const db = await testDb();
    const ada = await insertRegistryCreator(db, { name: 'Ada Lovelace', totalBrands: 1 });

    const match = await findRegistryMatch(
      db,
      { normalizedInstagram: null, name: '  ADA lovelace ' },
      STRICT,
    );

    expect(match).toMatchObject({ by: 'name', row: { id: ada.id } });
  });

  it('refuses a name-only match on a row with no brands when the import rule is on', async () => {
    const db = await testDb();
    await insertRegistryCreator(db, { name: 'John Smith', totalBrands: 0 });

    expect(
      await findRegistryMatch(db, { normalizedInstagram: null, name: 'John Smith' }, STRICT),
    ).toEqual({
      by: 'none',
      row: null,
    });
    expect(
      (await findRegistryMatch(db, { normalizedInstagram: null, name: 'John Smith' }, LOOSE)).by,
    ).toBe('name');
  });

  it('never matches a blank name or a soft-deleted row', async () => {
    const db = await testDb();
    const gone = await insertRegistryCreator(db, { name: 'Gone Person', totalBrands: 3 });
    await db
      .update(creatorRegistry)
      .set({ deletedAt: new Date() })
      .where(eq(creatorRegistry.id, gone.id));

    expect(
      (await findRegistryMatch(db, { normalizedInstagram: null, name: '   ' }, LOOSE)).by,
    ).toBe('none');
    expect(
      (await findRegistryMatch(db, { normalizedInstagram: null, name: 'Gone Person' }, LOOSE)).by,
    ).toBe('none');
  });
});
