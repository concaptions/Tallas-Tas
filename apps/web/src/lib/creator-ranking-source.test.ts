import { demoCreatorRankings, DEMO_BRAND_ID } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { loadCreatorRankings } from './creator-ranking-source';

describe('loadCreatorRankings (demo mode)', () => {
  const deps = { demoMode: () => true };

  it('returns demo creator rankings', async () => {
    const result = await loadCreatorRankings(deps);
    expect(result.source).toBe('demo');
    expect(result.rows).toHaveLength(demoCreatorRankings.length);
  });

  it('every row belongs to the demo brand', async () => {
    const { rows } = await loadCreatorRankings(deps);
    for (const row of rows) {
      expect(row.brandId).toBe(DEMO_BRAND_ID);
    }
  });
});
