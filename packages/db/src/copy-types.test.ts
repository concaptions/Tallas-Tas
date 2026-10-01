import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getCopyTypeById,
  insertCopyType,
  listCopyTypes,
  listCopywritingCopyTypeIds,
  syncCopywritingCopyTypes,
  syncCopywritingCopyTypesInBrand,
  updateCopyType,
  type CopyTypeInput,
  type CopyTypeListRow,
} from './copy-types';
import { demoCopyTypes } from './demo-copy-types';
import { DEMO_BRAND_ID, demoCopy } from './demo-data';
import { demoYoutubeCopy } from './demo-youtube-copy';
import {
  copyTypes,
  copywriting,
  copywritingCopyTypes,
  youtubeCopy,
  youtubeCopyCopyTypes,
  type CopyType,
} from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand, type ScopedInsertValue } from './tenancy';
import { syncYoutubeCopyCopyTypes } from './youtube-copy';

/** The first demo copy type — Problem / Agitate / Solve, two copies per channel — past `noUncheckedIndexedAccess`. */
function demoCopyType(): CopyTypeListRow {
  const [row] = demoCopyTypes;
  if (row === undefined) throw new Error('demoCopyTypes is empty');
  return row;
}

/** The first seeded Meta copy row, the one the fixtures tag with the first copy type. */
function firstMetaCopy(): { id: string; copyNumber: number } {
  const [row] = demoCopy;
  if (row === undefined) throw new Error('demoCopy is empty');
  return row;
}

/**
 * A fixture's stored columns: the row without the derived link arrays and without `brandId`, which
 * the scope supplies. The same literal-key strip `seed.ts` does for every other derived column.
 */
function storedColumns(fixture: CopyTypeListRow): ScopedInsertValue<typeof copyTypes> {
  const rest: Record<string, unknown> = { ...fixture };
  delete rest['metaCopies'];
  delete rest['youtubeCopies'];
  delete rest['brandId'];
  return rest as ScopedInsertValue<typeof copyTypes>;
}

/**
 * A fresh database with every migration applied, the demo content seeded into the child brand (Meta
 * copy included), the sibling YouTube copy fixtures written in with their ids, and the copy-type
 * fixtures written in with their links — `seed()` knows neither table, so the test does what the
 * seed would: scoped inserts, then the two junction syncs from the copy side that owns them.
 */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  const scope = withBrand(db, childBrand.id);
  for (const row of demoYoutubeCopy) {
    await scope.insert(youtubeCopy, {
      id: row.id,
      copyNumber: row.copyNumber,
      headline: row.headline,
    });
  }
  for (const fixture of demoCopyTypes) {
    await scope.insert(copyTypes, storedColumns(fixture));
  }
  const byMetaCopy = new Map<string, string[]>();
  const byYoutubeCopy = new Map<string, string[]>();
  for (const fixture of demoCopyTypes) {
    for (const copy of fixture.metaCopies) {
      byMetaCopy.set(copy.id, [...(byMetaCopy.get(copy.id) ?? []), fixture.id]);
    }
    for (const copy of fixture.youtubeCopies) {
      byYoutubeCopy.set(copy.id, [...(byYoutubeCopy.get(copy.id) ?? []), fixture.id]);
    }
  }
  for (const [copyId, ids] of byMetaCopy) await syncCopywritingCopyTypes(db, copyId, ids);
  for (const [copyId, ids] of byYoutubeCopy) await syncYoutubeCopyCopyTypes(db, copyId, ids);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('demoCopyTypes fixtures', () => {
  it('is four rows on the demo brand in updated_at descending order, links in Copy # order', () => {
    expect(demoCopyTypes).toHaveLength(4);
    expect(demoCopyTypes.every((row) => row.brandId === DEMO_BRAND_ID)).toBe(true);

    const updated = demoCopyTypes.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));

    for (const row of demoCopyTypes) {
      for (const list of [row.metaCopies, row.youtubeCopies]) {
        const numbers = list.map((copy) => copy.copyNumber);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      }
    }
    // The optional column is visibly optional, and one type has no copy yet: a real zero.
    expect(demoCopyTypes.filter((row) => row.description === null)).toHaveLength(1);
    expect(
      demoCopyTypes.filter((row) => row.metaCopies.length === 0 && row.youtubeCopies.length === 0),
    ).toHaveLength(1);
  });

  it('reads every linked headline off the copy fixtures rather than retyping it', () => {
    for (const row of demoCopyTypes) {
      for (const copy of row.metaCopies) {
        expect(demoCopy.find((candidate) => candidate.id === copy.id)?.headline).toBe(
          copy.headline,
        );
      }
      for (const copy of row.youtubeCopies) {
        expect(demoYoutubeCopy.find((candidate) => candidate.id === copy.id)?.headline).toBe(
          copy.headline,
        );
      }
    }
  });
});

