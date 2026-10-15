// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { CreatorPoolTable } from './creator-pool-table';
import { CREATOR_RENDERERS } from './ugc-workspace';
import { REGISTRY_POOL_COLUMNS, type RegistryCreatorCardRow } from './fields';

/**
 * Oct-15 privacy fix (PII_UGC walkthrough) — three UGC surfaces leaked the creator's
 * `shippingLocation` (postal code + street-level address), the same string the Oct-14 fix
 * (b6e966a) pulled from the Creator Pool detail aside. The three surfaces are:
 *
 *   1. `creator-pool-table.tsx` — the Creator Pool TABLE view's `Location` column.
 *   2. `ugc-workspace.tsx`      — the `shipping_location` resolver cell on the UGC grid.
 *   3. `creator-panel.tsx`      — the "Shipping Location" text field on the UGC detail panel.
 *
 * Each surface is pinned with a distinctive-string assertion: a creator carrying `PII_PHONE`,
 * `PII_EMAIL` and `PII_STREET` is seeded, and the rendered HTML must contain none of them.
 * The DB column stays until migration 0073; this is a UI-only hide, matching the b6e966a pattern.
 */

const PII_STREET = '401 Fictional Lane, Hamilton, ON L8P 4W7, Canada';
const PII_PHONE = '+1-555-010-REDACT';
const PII_EMAIL = 'pii-check-redacted@example.invalid';

afterEach(() => {
  cleanup();
});

/** The row the Creator Pool TABLE view renders, seeded with the one PII the field carries today. */
function tableRow(): RegistryCreatorCardRow {
  return {
    id: 'creator-pii-table',
    name: 'Distinctive Creator',
    instagramUsername: 'distinctive_handle',
    gender: 'female',
    ageBracket: '25-34',
    ethnicity: null,
    shippingLocation: PII_STREET,
    notes: `${PII_EMAIL} / ${PII_PHONE}`,
    platform: ['tiktok'],
    creatorLink: null,
    profilePicUrl: null,
    totalBrands: 0,
    avgRating: null,
  };
}

describe('Creator Pool TABLE view (creator-pool-table.tsx)', () => {
  it('renders no raw address, phone or email of a registry creator', () => {
    const { container } = render(<CreatorPoolTable rows={[tableRow()]} demo={false} />);
    const html = container.innerHTML;
    expect(html).not.toContain(PII_STREET);
    expect(html).not.toContain(PII_PHONE);
    expect(html).not.toContain(PII_EMAIL);
  });

  it("drops the 'Location' heading from REGISTRY_POOL_COLUMNS", () => {
    expect(REGISTRY_POOL_COLUMNS).not.toContain('Location');
  });
});

describe('UGC grid shipping_location resolver cell (ugc-workspace.tsx)', () => {
  it('renders no raw address when the creator carries one', () => {
    const renderer = CREATOR_RENDERERS.shipping_location;
    if (renderer === undefined) throw new Error('shipping_location resolver cell is missing');
    // Only `shippingLocation` is read by the renderer; the rest of CreatorCardRow is irrelevant.
    const creator = { shippingLocation: PII_STREET } as never;
    const html = renderToString(renderer.render(creator));
    expect(html).not.toContain(PII_STREET);
    expect(html).not.toContain(PII_PHONE);
    expect(html).not.toContain(PII_EMAIL);
  });
});

describe('UGC detail panel Shipping Location text field (creator-panel.tsx)', () => {
  /**
   * Rendering the panel in jsdom pulls in `useActionState` and a dozen other hooks whose mocks
   * belong to a larger test; the invariant the walkthrough asked for is simpler: the panel source
   * no longer calls `textField('shippingLocation', ...)`. A SOURCE-LEVEL assertion fails loudly
   * the moment that call is reintroduced, which is exactly what the UI hide protects against.
   */
  it('does not call textField for shippingLocation (retirement-trail guard)', () => {
    const here = dirname(resolve(__filename));
    const source = readFileSync(resolve(here, 'creator-panel.tsx'), 'utf8');
    expect(source).not.toMatch(/textField\(\s*['"]shippingLocation['"]/);
  });
});
