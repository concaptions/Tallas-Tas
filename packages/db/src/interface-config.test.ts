import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_ACTOR_ID, DEMO_BRAND_ID, demoInterfaceConfig } from './demo-data';
import {
  getInterfacePageById,
  listInterfaceConfig,
  setFieldVisibility,
  setPageEnabled,
  type InterfaceFieldRow,
  type InterfacePageRow,
} from './interface-config';
import { interfaceFields, interfacePages, type InterfacePage } from './schema';
import { seed } from './seed';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

/** The Concepts page of the fixtures, past `noUncheckedIndexedAccess`. */
function conceptsPage(): InterfacePageRow {
  const [page] = demoInterfaceConfig;
  if (page === undefined) throw new Error('demoInterfaceConfig is empty');
  return page;
}

/** The last field of the concept card — "Hook examples", the one the config page toggles. */
function hookExamples(): InterfaceFieldRow {
  const field = conceptsPage().fields.at(-1);
  if (field === undefined) throw new Error('the Concepts page has no fields');
  return field;
}

describe('migration 0010 on PGlite', () => {
  it('seeds PRD §10’s six pages in order, identical to the fixtures', async () => {
    const { db, brandId } = await seeded();

    const pages = await listInterfaceConfig(db, brandId);

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(pages).toEqual(demoInterfaceConfig);
    expect(pages.map((page) => page.pageKey)).toEqual([
      'concepts',
      'creatives',
      'copywriting',
      'ugc',
      'partnership',
      'calendar',
    ]);
    expect(pages.map((page) => page.label)).toEqual([
      'Concepts',
      'Creatives',
      'Copywriting',
      'UGC Management',
      'Partnership Ads Tracking',
      'Promotional Calendar',
    ]);
    expect(pages.every((page) => page.enabled)).toBe(true);
  });

  it('seeds the twelve default concept-card fields in PRD §10’s order, all visible', async () => {
    const { db, brandId } = await seeded();

    const [concepts] = await listInterfaceConfig(db, brandId);

    expect(concepts?.fields.map((field) => field.label)).toEqual([
      'Batch',
      'Category',
      'Concept name',
      'Concept Style',
      'Angle',
      'Theme',
      'Product',
      'Description (hypothesis)',
      'Pain Points',
      'USP',
      'Persona',
      'Hook examples',
    ]);
    expect(concepts?.fields.map((field) => field.position)).toEqual([...Array(12).keys()]);
    expect(concepts?.fields.every((field) => field.visible)).toBe(true);
  });

  it('marks client-editable only the fields §10’s table lets the client change', async () => {
    const { db, brandId } = await seeded();

    const pages = await listInterfaceConfig(db, brandId);
    const editable = pages.flatMap((page) =>
      page.fields
        .filter((field) => field.clientEditable)
        .map((field) => `${page.pageKey}.${field.fieldName}`),
    );

    // §10: Creatives (Client Status, comments), Copywriting (Status, Client's Comment),
    // UGC (Status, Note, Tracking Number). The concept card is read-only content, and
    // Partnership Ads Tracking is view / group / filter only.
    expect(editable).toEqual([
      'creatives.client_status',
      'creatives.client_comments',
      'copywriting.client_status',
      'copywriting.client_comment',
      'ugc.client_status',
      'ugc.client_note',
      'ugc.tracking_number',
    ]);
    expect(pages[0]?.fields.some((field) => field.clientEditable)).toBe(false);
    expect(pages[4]?.fields.some((field) => field.clientEditable)).toBe(false);
  });
});

