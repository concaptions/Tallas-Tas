import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { propagationColumns } from './columns';
import {
  insertCustomFieldSchema,
  listApplicableFieldSchemas,
  listCustomFieldSchemas,
} from './custom-field-schemas';
import { DEMO_ACTOR_ID } from './demo-data';
import { listInterfaceConfig } from './interface-config';
import { onboardBrand, type InterfacePageDefault } from './onboard';
import {
  createPromotionRequest,
  listChildBrands,
  propagateAllContent,
  propagateInterfaceConfig,
  propagateTemplateRow,
  PROPAGATION_TABLES,
  resolveTemplateBrandId,
} from './propagation';
import { applyApprovedPromotion, setPromotionRequestStatus } from './promotion-requests';
import { interfacePages, products } from './schema';
import { seed } from './seed';
import { testDb } from './testing';
import { withBrand } from './tenancy';

const INTERFACE_DEFAULTS: InterfacePageDefault[] = [
  {
    pageKey: 'concepts',
    label: 'Concepts',
    enabled: true,
    position: 0,
    fields: [
      { fieldName: 'batch', label: 'Batch', visible: true, clientEditable: false, position: 0 },
    ],
  },
  {
    pageKey: 'creatives',
    label: 'Creatives',
    enabled: true,
    position: 1,
    fields: [
      {
        fieldName: 'client_status',
        label: 'Status',
        visible: true,
        clientEditable: true,
        position: 0,
      },
    ],
  },
];

async function seeded() {
  const db = await testDb();
  const result = await seed(db);
  return {
    db,
    agency: result.agency,
    templateBrand: result.templateBrand,
    childBrand: result.childBrand,
  };
}

describe('createPromotionRequest', () => {
  it('inserts a promotion request and returns it', async () => {
    const { db, childBrand } = await seeded();

    const request = await createPromotionRequest(
      db,
      {
        brandId: childBrand.id,
        tableName: 'personas',
        fieldName: 'pain_points',
        currentValue: 'Original value',
        proposedValue: 'Updated value',
        requestedBy: 'test-user',
      },
      DEMO_ACTOR_ID,
    );

    expect(request.brandId).toBe(childBrand.id);
    expect(request.tableName).toBe('personas');
    expect(request.fieldName).toBe('pain_points');
    expect(request.status).toBe('pending');
    expect(request.reviewedBy).toBeNull();
  });
});

describe('listChildBrands', () => {
  it('returns active children of a template', async () => {
    const { db, templateBrand, childBrand } = await seeded();

    const children = await listChildBrands(db, templateBrand.id);

    expect(children.length).toBeGreaterThanOrEqual(1);
    expect(children.map((c) => c.id)).toContain(childBrand.id);
    expect(children.every((c) => c.templateBrandId === templateBrand.id)).toBe(true);
  });

  it('does not return the template brand itself', async () => {
    const { db, templateBrand } = await seeded();

    const children = await listChildBrands(db, templateBrand.id);

    expect(children.map((c) => c.id)).not.toContain(templateBrand.id);
  });
});

describe('propagateInterfaceConfig', () => {
  it('copies template interface config to a newly onboarded brand', async () => {
    const { db, agency, templateBrand } = await seeded();

    const { brand: newBrand } = await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Propagation Target',
      slug: 'propagation-target',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    const beforeConfig = await listInterfaceConfig(db, newBrand.id);
    expect(beforeConfig).toHaveLength(2);

    const templateScope = withBrand(db, templateBrand.id);
    await templateScope.insert(interfacePages, {
      pageKey: 'ugc',
      label: 'UGC Management',
      enabled: true,
      position: 5,
      createdBy: DEMO_ACTOR_ID,
      updatedBy: DEMO_ACTOR_ID,
    });

    const result = await propagateInterfaceConfig(db, templateBrand.id, DEMO_ACTOR_ID);

    expect(result.childrenUpdated).toBeGreaterThanOrEqual(1);

    const afterConfig = await listInterfaceConfig(db, newBrand.id);
    const templateConfig = await listInterfaceConfig(db, templateBrand.id);
    expect(afterConfig.map((p) => p.pageKey)).toEqual(templateConfig.map((p) => p.pageKey));
  });

  it('propagates to multiple children', async () => {
    const { db, agency, templateBrand } = await seeded();

    await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Child A',
      slug: 'child-a',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });
    await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Child B',
      slug: 'child-b',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    const result = await propagateInterfaceConfig(db, templateBrand.id, DEMO_ACTOR_ID);

    expect(result.childrenUpdated).toBeGreaterThanOrEqual(2);
  });

  it('does not affect brands that are not children of this template', async () => {
    const { db, agency, templateBrand } = await seeded();

    const { brand: unrelatedBrand } = await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Unrelated',
      slug: 'unrelated',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    await propagateInterfaceConfig(db, templateBrand.id, DEMO_ACTOR_ID);

    const configAfter = await listInterfaceConfig(db, unrelatedBrand.id);
    expect(configAfter.map((p) => p.pageKey)).toEqual(
      (await listInterfaceConfig(db, templateBrand.id)).map((p) => p.pageKey),
    );
  });
});

