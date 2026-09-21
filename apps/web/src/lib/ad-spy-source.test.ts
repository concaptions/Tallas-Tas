import { demoCompetitorAds, DEMO_BRAND_ID } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { loadCompetitorAds } from './ad-spy-source';

describe('loadCompetitorAds (demo mode)', () => {
  const deps = { demoMode: () => true };

  it('returns demo competitor ads', async () => {
    const result = await loadCompetitorAds(deps);
    expect(result.source).toBe('demo');
    expect(result.rows).toHaveLength(demoCompetitorAds.length);
  });

  it('every row belongs to the demo brand', async () => {
    const { rows } = await loadCompetitorAds(deps);
    for (const row of rows) {
      expect(row.brandId).toBe(DEMO_BRAND_ID);
    }
  });
});
