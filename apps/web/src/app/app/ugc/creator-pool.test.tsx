// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { RegistryBrandHistoryRow, RegistryCreatorListRow } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreatorPool } from './creator-pool';

/**
 * Oct-14 privacy fix (PII redaction in the Creator Pool detail aside): the aside used to render
 * a "Location" dt/dd pair with the full `shippingLocation` string. In production that column
 * holds the creator's postal-code-level home address (e.g. "Hamilton, ON L8P 4W7, Canada"), which
 * every agency admin and brand manager could read. The pair is pulled; this test pins the aside
 * to never render the raw address, phone or email of a selected creator even when the schema
 * fields are populated with distinctive strings.
 */

const seam = vi.hoisted(() => ({
  getRegistryCreatorHistoryAction: vi.fn(),
  getRegistryCreatorRatingsAction: vi.fn(),
  listRegistryCreatorsAction: vi.fn(),
  addRegistryCreatorToBrandAction: vi.fn(),
}));

vi.mock('./registry-actions', () => ({
  listRegistryCreatorsAction: seam.listRegistryCreatorsAction,
  getRegistryCreatorHistoryAction: seam.getRegistryCreatorHistoryAction,
  getRegistryCreatorRatingsAction: seam.getRegistryCreatorRatingsAction,
  addRegistryCreatorToBrandAction: seam.addRegistryCreatorToBrandAction,
}));

afterEach(() => {
  cleanup();
  seam.getRegistryCreatorHistoryAction.mockReset();
  seam.getRegistryCreatorRatingsAction.mockReset();
  seam.listRegistryCreatorsAction.mockReset();
  seam.addRegistryCreatorToBrandAction.mockReset();
});

// Distinctive PII values the aside must NEVER render. These are the four classes the ticket
// enumerates: raw address, home_address, phone, email. The schema stores a postal-code-level
// address under `shippingLocation`; phone and email are not on the row shape yet, but the
// contract asserts they would never leak if added without this gate.
const PII_ADDRESS = '401 Fictional Lane, Hamilton, ON L8P 4W7, Canada';
const PII_HOME = '401 Fictional Lane';
const PII_EMAIL = 'pii-check-redacted@example.invalid';
const PII_PHONE = '+1-555-010-REDACT';

function seededCreator(): RegistryCreatorListRow {
  return {
    id: 'creator-pii-01',
    name: 'Distinctive Creator',
    instagramUsername: 'distinctive_handle',
    profilePicUrl: null,
    creatorLink: null,
    platform: ['tiktok'],
    ageBracket: '25-34',
    gender: 'female',
    ethnicity: null,
    // Loaded with the full address to prove the Location block is gone.
    shippingLocation: PII_ADDRESS,
    totalBrands: 0,
    totalProjects: 0,
    avgRating: null,
    tags: [],
    // Loaded with phone+email+home_address so a future render of `notes` would surface them;
    // the aside must not spill them to the page.
    notes: `${PII_EMAIL} / ${PII_PHONE} / ${PII_HOME}`,
    normalizedInstagram: 'distinctive_handle',
  };
}

/**
 * Oct 15 EMBARRASSING sub-fix (d): the "Add to {brand}" button fired even when the creator was
 * already on the current brand, which left the viewer with a useless click and the toast
 * "Already on this brand". The grid now hides the button and renders an "In {brand}" badge
 * instead, guarded on the server-preloaded brand history (`initialHistoryByCreatorId`).
 */
describe('CreatorPool "Add to {brand}" button guard (Oct 15 EMBARRASSING sub-fix d)', () => {
  function historyRow(brandName: string): RegistryBrandHistoryRow {
    return {
      brandName,
      brandId: `brand-${brandName.toLowerCase()}`,
      clientStatus: 'pending',
      continueWorkingWith: null,
      creatorCost: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
  }

  it('hides the Add button and renders "In Gratsi" when the creator is already in Gratsi', () => {
    const row = seededCreator();
    const { container } = render(
      <CreatorPool
        brandName="Gratsi"
        demo={false}
        initialCreators={[row]}
        initialHistoryByCreatorId={new Map([[row.id, [historyRow('Gratsi')]]])}
      />,
    );
    const card = container.querySelector('[data-slot="pool-card"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector('[data-slot="add-to-brand"]')).toBeNull();
    expect(card?.querySelector('[data-slot="in-current-brand"]')?.textContent).toBe('In Gratsi');
  });

  it('still renders the Add button when the creator has history on OTHER brands but not Gratsi', () => {
    const row = seededCreator();
    const { container } = render(
      <CreatorPool
        brandName="Gratsi"
        demo={false}
        initialCreators={[row]}
        initialHistoryByCreatorId={
          new Map([[row.id, [historyRow('Niagara'), historyRow('Mattress Central')]]])
        }
      />,
    );
    const card = container.querySelector('[data-slot="pool-card"]');
    expect(card?.querySelector('[data-slot="add-to-brand"]')?.textContent).toBe('Add to Gratsi');
    expect(card?.querySelector('[data-slot="in-current-brand"]')).toBeNull();
  });

  it('renders the Add button when the creator has no history at all', () => {
    const row = seededCreator();
    const { container } = render(
      <CreatorPool brandName="Gratsi" demo={false} initialCreators={[row]} />,
    );
    const card = container.querySelector('[data-slot="pool-card"]');
    expect(card?.querySelector('[data-slot="add-to-brand"]')?.textContent).toBe('Add to Gratsi');
  });
});

describe('the Creator Pool detail aside (Oct-14 privacy fix)', () => {
  it('renders no raw address, phone or email of a selected creator', async () => {
    seam.getRegistryCreatorHistoryAction.mockResolvedValue([]);
    seam.getRegistryCreatorRatingsAction.mockResolvedValue([]);

    const row = seededCreator();
    const { container } = render(
      <CreatorPool brandName="Niagara" demo={false} initialCreators={[row]} />,
    );

    // The gallery renders each pool creator as a card button carrying `data-slot="pool-card"`.
    const card = container.querySelector<HTMLButtonElement>('[data-slot="pool-card"]');
    if (card === null) throw new Error('no pool-card rendered');

    act(() => {
      fireEvent.click(card);
    });

    // The aside's "Brand History" header is only in the DOM once a card is selected.
    await waitFor(() => {
      expect(container.textContent).toContain('Brand History');
    });

    const html = container.innerHTML;
    expect(html).not.toContain(PII_ADDRESS);
    expect(html).not.toContain(PII_HOME);
    expect(html).not.toContain(PII_EMAIL);
    expect(html).not.toContain(PII_PHONE);
    // And no dt labeled "Location" remains anywhere in the panel.
    const panelText = container.textContent;
    expect(panelText).not.toMatch(/\bLocation\b/);
  });
});
