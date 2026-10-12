// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PagesSection, type PageListItem } from './pages-section';

/**
 * SMOKE-32 (2026-10-11): on a live brand a page switch's save takes seconds, and every row was
 * disabled while ANY action was pending — so four of ten rapid flips landed on a disabled switch
 * and did nothing. The switch now shows the value the user asked for the moment they ask
 * (optimistic until the server's rows arrive) and stays clickable while a save is in flight: each
 * click is queued behind the previous save and toggles from the latest requested value, so ten
 * flips are ten saves, alternating, in order.
 */
const seam = vi.hoisted((): { submitted: string[] } => ({ submitted: [] }));

vi.mock('./page-actions', () => ({
  setPageVisibilityAction: async (_previous: unknown, formData: FormData) => {
    const value = formData.get('isVisible');
    seam.submitted.push(typeof value === 'string' ? value : 'not-a-string');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return { ok: true, savedAt: Date.now() };
  },
  reorderPageAction: vi.fn(),
  resetPageAction: vi.fn(),
  editPageAction: vi.fn(),
}));
vi.mock('./custom-page-propagation-actions', () => ({
  requestCustomPagePromotionAction: vi.fn(),
}));
vi.mock('./custom-page-actions', () => ({ createCustomPageAction: vi.fn() }));

const NO_COLUMNS = {
  creative_briefs: [],
  creators: [],
  copywriting: [],
  concepts: [],
  collections: [],
  products: [],
} as const;

const calendar: PageListItem = {
  id: 'cal',
  slug: 'calendar',
  title: 'Calendar',
  kind: 'standard',
  isVisible: true,
  overridden: false,
  isTemplate: true,
};

beforeEach(() => {
  vi.useFakeTimers();
  seam.submitted = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a page switch under rapid clicks (SMOKE-32)', () => {
  it('queues ten flips as ten alternating saves, none lost to a pending save', async () => {
    render(
      <PagesSection
        pages={[calendar]}
        resolverColumnsByTable={NO_COLUMNS}
        demo={false}
        disabled={false}
        canPush={false}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Show Calendar' });

    for (let click = 0; click < 10; click += 1) {
      await act(async () => {
        fireEvent.click(toggle);
        await Promise.resolve();
      });
      // The switch reflects the requested value at once, never the stale server value.
      expect(toggle.getAttribute('aria-checked')).toBe(click % 2 === 0 ? 'false' : 'true');
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });

    expect(seam.submitted).toEqual([
      'false',
      'true',
      'false',
      'true',
      'false',
      'true',
      'false',
      'true',
      'false',
      'true',
    ]);
  });
});
