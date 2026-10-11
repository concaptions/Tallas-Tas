import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ClientConceptsPage from './page';

/**
 * SMOKE-33 (2026-10-11): the portal's Concepts table printed the stored key — "PENDING_FOR_APPROVAL"
 * — as the status chip. The chip reads the one client vocabulary's label.
 */
vi.mock('@/lib/client-brand-source', () => ({
  resolveClientBrand: () => Promise.resolve({ id: 'brand-1', name: 'Gratsi', slug: 'gratsi' }),
}));
vi.mock('@/lib/client-data-source', () => ({
  loadClientConcepts: () =>
    Promise.resolve([
      {
        id: 'c1',
        batch: 'B1',
        category: null,
        name: 'Casual date night',
        conceptStyle: null,
        angleName: 'Date night',
        themeName: null,
        productName: null,
        description: null,
        painPoints: null,
        usp: null,
        personaName: null,
        hookExamples: null,
        clientApprovalStatus: 'approved',
        clientStatus: 'pending_for_approval',
      },
    ]),
}));

describe('the client portal Concepts table', () => {
  it('names the status with its label, never the stored key', async () => {
    const markup = renderToStaticMarkup(
      await ClientConceptsPage({ params: Promise.resolve({ brandSlug: 'gratsi' }) }),
    );
    expect(markup).toContain('Pending for Approval');
    expect(markup).not.toContain('pending_for_approval');
    expect(markup).not.toContain('PENDING_FOR_APPROVAL');
  });
});
