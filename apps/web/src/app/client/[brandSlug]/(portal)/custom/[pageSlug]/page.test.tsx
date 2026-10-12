import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ClientCustomPage from './page';

/**
 * Part A (2026-10-12): the portal renders a custom page's columns in the configured ORDER under
 * the configured LABELS — a rename or a reorder in the Edit dialog is what the client sees. An
 * unticked column is gone, and an internal column in a stale config is never drawn.
 */
vi.mock('@/lib/client-brand-source', () => ({
  resolveClientBrand: () => Promise.resolve({ id: 'brand-1', name: 'Gratsi', slug: 'gratsi' }),
}));
vi.mock('@/lib/client-interface-config-source', () => ({
  loadCustomPageRender: () =>
    Promise.resolve({
      page: {
        id: 'p1',
        brandId: 'brand-1',
        slug: 'winners',
        title: 'Winners',
        sourceTableKey: 'creative_briefs',
        filterConfig: {},
        columnConfig: [
          { columnKey: 'client_status', displayLabel: 'Approval', displayOrder: 0 },
          { columnKey: 'name', displayLabel: 'Creative', displayOrder: 1 },
          { columnKey: 'internal_status', displayLabel: 'Internal', displayOrder: 2 },
        ],
        sortOrder: 1,
        isVisible: true,
        isInherited: false,
        pageKind: 'custom',
      },
      rows: [{ id: 'r1', name: 'TAS-TOF-V001', client_status: 'approved', type: 'Video' }],
    }),
}));

describe('the client custom page', () => {
  it('draws the configured columns in order, under their configured labels, nothing internal', async () => {
    const markup = renderToStaticMarkup(
      await ClientCustomPage({
        params: Promise.resolve({ brandSlug: 'gratsi', pageSlug: 'winners' }),
      }),
    );
    const headers = [...markup.matchAll(/data-column-key="([a-z_]+)"[^>]*>([^<]*)</g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(headers).toEqual([
      ['client_status', 'Approval'],
      ['name', 'Creative'],
    ]);
    expect(markup).not.toContain('internal_status');
  });
});