describe('propagationColumns', () => {
  it('returns templateRowId, overriddenFields, customFields', () => {
    const cols = propagationColumns();
    expect(cols).toHaveProperty('templateRowId');
    expect(cols).toHaveProperty('overriddenFields');
    expect(cols).toHaveProperty('customFields');
  });
});

describe('resolveTemplateBrandId', () => {
  it('returns the template brand id for an agency', async () => {
    const { db, templateBrand, agency } = await seeded();
    const resolved = await resolveTemplateBrandId(db, agency.id);
    expect(resolved).toBe(templateBrand.id);
  });

  it('returns null for a non-existent agency', async () => {
    const { db } = await seeded();
    const resolved = await resolveTemplateBrandId(db, '00000000-0000-0000-0000-000000000000');
    expect(resolved).toBeNull();
  });
});

describe('PROPAGATION_TABLES', () => {
  it('registers exactly the 8 content tables', () => {
    const keys = Object.keys(PROPAGATION_TABLES).sort();
    expect(keys).toEqual([
      'angles',
      'campaigns_offers',
      'concepts',
      'copywriting',
      'creative_briefs',
      'creators',
      'personas',
      'products',
    ]);
  });
});

describe('seedContentFromTemplate', () => {
  it('copies template rows to a child brand with templateRowId set', async () => {
    const { db, templateBrand, childBrand } = await seeded();

    const templateScope = withBrand(db, templateBrand.id);
    const templateProducts = await templateScope.select(products);

    const childScope = withBrand(db, childBrand.id);
    const childProducts = await childScope.select(products);

    for (const childProduct of childProducts) {
      if (childProduct.templateRowId !== null) {
        expect(templateProducts.map((p) => p.id)).toContain(childProduct.templateRowId);
        expect(childProduct.overriddenFields).toEqual([]);
      }
    }
  });
});

/** Insert a product into the template brand so propagation has something to work with. */
async function seedTemplateProduct(db: Parameters<typeof withBrand>[0], templateBrandId: string) {
  const scope = withBrand(db, templateBrandId);
  const rows = await scope
    .insert(products, {
      name: 'Template Product',
      link: 'https://example.com/template',
      collectionLink: null,
      legacyAirtableId: null,
      templateRowId: null,
      overriddenFields: [],
      customFields: {},
      createdBy: DEMO_ACTOR_ID,
      updatedBy: DEMO_ACTOR_ID,
    })
    .returning();
  const row = rows[0];
  if (row === undefined) throw new Error('No template product inserted');
  return row;
}

describe('propagateTemplateRow', () => {
  it('propagates an insert by creating a new child row', async () => {
    const { db, templateBrand } = await seeded();
    const templateProduct = await seedTemplateProduct(db, templateBrand.id);

    const result = await propagateTemplateRow(
      db,
      templateBrand.id,
      'products',
      templateProduct.id,
      'insert',
      DEMO_ACTOR_ID,
    );
    expect(result.childrenUpdated).toBeGreaterThanOrEqual(1);
  });

  it('skips overridden fields during update propagation', async () => {
    const { db, templateBrand, childBrand } = await seeded();
    const templateProduct = await seedTemplateProduct(db, templateBrand.id);

    await propagateTemplateRow(
      db,
      templateBrand.id,
      'products',
      templateProduct.id,
      'insert',
      DEMO_ACTOR_ID,
    );

    const templateScope = withBrand(db, templateBrand.id);
    await templateScope.update(
      products,
      { name: 'Changed Template Name', updatedBy: DEMO_ACTOR_ID },
      eq(products.id, templateProduct.id),
    );

    const childScope = withBrand(db, childBrand.id);
    const childProducts = await childScope.select(products);
    const linked = childProducts.find((p) => p.templateRowId === templateProduct.id);
    if (!linked) throw new Error('No linked child');

    await childScope.update(
      products,
      { overriddenFields: ['name'], updatedBy: DEMO_ACTOR_ID },
      eq(products.id, linked.id),
    );

    await propagateTemplateRow(
      db,
      templateBrand.id,
      'products',
      templateProduct.id,
      'update',
      DEMO_ACTOR_ID,
    );

    const [refreshed] = await childScope.select(products, eq(products.id, linked.id)).limit(1);
    if (refreshed === undefined) throw new Error('No refreshed child product');
    expect(refreshed.name).not.toBe('Changed Template Name');
  });

  it('throws for a table not in the registry', async () => {
    const { db, templateBrand } = await seeded();
    await expect(
      propagateTemplateRow(db, templateBrand.id, 'nonexistent', 'id', 'update', DEMO_ACTOR_ID),
    ).rejects.toThrow('not in the propagation registry');
  });
});

