// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { RegistryBrandHistoryRow } from '@tas/db';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandHistoryTimeline } from './brand-history-timeline';

/**
 * The brand-history timeline (Ticket 14): one entry per per-brand `creators` row — the brand's
 * name, the current client-status chip in `CREATOR_STATUS` words, the assignment date, and the
 * "continue working with" verdict when stored.
 */

const sample: readonly RegistryBrandHistoryRow[] = [
  {
    brandId: 'brand-gratsi',
    brandName: 'Gratsi',
    clientStatus: 'approved',
    continueWorkingWith: true,
    creatorCost: 350,
    createdAt: new Date('2026-08-14T09:00:00.000Z'),
  },
  {
    brandId: 'brand-mc',
    brandName: 'Mattress Central',
    clientStatus: 'disapproved',
    continueWorkingWith: false,
    creatorCost: 180,
    createdAt: new Date('2026-04-20T09:00:00.000Z'),
  },
];

describe('BrandHistoryTimeline', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders one entry per brand with its name, status chip, assignment date and verdict', () => {
    const { container } = render(<BrandHistoryTimeline entries={sample} />);
    const entries = container.querySelectorAll('[data-slot="brand-history-entry"]');
    expect(entries).toHaveLength(2);

    const first = entries[0];
    expect(first?.getAttribute('data-brand-id')).toBe('brand-gratsi');
    expect(first?.querySelector('[data-slot="brand-history-brand"]')?.textContent).toBe('Gratsi');
    expect(first?.querySelector('[data-slot="brand-history-date"]')?.textContent).toBe(
      'Assigned 2026-08-14',
    );
    const continueYes = first?.querySelector('[data-slot="brand-history-continue"]');
    expect(continueYes?.getAttribute('data-value')).toBe('yes');

    const second = entries[1];
    const continueNo = second?.querySelector('[data-slot="brand-history-continue"]');
    expect(continueNo?.getAttribute('data-value')).toBe('no');
  });

  it('omits the "continue" line entirely when the row carries NULL', () => {
    const { container } = render(
      <BrandHistoryTimeline
        entries={[
          {
            brandId: 'b',
            brandName: 'Brand',
            clientStatus: 'approved',
            continueWorkingWith: null,
            creatorCost: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]}
      />,
    );
    expect(container.querySelector('[data-slot="brand-history-continue"]')).toBeNull();
  });

  it('shows the empty-state line when there is no history', () => {
    const { container } = render(<BrandHistoryTimeline entries={[]} />);
    expect(container.querySelector('[data-slot="brand-history-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brand-history-list"]')).toBeNull();
  });

  it('starts collapsed when defaultOpen is false', () => {
    const { container } = render(<BrandHistoryTimeline entries={sample} defaultOpen={false} />);
    const details = container.querySelector('details[data-slot="brand-history"]');
    expect((details as HTMLDetailsElement | null)?.open).toBe(false);
  });
});
