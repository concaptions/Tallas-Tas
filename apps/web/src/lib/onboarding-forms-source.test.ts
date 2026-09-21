import { demoOnboardingForms, DEMO_BRAND_ID } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { loadOnboardingForms } from './onboarding-forms-source';

describe('loadOnboardingForms (demo mode)', () => {
  const deps = { demoMode: () => true };

  it('returns demo onboarding forms', async () => {
    const result = await loadOnboardingForms(deps);
    expect(result.source).toBe('demo');
    expect(result.rows).toHaveLength(demoOnboardingForms.length);
  });

  it('every row belongs to the demo brand', async () => {
    const { rows } = await loadOnboardingForms(deps);
    for (const row of rows) {
      expect(row.brandId).toBe(DEMO_BRAND_ID);
    }
  });
});
