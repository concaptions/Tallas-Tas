import { demoUploadLinks, DEMO_BRAND_ID } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { loadUploadLinks } from './upload-links-source';

describe('loadUploadLinks (demo mode)', () => {
  const deps = { demoMode: () => true };

  it('returns demo upload links', async () => {
    const result = await loadUploadLinks(deps);
    expect(result.source).toBe('demo');
    expect(result.rows).toHaveLength(demoUploadLinks.length);
  });

  it('every row belongs to the demo brand', async () => {
    const { rows } = await loadUploadLinks(deps);
    for (const row of rows) {
      expect(row.brandId).toBe(DEMO_BRAND_ID);
    }
  });
});