describe('copy type queries', () => {
  it('lists the four fixtures row for row, links included, newest edit first', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listCopyTypes(db, brandId);
    expect(rows).toEqual(demoCopyTypes);

    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('resolves one copy type by id with both lists, and null for an unknown id', async () => {
    const { db, brandId } = await seeded();
    const target = demoCopyType();

    const row = await getCopyTypeById(db, brandId, target.id);

    expect(row).toEqual(target);
    expect(row?.metaCopies.map((copy) => copy.copyNumber)).toEqual([1, 3]);
    expect(row?.youtubeCopies.map((copy) => copy.copyNumber)).toEqual([1, 2]);
    expect(await getCopyTypeById(db, brandId, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('drops a link whose copy is no longer live, and restores it when the copy is', async () => {
    const { db, brandId } = await seeded();
    const target = demoCopyType();
    const doomed = firstMetaCopy();

    await db
      .update(copywriting)
      .set({ deletedAt: new Date() })
      .where(sql`${copywriting.id} = ${doomed.id}`);
    const without = await getCopyTypeById(db, brandId, target.id);
    expect(without?.metaCopies.map((copy) => copy.copyNumber)).toEqual([3]);
    expect(without?.youtubeCopies).toHaveLength(2);

    await db
      .update(copywriting)
      .set({ deletedAt: null })
      .where(sql`true`);
    expect((await getCopyTypeById(db, brandId, target.id))?.metaCopies).toHaveLength(2);
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoCopyType();

    expect(await listCopyTypes(db, otherBrandId)).toEqual([]);
    expect(await getCopyTypeById(db, otherBrandId, target.id)).toBeNull();

    await db
      .update(copyTypes)
      .set({ deletedAt: new Date() })
      .where(sql`${copyTypes.id} = ${target.id}`);

    expect(await listCopyTypes(db, brandId)).toHaveLength(3);
    expect(await getCopyTypeById(db, brandId, target.id)).toBeNull();
  });

  it('never surfaces another brand’s copy through a junction, on either channel', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoCopyType();
    const other = withBrand(db, otherBrandId);
    const [theirMeta] = await other
      .insert(copywriting, { copyNumber: 9, headline: 'Their Meta copy' })
      .returning();
    const [theirYoutube] = await other
      .insert(youtubeCopy, { copyNumber: 9, headline: 'Their YouTube copy' })
      .returning();
    if (theirMeta === undefined || theirYoutube === undefined) throw new Error('no copy row');
    // The raw syncs have no scope: the junction rows exist, and the scoped read must not name them.
    await syncCopywritingCopyTypes(db, theirMeta.id, [target.id]);
    await syncYoutubeCopyCopyTypes(db, theirYoutube.id, [target.id]);

    const row = await getCopyTypeById(db, brandId, target.id);

    expect(row?.metaCopies.map((copy) => copy.id)).not.toContain(theirMeta.id);
    expect(row?.youtubeCopies.map((copy) => copy.id)).not.toContain(theirYoutube.id);
    expect(row).toEqual(target);
  });

  it('round-trips the Meta junction through the sync helper: replace, shrink, clear', async () => {
    const { db, brandId } = await seeded();
    const [first, second, third] = demoCopyTypes;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('fixtures missing');
    }
    const copy = firstMetaCopy();

    // Tag the first Meta copy with the second and third types instead: delete-then-insert.
    await syncCopywritingCopyTypes(db, copy.id, [second.id, third.id]);
    expect(await listCopywritingCopyTypeIds(db, copy.id)).toEqual([second.id, third.id]);
    expect(
      (await getCopyTypeById(db, brandId, first.id))?.metaCopies.map((c) => c.id),
    ).not.toContain(copy.id);
    expect((await getCopyTypeById(db, brandId, second.id))?.metaCopies.map((c) => c.id)).toContain(
      copy.id,
    );
    // The YouTube side is untouched by a Meta sync.
    expect((await getCopyTypeById(db, brandId, first.id))?.youtubeCopies).toEqual(
      first.youtubeCopies,
    );

    await syncCopywritingCopyTypes(db, copy.id, []);
    expect(await listCopywritingCopyTypeIds(db, copy.id)).toEqual([]);
    expect((await getCopyTypeById(db, brandId, second.id))?.metaCopies).toEqual(second.metaCopies);
  });

  it('the scoped sync drops a foreign or repeated copy type id before it reaches the junction', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const copy = firstMetaCopy();
    const own = demoCopyType();
    const [theirs] = await withBrand(db, otherBrandId)
      .insert(copyTypes, { name: 'Theirs' })
      .returning();
    if (theirs === undefined) throw new Error('no copy type');

    await syncCopywritingCopyTypesInBrand(db, brandId, copy.id, [theirs.id, own.id, own.id]);

    expect(await listCopywritingCopyTypeIds(db, copy.id)).toEqual([own.id]);
    expect(
      await db
        .select()
        .from(copywritingCopyTypes)
        .where(sql`${copywritingCopyTypes.copyTypeId} = ${theirs.id}`),
    ).toEqual([]);
    expect(await db.select().from(youtubeCopyCopyTypes)).toHaveLength(
      demoCopyTypes.reduce((n, row) => n + row.youtubeCopies.length, 0),
    );
  });

  it('insertCopyType forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed form would make.
    const smuggled = { name: 'Smuggled type', brandId: otherBrandId } as unknown as CopyTypeInput;

    const row = await insertCopyType(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'Smuggled type',
      description: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await getCopyTypeById(db, brandId, row.id)).toMatchObject({
      metaCopies: [],
      youtubeCopies: [],
    });
    expect(await listCopyTypes(db, brandId)).toHaveLength(5);
    expect(await listCopyTypes(db, otherBrandId)).toEqual([]);
  });

  it('updateCopyType cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoCopyType();

    const escaped = await updateCopyType(
      db,
      otherBrandId,
      target.id,
      { name: 'Hijacked' },
      'thief',
    );
    const own = await updateCopyType(
      db,
      brandId,
      target.id,
      { description: 'Rewritten for the gifting window.' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      name: target.name,
      description: 'Rewritten for the gifting window.',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoCopyTypes).toEqualTypeOf<CopyTypeListRow[]>();
    expectTypeOf(await listCopyTypes(db, brandId)).toEqualTypeOf<CopyTypeListRow[]>();
    expectTypeOf<CopyTypeListRow>().toExtend<CopyType>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<CopyTypeInput>().not.toHaveProperty('brandId');
    expectTypeOf<CopyTypeInput>().not.toHaveProperty('createdBy');
    expectTypeOf<CopyTypeInput>().toHaveProperty('name');
    expectTypeOf<CopyTypeInput>().toHaveProperty('description');
  });
});
