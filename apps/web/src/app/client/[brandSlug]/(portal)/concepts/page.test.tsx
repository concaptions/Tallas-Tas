import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ClientConceptsPage from './page';

/**
 * The portal's Concepts tab. Live (Part A2, 2026-10-12): it renders the brand's RESOLVED columns —
 * the labels and order the Interface Config Edit dialog set for this brand — so Gratsi's
 * "Approval" shows as "Approval". Demo: the shipped fixed table. Either way the status chip reads
 * the one client vocabulary's label, never the stored key (SMOKE-33).
 */
const standardTab = vi.hoisted(() => ({
  render: null as null | {
    columns: readonly { columnKey: string; displayLabel: string }[];
    rows: readonly Record<string, unknown>[];
  },
}));

vi.mock('@/lib/client-brand-source', () => ({
  resolveClientBrand: () => Promise.resolve({ id: 'brand-1', name: 'Gratsi', slug: 'gratsi' }),
}));
vi.mock('@/lib/client-interface-config-source', () => ({
  loadStandardTabRender: () => Promise.resolve(standardTab.render),
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

const page = async () =>
  renderToStaticMarkup(
    await ClientConceptsPage({ params: Promise.resolve({ brandSlug: 'gratsi' }) }),
  );

describe('the client portal Concepts table', () => {
  it("live: renders the brand's resolved columns under the brand's labels, chips by label", async () => {
    standardTab.render = {
      columns: [
        { columnKey: 'name', displayLabel: 'Name' },
        { columnKey: 'client_approval_status', displayLabel: 'Approval' },
      ],
      rows: [
        { id: 'c1', name: 'Casual date night', client_approval_status: 'pending_for_approval' },
      ],
    };
    const markup = await page();
    const heads = [...markup.matchAll(/data-column-key="([a-z_]+)"/g)].map((m) => m[1]);
    expect(heads).toEqual(['name', 'client_approval_status']);
    expect(markup).toContain('>Approval<');
    expect(markup).not.toContain('Client Approval');
    expect(markup).toContain('Pending for Approval');
    expect(markup).not.toContain('pending_for_approval');
  });

  it('demo: the fixed table names the status with its label, never the stored key', async () => {
    standardTab.render = null;
    const markup = await page();
    expect(markup).toContain('Pending for Approval');
    expect(markup).not.toContain('pending_for_approval');
    expect(markup).not.toContain('PENDING_FOR_APPROVAL');
  });
});
