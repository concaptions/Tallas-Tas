import { describe, expect, it } from 'vitest';

import { DEMO_ACTOR_ID } from './demo-data';
import { listInterfaceConfig } from './interface-config';
import { listNotificationSettings } from './notifications';
import { onboardBrand, type InterfacePageDefault } from './onboard';
import { seed } from './seed';
import { testDb } from './testing';

const INTERFACE_DEFAULTS: InterfacePageDefault[] = [
  {
    pageKey: 'concepts',
    label: 'Concepts',
    enabled: true,
    position: 0,
    fields: [
      { fieldName: 'batch', label: 'Batch', visible: true, clientEditable: false, position: 0 },
      {
        fieldName: 'concept_name',
        label: 'Concept name',
        visible: true,
        clientEditable: false,
        position: 1,
      },
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
        label: 'Client Status',
        visible: true,
        clientEditable: true,
        position: 0,
      },
    ],
  },
  {
    pageKey: 'copywriting',
    label: 'Copywriting',
    enabled: true,
    position: 2,
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
  {
    pageKey: 'ugc',
    label: 'UGC Management',
    enabled: true,
    position: 3,
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
  {
    pageKey: 'partnership',
    label: 'Partnership Ads Tracking',
    enabled: true,
    position: 4,
    fields: [
      {
        fieldName: 'creator_name',
        label: 'Creator',
        visible: true,
        clientEditable: false,
        position: 0,
      },
    ],
  },
];

async function seeded() {
  const db = await testDb();
  const result = await seed(db);
  return { db, agency: result.agency, templateBrand: result.templateBrand, users: result.users };
}

describe('onboardBrand', () => {
  it('creates a brand linked to the template', async () => {
    const { db, agency, templateBrand } = await seeded();
    const { brand } = await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Test Brand',
      slug: 'test-brand',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    expect(brand.name).toBe('Test Brand');
    expect(brand.slug).toBe('test-brand');
    expect(brand.agencyId).toBe(agency.id);
    expect(brand.templateBrandId).toBe(templateBrand.id);
    expect(brand.isTemplate).toBe(false);
    expect(brand.status).toBe('active');
  });

  it('creates team assignments for the new brand', async () => {
    const { db, agency, templateBrand, users } = await seeded();
    const user =
      users[0] ??
      (() => {
        throw new Error('no users');
      })();
    const { brand, assignments } = await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Assigned Brand',
      slug: 'assigned-brand',
      actorId: DEMO_ACTOR_ID,
      team: [{ userId: user.id, role: 'csm' }],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    expect(assignments).toHaveLength(1);
    const first = assignments[0];
    expect(first).toBeDefined();
    expect(first?.brandId).toBe(brand.id);
    expect(first?.userId).toBe(user.id);
    expect(first?.role).toBe('csm');
  });

  it('seeds interface config from the template brand', async () => {
    const { db, agency, templateBrand } = await seeded();
    const { brand } = await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Config Brand',
      slug: 'config-brand',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    const config = await listInterfaceConfig(db, brand.id);
    expect(config).toHaveLength(5);
    expect(config.map((p) => p.pageKey)).toEqual([
      'concepts',
      'creatives',
      'copywriting',
      'ugc',
      'partnership',
    ]);
    for (const page of config) {
      expect(page.fields.length).toBeGreaterThan(0);
    }
  });

  it('seeds notification settings with 8 triggers', async () => {
    const { db, agency, templateBrand } = await seeded();
    const { brand } = await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Notify Brand',
      slug: 'notify-brand',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    const settings = await listNotificationSettings(db, brand.id);
    expect(settings).toHaveLength(8);
    const first = settings[0];
    expect(first).toBeDefined();
    expect(first?.slackEnabled).toBe(true);
    expect(first?.emailEnabled).toBe(false);
  });

  it('scopes the new brand data — another brand sees nothing', async () => {
    const { db, agency, templateBrand } = await seeded();
    await onboardBrand(db, {
      agencyId: agency.id,
      templateBrandId: templateBrand.id,
      name: 'Isolated Brand',
      slug: 'isolated-brand',
      actorId: DEMO_ACTOR_ID,
      team: [],
      interfaceDefaults: INTERFACE_DEFAULTS,
    });

    const fakeBrandId = '00000000-0000-4000-8000-ffffffffffff';
    const config = await listInterfaceConfig(db, fakeBrandId);
    expect(config).toHaveLength(0);

    const settings = await listNotificationSettings(db, fakeBrandId);
    expect(settings).toHaveLength(0);
  });
});
