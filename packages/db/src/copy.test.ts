import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getCopyById,
  insertCopy,
  listCopy,
  updateCopy,
  type CopyInput,
  type CopyListRow,
} from './copy';
import { DEMO_BRAND_ID, demoBriefs, demoCopy } from './demo-data';
import { COPY_CTA_DEFAULT, COPY_STATUS_DEFAULT, copyCtas, copywriting, type Copy } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand } from './tenancy';

/** The newest copy fixture — the approved night-shift video copy — past `noUncheckedIndexedAccess`. */
function newestCopy(): CopyListRow {
  const [row] = demoCopy;
  if (row === undefined) throw new Error('demoCopy is empty');
  return row;
}

/** The one unattached fixture: copy drafted before it was tied to a creative (PRD §5.11). */
function unattachedCopy(): CopyListRow {
  const row = demoCopy.find((copy) => copy.creativeBriefId === null);
  if (row === undefined) throw new Error('demoCopy has no unattached row');
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('migration 0007 on PGlite', () => {
  it('keeps creative_brief_id NULLABLE: copy can be drafted before it is attached', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{ column_name: string; is_nullable: string }>(
      sql`select column_name, is_nullable
          from information_schema.columns
          where table_name = 'copywriting'
            and column_name in ('creative_brief_id', 'brand_id', 'copy_number')
          order by column_name`,
    );

    // PRD §5.11: the link to the creative is the connection that matters, and it is a connection a
    // row is allowed to be missing. If this ever reads 'NO', the migration is wrong.
    expect(rows).toEqual([
      { column_name: 'brand_id', is_nullable: 'NO' },
      { column_name: 'copy_number', is_nullable: 'NO' },
      { column_name: 'creative_brief_id', is_nullable: 'YES' },
    ]);
  });

  it('DROPS Copy Type, which PRD §5.11 says does not come over from Airtable', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
          where table_name = 'copywriting' order by column_name`,
    );

    const names = rows.map((row) => row.column_name);
    expect(names).not.toContain('copy_type');
    expect(names).not.toContain('type');
    // The shared columns plus the table's own, including the Airtable-parity additions.
    expect(names).toEqual([
      'brand_id',
      'click_for_ai_spell_checker',
      'client_comment',
      'concept_id',
      'copy_number',
      'created_at',
      'created_by',
      'creative_brief_id',
      'cta',
      'custom_fields',
      'deleted_at',
      'funnel',
      'headline',
      'id',
      'legacy_airtable_id',
      'link_description',
      'meta_rating',
      'overridden_fields',
      'primary_copy',
      'product_id',
      'spelling_feedback',
      'status',
      'template_row_id',
      'updated_at',
      'updated_by',
      'used',
      'winning',
    ]);
  });

  it('starts a fresh row at the first status and the first CTA', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`select column_name, data_type, is_nullable, column_default
          from information_schema.columns
          where table_name = 'copywriting'
            and column_name in ('status', 'cta', 'copy_number', 'primary_copy', 'client_comment')
          order by column_name`,
    );

    expect(rows).toEqual([
      // Null on every row the client has not written back on.
      {
        column_name: 'client_comment',
        data_type: 'text',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        column_name: 'copy_number',
        data_type: 'integer',
        is_nullable: 'NO',
        column_default: '1',
      },
      {
        column_name: 'cta',
        data_type: 'text',
        is_nullable: 'NO',
        column_default: `'Shop Now'::text`,
      },
      // The character guidance is helper text and a fixture property, never a column constraint: a
      // 126-character draft is saved, not rejected.
      {
        column_name: 'primary_copy',
        data_type: 'text',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        column_name: 'status',
        data_type: 'text',
        is_nullable: 'NO',
        column_default: `'pending_for_client_review'::text`,
      },
    ]);
  });
});

describe('demoCopy fixtures', () => {
  it('is four rows in updated_at descending order, all on the demo brand', () => {
    expect(demoCopy).toHaveLength(4);
    expect(demoCopy.every((row) => row.brandId === DEMO_BRAND_ID)).toBe(true);

    const updated = demoCopy.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('respects the PRD §5.11 character guidance on every row', () => {
    for (const row of demoCopy) {
      expect(row.primaryCopy?.length ?? 0).toBeLessThanOrEqual(125);
      expect(row.headline?.length ?? 0).toBeLessThanOrEqual(40);
      expect(row.linkDescription?.length ?? 0).toBeLessThanOrEqual(27);
      // Never a stub: these are the demo product, not placeholders.
      expect(row.primaryCopy?.length ?? 0).toBeGreaterThan(100);
      expect(copyCtas).toContain(row.cta);
    }
  });

  it('ties three rows to a seeded brief and leaves exactly one unattached', () => {
    const briefIds = new Set(demoBriefs.map((brief) => brief.id));
    const attached = demoCopy.filter((row) => row.creativeBriefId !== null);

    expect(attached).toHaveLength(3);
    expect(attached.every((row) => briefIds.has(row.creativeBriefId ?? ''))).toBe(true);
    expect(demoCopy.filter((row) => row.creativeBriefId === null)).toHaveLength(1);
    expect(unattachedCopy().creativeName).toBeNull();
  });

  it('spreads across statuses and carries a client comment on the edited row only', () => {
    const statuses = demoCopy.map((row) => row.status);

    expect(new Set(statuses).size).toBeGreaterThanOrEqual(3);
    expect(statuses).toContain('edited_by_client');

    const commented = demoCopy.filter((row) => row.clientComment !== null);
    expect(commented).toHaveLength(1);
    expect(commented[0]?.status).toBe('edited_by_client');
    expect((commented[0]?.clientComment ?? '').length).toBeGreaterThan(80);
  });
});

describe('listCopy', () => {
  it('returns the seeded rows newest edit first, matching the fixtures row for row', async () => {
    const { db, brandId } = await seeded();

    const rows = await listCopy(db, brandId);

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.id)).toEqual(demoCopy.map((row) => row.id));
    expect(rows.map((row) => row.updatedAt.getTime())).toEqual(
      demoCopy.map((row) => row.updatedAt.getTime()),
    );
    expect(rows.map((row) => row.copyNumber)).toEqual(demoCopy.map((row) => row.copyNumber));
    expect(rows.map((row) => row.primaryCopy)).toEqual(demoCopy.map((row) => row.primaryCopy));
    expect(rows.map((row) => row.status)).toEqual(demoCopy.map((row) => row.status));
    expect(rows.map((row) => row.cta)).toEqual(demoCopy.map((row) => row.cta));
  });

  it('joins the creative name and leaves the unattached row null, still returned', async () => {
    const { db, brandId } = await seeded();

    const rows = await listCopy(db, brandId);
    const attached = rows.find((row) => row.id === newestCopy().id);
    const unattached = rows.find((row) => row.id === unattachedCopy().id);

    // A LEFT JOIN's semantics: the row with no brief is in the list, with a null name beside it.
    expect(attached?.creativeName).toBe(
      demoBriefs.find((brief) => brief.id === newestCopy().creativeBriefId)?.name,
    );
    expect(attached?.creativeName).toMatch(/^TV1-/);
    expect(unattached).toBeDefined();
    expect(unattached?.creativeBriefId).toBeNull();
    expect(unattached?.creativeName).toBeNull();
    expect(rows.filter((row) => row.creativeName !== null)).toHaveLength(3);
  });

  it('never returns another brand’s copy, and never its creative names either', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The other brand gets its own row, pointing at a brief that belongs to the SEEDED brand: the
    // foreign key is satisfied, but the name must not cross the scope.
    const borrowed = newestCopy().creativeBriefId ?? '';
    const intruder = await insertCopy(
      db,
      otherBrandId,
      { copyNumber: 9, headline: 'Other brand', creativeBriefId: borrowed },
      'user_test',
    );

    const mine = await listCopy(db, brandId);
    const theirs = await listCopy(db, otherBrandId);

    expect(mine).toHaveLength(4);
    expect(mine.map((row) => row.id)).not.toContain(intruder.id);
    expect(theirs.map((row) => row.id)).toEqual([intruder.id]);
    // Scoped read of the briefs, so the borrowed id resolves to nothing rather than to a name.
    expect(theirs[0]?.creativeName).toBeNull();
  });

  it('drops a soft-deleted row from the list', async () => {
    const { db, brandId } = await seeded();
    const doomed = unattachedCopy().id;

    await withBrand(db, brandId).softDelete(copywriting, eq(copywriting.id, doomed));
    const rows = await listCopy(db, brandId);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.id)).not.toContain(doomed);
  });
});

describe('getCopyById', () => {
  it('resolves an attached row with its creative name and an unattached row with null', async () => {
    const { db, brandId } = await seeded();

    const attached = await getCopyById(db, brandId, newestCopy().id);
    const unattached = await getCopyById(db, brandId, unattachedCopy().id);

    expect(attached).toMatchObject({
      id: newestCopy().id,
      brandId,
      status: 'approved',
      cta: 'Shop Now',
      creativeName: newestCopy().creativeName,
    });
    expect(unattached).toMatchObject({
      id: unattachedCopy().id,
      creativeBriefId: null,
      creativeName: null,
    });
  });

  it('never resolves another brand’s id, and returns null for an unknown one', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(await getCopyById(db, otherBrandId, newestCopy().id)).toBeNull();
    expect(await getCopyById(db, brandId, '99999999-9999-4999-8999-999999999999')).toBeNull();
  });
});

describe('insertCopy and updateCopy', () => {
  it('forces brand_id to the scope and defaults the status and the CTA', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a hand-built payload would make.
    const smuggled = {
      copyNumber: 5,
      brandId: otherBrandId,
      primaryCopy: 'Drafted in the panel, attached to nothing yet.',
      creativeBriefId: null,
    } as unknown as CopyInput;

    const row = await insertCopy(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      copyNumber: 5,
      creativeBriefId: null,
      status: COPY_STATUS_DEFAULT,
      cta: COPY_CTA_DEFAULT,
      clientComment: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listCopy(db, brandId)).toHaveLength(5);
    expect(await listCopy(db, otherBrandId)).toEqual([]);
  });

  it('attaches, detaches and advances a row in the scope, but never another brand’s', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const id = unattachedCopy().id;
    const briefId = newestCopy().creativeBriefId;

    const escaped = await updateCopy(db, otherBrandId, id, { headline: 'Hijacked' }, 'thief');
    const attached = await updateCopy(
      db,
      brandId,
      id,
      { creativeBriefId: briefId, status: 'approved' },
      'user_test',
    );
    const detached = await updateCopy(db, brandId, id, { creativeBriefId: null }, 'user_test');

    expect(escaped).toBeNull();
    expect(attached).toMatchObject({ id, brandId, creativeBriefId: briefId, status: 'approved' });
    expect(detached).toMatchObject({ id, creativeBriefId: null, updatedBy: 'user_test' });
    expect(await getCopyById(db, brandId, id)).toMatchObject({ creativeName: null });
    expect(detached?.updatedAt.getTime()).toBeGreaterThan(unattachedCopy().updatedAt.getTime());
  });

  it('records the client’s comment with the edited_by_client status', async () => {
    const { db, brandId } = await seeded();
    const id = newestCopy().id;

    const row = await updateCopy(
      db,
      brandId,
      id,
      { status: 'edited_by_client', clientComment: 'Headline is ours now, the rest can stay.' },
      'user_client',
    );

    expect(row).toMatchObject({
      status: 'edited_by_client',
      clientComment: 'Headline is ours now, the rest can stay.',
      updatedBy: 'user_client',
    });
  });
});

describe('types', () => {
  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoCopy).toEqualTypeOf<CopyListRow[]>();
    expectTypeOf(await listCopy(db, brandId)).toEqualTypeOf<CopyListRow[]>();
    expectTypeOf<CopyListRow>().toExtend<Copy>();
    expectTypeOf<CopyListRow['creativeBriefId']>().toEqualTypeOf<string | null>();
    expectTypeOf<CopyListRow['creativeName']>().toEqualTypeOf<string | null>();
    expectTypeOf<CopyListRow['clientComment']>().toEqualTypeOf<string | null>();
    // `brand_id` and the audit columns are the scope's, never the panel's.
    expectTypeOf<CopyInput>().not.toHaveProperty('brandId');
    expectTypeOf<CopyInput>().not.toHaveProperty('createdBy');
    expectTypeOf<CopyInput>().toHaveProperty('creativeBriefId');
    expectTypeOf<CopyInput>().toHaveProperty('copyNumber');
    expectTypeOf<CopyInput>().toHaveProperty('primaryCopy');
    expectTypeOf<CopyInput>().toHaveProperty('headline');
    expectTypeOf<CopyInput>().toHaveProperty('linkDescription');
    expectTypeOf<CopyInput>().toHaveProperty('cta');
    expectTypeOf<CopyInput>().toHaveProperty('status');
    expectTypeOf<CopyInput>().toHaveProperty('clientComment');
    // `funnel` was re-added as a nullable column for Airtable parity.
    expectTypeOf<CopyInput>().toHaveProperty('funnel');
    // PRD §5.11 dropped copy type, so it must not reappear as a column.
    expectTypeOf<CopyInput>().not.toHaveProperty('copyType');
  });
});