describe('propagateAllContent', () => {
  it('processes tables that have template rows', async () => {
    const { db, templateBrand } = await seeded();
    await seedTemplateProduct(db, templateBrand.id);
    const result = await propagateAllContent(db, templateBrand.id, DEMO_ACTOR_ID);
    expect(result.tablesProcessed).toContain('products');
  });
});

describe('custom field schemas', () => {
  it('CRUD operations work via withBrand', async () => {
    const { db, templateBrand } = await seeded();
    const brandId = templateBrand.id;

    const created = await insertCustomFieldSchema(
      db,
      brandId,
      {
        tableName: 'products',
        fieldKey: 'test_field',
        fieldType: 'text',
        fieldLabel: 'Test Field',
        options: null,
        sortOrder: '0',
        createdBy: DEMO_ACTOR_ID,
        updatedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    expect(created.fieldKey).toBe('test_field');
    expect(created.brandId).toBe(brandId);

    const listed = await listCustomFieldSchemas(db, brandId, 'products');
    expect(listed.some((f) => f.id === created.id)).toBe(true);
  });

  it('listApplicableFieldSchemas resolves template schemas for a child brand', async () => {
    const { db, templateBrand, childBrand } = await seeded();

    await insertCustomFieldSchema(
      db,
      templateBrand.id,
      {
        tableName: 'products',
        fieldKey: 'favorite_color',
        fieldType: 'text',
        fieldLabel: 'Favorite Color',
        options: null,
        sortOrder: '0',
        createdBy: DEMO_ACTOR_ID,
        updatedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    const fromTemplate = await listApplicableFieldSchemas(db, templateBrand.id, 'products');
    expect(fromTemplate.some((f) => f.fieldKey === 'favorite_color')).toBe(true);

    const fromChild = await listApplicableFieldSchemas(db, childBrand.id, 'products');
    expect(fromChild.some((f) => f.fieldKey === 'favorite_color')).toBe(true);
  });

  it('onboarding copies custom field schemas from template to child brand', async () => {
    const { db, agency, templateBrand } = await seeded();

    await insertCustomFieldSchema(
      db,
      templateBrand.id,
      {
        tableName: 'campaigns_offers',
        fieldKey: 'promo_code_type',
        fieldType: 'select',
        fieldLabel: 'Promo Code Type',
        options: 'fixed,percentage,bogo',
        sortOrder: '0',
        createdBy: DEMO_ACTOR_ID,
        updatedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    const { brand: newBrand } = await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Test Brand With Fields',
      slug: 'test-brand-fields',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    const childSchemas = await listCustomFieldSchemas(db, newBrand.id, 'campaigns_offers');
    expect(childSchemas.some((f) => f.fieldKey === 'promo_code_type')).toBe(true);
  });
});

describe('applyApprovedPromotion', () => {
  it('returns not-found for a nonexistent request', async () => {
    const { db, agency } = await seeded();
    const result = await applyApprovedPromotion(
      db,
      agency.id,
      '00000000-0000-0000-0000-000000000000',
      DEMO_ACTOR_ID,
    );
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('not found');
  });

  it('propagates a custom field schema to all child brands on approval', async () => {
    const { db, agency, templateBrand, childBrand } = await seeded();

    const schema = await insertCustomFieldSchema(
      db,
      templateBrand.id,
      {
        tableName: 'products',
        fieldKey: 'favorite_color',
        fieldType: 'text',
        fieldLabel: 'Favorite Color',
        options: null,
        sortOrder: '0',
        createdBy: DEMO_ACTOR_ID,
        updatedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    const request = await createPromotionRequest(
      db,
      {
        brandId: templateBrand.id,
        tableName: 'custom_field_schemas',
        rowId: schema.id,
        fieldName: 'favorite_color',
        currentValue: '',
        proposedValue: JSON.stringify({
          tableName: 'products',
          fieldKey: 'favorite_color',
          fieldLabel: 'Favorite Color',
        }),
        requestedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    await setPromotionRequestStatus(db, agency.id, request.id, 'approved', DEMO_ACTOR_ID);

    const result = await applyApprovedPromotion(db, agency.id, request.id, DEMO_ACTOR_ID);
    expect(result.applied).toBe(true);
    expect(result.childrenUpdated).toBeGreaterThanOrEqual(1);

    const childSchemas = await listCustomFieldSchemas(db, childBrand.id, 'products');
    expect(childSchemas.some((f) => f.fieldKey === 'favorite_color')).toBe(true);
  });

  it('skips child brands that already have the custom field schema', async () => {
    const { db, agency, templateBrand, childBrand } = await seeded();

    const schema = await insertCustomFieldSchema(
      db,
      templateBrand.id,
      {
        tableName: 'personas',
        fieldKey: 'mood',
        fieldType: 'select',
        fieldLabel: 'Mood',
        options: 'happy,sad,neutral',
        sortOrder: '0',
        createdBy: DEMO_ACTOR_ID,
        updatedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    await insertCustomFieldSchema(
      db,
      childBrand.id,
      {
        tableName: 'personas',
        fieldKey: 'mood',
        fieldType: 'select',
        fieldLabel: 'Mood',
        options: 'happy,sad,neutral',
        sortOrder: '0',
        createdBy: DEMO_ACTOR_ID,
        updatedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    const request = await createPromotionRequest(
      db,
      {
        brandId: templateBrand.id,
        tableName: 'custom_field_schemas',
        rowId: schema.id,
        fieldName: 'mood',
        currentValue: '',
        proposedValue: JSON.stringify({
          tableName: 'personas',
          fieldKey: 'mood',
          fieldLabel: 'Mood',
        }),
        requestedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    await setPromotionRequestStatus(db, agency.id, request.id, 'approved', DEMO_ACTOR_ID);

    const children = await listChildBrands(db, templateBrand.id);
    const result = await applyApprovedPromotion(db, agency.id, request.id, DEMO_ACTOR_ID);
    expect(result.applied).toBe(true);
    expect(result.childrenUpdated).toBe(children.length - 1);
  });

  it('promoted schema is discoverable via listApplicableFieldSchemas for the child', async () => {
    const { db, agency, templateBrand, childBrand } = await seeded();

    const schema = await insertCustomFieldSchema(
      db,
      templateBrand.id,
      {
        tableName: 'angles',
        fieldKey: 'priority',
        fieldType: 'number',
        fieldLabel: 'Priority',
        options: null,
        sortOrder: '1',
        createdBy: DEMO_ACTOR_ID,
        updatedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    const beforePromotion = await listApplicableFieldSchemas(db, childBrand.id, 'angles');
    expect(beforePromotion.some((f) => f.fieldKey === 'priority')).toBe(true);

    const request = await createPromotionRequest(
      db,
      {
        brandId: templateBrand.id,
        tableName: 'custom_field_schemas',
        rowId: schema.id,
        fieldName: 'priority',
        currentValue: '',
        proposedValue: JSON.stringify({
          tableName: 'angles',
          fieldKey: 'priority',
          fieldLabel: 'Priority',
        }),
        requestedBy: DEMO_ACTOR_ID,
      },
      DEMO_ACTOR_ID,
    );

    await setPromotionRequestStatus(db, agency.id, request.id, 'approved', DEMO_ACTOR_ID);
    const result = await applyApprovedPromotion(db, agency.id, request.id, DEMO_ACTOR_ID);
    expect(result.applied).toBe(true);

    const afterPromotion = await listApplicableFieldSchemas(db, childBrand.id, 'angles');
    expect(afterPromotion.some((f) => f.fieldKey === 'priority')).toBe(true);

    const childDirect = await listCustomFieldSchemas(db, childBrand.id, 'angles');
    expect(childDirect.some((f) => f.fieldKey === 'priority')).toBe(true);
  });
});