describe('interface config queries', () => {
  it('orders pages and fields by position, whatever order the rows were written in', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    // Written last, positioned second: `position` decides, not insertion order or the clock.
    const [late] = await scope
      .insert(interfacePages, { pageKey: 'creatives', label: 'Creatives (draft)', position: -1 })
      .returning();
    if (late === undefined) throw new Error('the extra page was not inserted');
    await scope
      .insert(interfaceFields, [
        { pageId: late.id, fieldName: 'second', label: 'Second', position: 1 },
        { pageId: late.id, fieldName: 'first', label: 'First', position: 0 },
      ])
      .returning();

    const pages = await listInterfaceConfig(db, brandId);

    expect(pages.map((page) => page.position)).toEqual([-1, 0, 1, 2, 3, 4, 5]);
    expect(pages[0]?.id).toBe(late.id);
    expect(pages[0]?.fields.map((field) => field.fieldName)).toEqual(['first', 'second']);
  });

  it('nests a page with no fields as an empty array, never null, and drops orphaned fields', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    const [empty] = await scope
      .insert(interfacePages, {
        pageKey: 'partnership',
        label: 'Second partnership view',
        position: 9,
      })
      .returning();
    // Soft-delete the Copywriting page: its field rows stay, and must not surface parentless.
    await db
      .update(interfacePages)
      .set({ deletedAt: new Date() })
      .where(eq(interfacePages.pageKey, 'copywriting'));

    const pages = await listInterfaceConfig(db, brandId);

    expect(pages.find((page) => page.id === empty?.id)?.fields).toEqual([]);
    expect(pages.map((page) => page.pageKey)).toEqual([
      'concepts',
      'creatives',
      'ugc',
      'partnership',
      'calendar',
      'partnership',
    ]);
    expect(pages.flatMap((page) => page.fields).map((field) => field.fieldName)).not.toContain(
      'client_comment',
    );
    // The orphaned field rows are still in the table: nothing was deleted, only unparented.
    const orphans = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(interfaceFields)
      .where(eq(interfaceFields.pageId, demoInterfaceConfig[2]?.id ?? ''));
    expect(orphans[0]?.count).toBe(2);
  });

  it('returns nothing for another brand, and nothing once a page is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(await listInterfaceConfig(db, otherBrandId)).toEqual([]);
    expect(await getInterfacePageById(db, otherBrandId, conceptsPage().id)).toBeNull();
    expect(await getInterfacePageById(db, brandId, conceptsPage().id)).toEqual(conceptsPage());

    await db
      .update(interfacePages)
      .set({ deletedAt: new Date() })
      .where(eq(interfacePages.id, conceptsPage().id));

    expect(await listInterfaceConfig(db, brandId)).toHaveLength(5);
    expect(await getInterfacePageById(db, brandId, conceptsPage().id)).toBeNull();
  });

  it('setFieldVisibility hides one field and leaves client_editable and its siblings alone', async () => {
    const { db, brandId } = await seeded();
    const target = hookExamples();

    const hidden = await setFieldVisibility(db, brandId, target.id, false, DEMO_ACTOR_ID);
    const [concepts] = await listInterfaceConfig(db, brandId);

    expect(hidden).toMatchObject({ id: target.id, visible: false, clientEditable: false });
    expect(hidden?.updatedBy).toBe(DEMO_ACTOR_ID);
    expect(concepts?.fields.filter((field) => field.visible)).toHaveLength(11);
    // Toggled back on, it returns to its seeded position rather than to the end of the card.
    await setFieldVisibility(db, brandId, target.id, true, DEMO_ACTOR_ID);
    const [restored] = await listInterfaceConfig(db, brandId);
    expect(restored?.fields.map((field) => field.fieldName)).toEqual(
      conceptsPage().fields.map((field) => field.fieldName),
    );
    expect(restored?.fields.at(-1)).toMatchObject({ fieldName: 'hook_examples', visible: true });
  });

  it('setPageEnabled switches a page off without touching the fields underneath it', async () => {
    const { db, brandId } = await seeded();
    const copywriting = demoInterfaceConfig[2];
    if (copywriting === undefined) throw new Error('demoInterfaceConfig has no Copywriting page');

    const off = await setPageEnabled(db, brandId, copywriting.id, false, DEMO_ACTOR_ID);

    expect(off).toMatchObject({ id: copywriting.id, pageKey: 'copywriting', enabled: false });
    expect(off?.fields.map((field) => field.fieldName)).toEqual(
      copywriting.fields.map((field) => field.fieldName),
    );
    expect(off?.fields.every((field) => field.visible)).toBe(true);
    // Still listed, so the configuration screen can switch it back on.
    const pages = await listInterfaceConfig(db, brandId);
    expect(pages).toHaveLength(6);
    expect(pages[2]).toMatchObject({ enabled: false });
  });

  it('neither write reaches another brand’s configuration', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = hookExamples();
    const page = conceptsPage();

    expect(await setFieldVisibility(db, otherBrandId, target.id, false, 'thief')).toBeNull();
    expect(await setPageEnabled(db, otherBrandId, page.id, false, 'thief')).toBeNull();

    const [concepts] = await listInterfaceConfig(db, brandId);
    expect(concepts).toEqual(page);
    expect(concepts?.fields.every((field) => field.visible)).toBe(true);
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoInterfaceConfig).toEqualTypeOf<InterfacePageRow[]>();
    expectTypeOf(await listInterfaceConfig(db, brandId)).toEqualTypeOf<InterfacePageRow[]>();
    expectTypeOf<InterfacePageRow>().toExtend<InterfacePage>();
    expectTypeOf<InterfacePageRow['fields']>().toEqualTypeOf<InterfaceFieldRow[]>();
    expectTypeOf<InterfaceFieldRow['clientEditable']>().toEqualTypeOf<boolean>();
  });
});
