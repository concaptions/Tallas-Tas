import { describe, expect, it } from 'vitest';

import { DEMO_BRAND_ID, demoOnboardingForms } from './demo-data';
import {
  getOnboardingFormByToken,
  insertOnboardingForm,
  listOnboardingForms,
} from './onboarding-forms';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('onboarding form queries', () => {
  it('seeds demo forms and lists them', async () => {
    const { db, brandId } = await seeded();
    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listOnboardingForms(db, brandId);
    expect(rows).toHaveLength(demoOnboardingForms.length);
  });

  it('finds a form by share token', async () => {
    const { db } = await seeded();
    const first = demoOnboardingForms[0];
    if (first === undefined) throw new Error('no demo onboarding forms');
    const row = await getOnboardingFormByToken(db, first.shareToken);
    expect(row).not.toBeNull();
    expect(row?.title).toBe(first.title);
  });

  it('inserts a new form and retrieves it', async () => {
    const { db, brandId } = await seeded();
    const form = await insertOnboardingForm(
      db,
      brandId,
      {
        title: 'Test Form',
        description: null,
        status: 'draft',
        fieldsJson: '[]',
        submissionsCount: '0',
        shareToken: 'form_test_token',
      },
      'actor_test',
    );
    expect(form.title).toBe('Test Form');
    const all = await listOnboardingForms(db, brandId);
    expect(all.find((r) => r.id === form.id)).toBeDefined();
  });

  it('cross-brand isolation: another brand sees no forms', async () => {
    const { db, otherBrandId } = await seeded();
    const rows = await listOnboardingForms(db, otherBrandId);
    expect(rows).toHaveLength(0);
  });
});
