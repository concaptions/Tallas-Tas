import { describe, expect, it } from 'vitest';

import { DEMO_ACTOR_ID } from './demo-data';
import { listInterfaceConfig } from './interface-config';
import { onboardBrand, type InterfacePageDefault } from './onboard';
import { createPromotionRequest, listChildBrands, propagateInterfaceConfig } from './propagation';
import { seed } from './seed';
import { testDb } from './testing';
import { withBrand } from './tenancy';
import { interfacePages } from './schema';

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
