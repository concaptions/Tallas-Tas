import { demoAdMetrics, DEMO_BRAND_ID } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { loadPerformance } from './performance-source';

describe('loadPerformance (demo mode)', () => {
  const deps = { demoMode: () => true };

  it('returns demo metrics', async () => {
    const result = await loadPerformance(deps);
    expect(result.source).toBe('demo');
    expect(result.rows).toHaveLength(demoAdMetrics.length);
  });

  it('every demo metric belongs to the demo brand', async () => {
    const { rows } = await loadPerformance(deps);
    for (const row of rows) {
      expect(row.brandId).toBe(DEMO_BRAND_ID);
    }
  });

  it('all rows have non-empty ad names', async () => {
    const { rows } = await loadPerformance(deps);
    for (const row of rows) {
      expect(row.adName.length).toBeGreaterThan(0);
    }
  });

  it('concept-linked metrics have valid concept ids', async () => {
    const { rows } = await loadPerformance(deps);
    const linked = rows.filter((r) => r.conceptId !== null);
    expect(linked.length).toBeGreaterThan(0);
  });
});
