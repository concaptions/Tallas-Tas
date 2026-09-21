import { describe, expect, it } from 'vitest';
import { assetCategories, demoAssets } from '@tas/db';

import { loadAssets } from './assets-source';

describe('assets source', () => {
  it('loads demo assets in demo mode', async () => {
    const { rows, source } = await loadAssets({ demoMode: () => true });
    expect(source).toBe('demo');
    expect(rows).toHaveLength(demoAssets.length);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('every demo asset has a valid category', () => {
    const valid = new Set<string>(assetCategories);
    for (const asset of demoAssets) {
      expect(valid.has(asset.category)).toBe(true);
    }
  });

  it('every demo asset belongs to the demo brand', () => {
    for (const asset of demoAssets) {
      expect(asset.brandId).toBe('11111111-1111-4111-8111-111111111111');
    }
  });

  it('at least one asset is linked to a concept (mood board)', () => {
    const linked = demoAssets.filter((a) => a.conceptId !== null);
    expect(linked.length).toBeGreaterThan(0);
  });

  it('at least one asset has no concept (standalone B-roll)', () => {
    const standalone = demoAssets.filter((a) => a.conceptId === null);
    expect(standalone.length).toBeGreaterThan(0);
  });
});
