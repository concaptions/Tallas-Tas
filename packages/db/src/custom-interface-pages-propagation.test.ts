import { and, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { agencies, brands, customInterfacePages } from './schema';
import { testDb } from './testing';
import {
  insertCustomPage,
  propagateCustomInterfacePageToChildren,
  resolveTemplateBrandFromAny,
} from './custom-interface-pages';

async function seedAgencyWithChildren() {
  const db = await testDb();
  const [agency] = await db.insert(agencies).values({ name: 'TAS', slug: 'tas' }).returning();
  if (!agency) throw new Error('seed agency');
  const [template] = await db
    .insert(brands)
    .values({ name: 'TAS', slug: 'tas', agencyId: agency.id, isTemplate: true })
    .returning();
  const [childA] = await db
    .insert(brands)
    .values({
      name: 'Child A',
      slug: 'a',
      agencyId: agency.id,
      isTemplate: false,
      templateBrandId: template?.id,
    })
    .returning();
  const [childB] = await db
    .insert(brands)
    .values({
      name: 'Child B',
      slug: 'b',
      agencyId: agency.id,
      isTemplate: false,
      templateBrandId: template?.id,
    })
    .returning();
  if (!template || !childA || !childB) throw new Error('seed brands');
  return { db, template, childA, childB };
}

describe('propagateCustomInterfacePageToChildren', () => {
  it('writes a fresh inherited row on every child when none exists', async () => {
    const { db, childA, childB } = await seedAgencyWithChildren();
    const templatePage = await insertCustomPage(db, {
      brandId: null,
      slug: 'queue',
      title: 'Queue',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    const result = await propagateCustomInterfacePageToChildren(
      db,
      templatePage.id,
      [childA.id, childB.id],
      'tester',
    );
    expect(result.applied).toBe(true);
    expect(result.childrenUpdated).toBe(2);
    const childRows = await db
      .select()
      .from(customInterfacePages)
      .where(and(eq(customInterfacePages.slug, 'queue'), isNull(customInterfacePages.deletedAt)));
    expect(childRows).toHaveLength(3); // template + two children
    const inherited = childRows.filter((row) => row.isInherited && row.brandId !== null);
    expect(inherited).toHaveLength(2);
  });

  it('updates an existing is_inherited = true row in place', async () => {
    const { db, childA } = await seedAgencyWithChildren();
    const templatePage = await insertCustomPage(db, {
      brandId: null,
      slug: 'q',
      title: 'Original',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    // First push.
    await propagateCustomInterfacePageToChildren(db, templatePage.id, [childA.id], 'tester');
    // Mutate the template.
    await db
      .update(customInterfacePages)
      .set({ title: 'Updated' })
      .where(eq(customInterfacePages.id, templatePage.id));
    // Push again.
    const result = await propagateCustomInterfacePageToChildren(
      db,
      templatePage.id,
      [childA.id],
      'tester',
    );
    expect(result.childrenUpdated).toBe(1);
    const [childRow] = await db
      .select()
      .from(customInterfacePages)
      .where(and(eq(customInterfacePages.brandId, childA.id), eq(customInterfacePages.slug, 'q')));
    expect(childRow?.title).toBe('Updated');
  });

  it('leaves an is_inherited = false child untouched (child customised)', async () => {
    const { db, childA } = await seedAgencyWithChildren();
    const templatePage = await insertCustomPage(db, {
      brandId: null,
      slug: 'q',
      title: 'Templ',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    // Child has written its OWN row with a different title and is_inherited=false.
    await insertCustomPage(db, {
      brandId: childA.id,
      slug: 'q',
      title: 'Child Custom',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 1,
      isVisible: true,
      isInherited: false,
      createdBy: 'test',
    });
    const result = await propagateCustomInterfacePageToChildren(
      db,
      templatePage.id,
      [childA.id],
      'tester',
    );
    expect(result.childrenUpdated).toBe(0);
    const [childRow] = await db
      .select()
      .from(customInterfacePages)
      .where(and(eq(customInterfacePages.brandId, childA.id), eq(customInterfacePages.slug, 'q')));
    expect(childRow?.title).toBe('Child Custom');
  });

  it('refuses when the id is not a template page (brand_id IS NOT NULL)', async () => {
    const { db, childA } = await seedAgencyWithChildren();
    const notTemplate = await insertCustomPage(db, {
      brandId: childA.id,
      slug: 'q',
      title: 'X',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 1,
      isVisible: true,
      isInherited: false,
      createdBy: 'test',
    });
    const result = await propagateCustomInterfacePageToChildren(
      db,
      notTemplate.id,
      [childA.id],
      'tester',
    );
    expect(result.applied).toBe(false);
    expect(result.childrenUpdated).toBe(0);
  });
});

describe('resolveTemplateBrandFromAny', () => {
  it('returns the template brand for a child', async () => {
    const { db, template, childA } = await seedAgencyWithChildren();
    expect(await resolveTemplateBrandFromAny(db, childA.id)).toBe(template.id);
  });

  it('returns the brand itself when it is a template', async () => {
    const { db, template } = await seedAgencyWithChildren();
    expect(await resolveTemplateBrandFromAny(db, template.id)).toBe(template.id);
  });
});
