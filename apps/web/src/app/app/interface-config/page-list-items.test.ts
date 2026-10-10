import { describe, expect, it } from 'vitest';

import { pageListItems } from './page-list-items';

const row = (over: Partial<Parameters<typeof pageListItems>[0][number]>) => ({
  id: 'x',
  brandId: null,
  slug: 'concepts',
  title: 'Concepts',
  pageKind: 'standard' as const,
  sortOrder: 1,
  isVisible: true,
  ...over,
});

describe('pageListItems', () => {
  it('lists the merged rows in order, the brand row winning and marked overridden', () => {
    const items = pageListItems(
      [
        row({ id: 't1' }),
        row({ id: 't2', slug: 'winners', title: 'Winners', pageKind: 'custom', sortOrder: 9 }),
      ],
      [row({ id: 'b1', brandId: 'brand', isVisible: false, sortOrder: 5 })],
    );
    expect(items.map((i) => [i.slug, i.isVisible, i.overridden, i.isTemplate])).toEqual([
      ['concepts', false, true, false],
      ['winners', true, false, true],
    ]);
  });

  it('never lists the two queue boards: internal tooling, not client pages (SMOKE-20)', () => {
    const items = pageListItems(
      [
        row({ id: 't1' }),
        row({
          id: 'q1',
          slug: 'internal-queue',
          title: 'Internal Queue',
          pageKind: 'custom',
          isVisible: false,
        }),
        row({
          id: 'q2',
          slug: 'client-queue',
          title: 'Client Queue',
          pageKind: 'custom',
          isVisible: false,
        }),
      ],
      [
        row({
          id: 'b2',
          brandId: 'brand',
          slug: 'client-queue',
          pageKind: 'custom',
          isVisible: true,
        }),
      ],
    );
    expect(items.map((i) => i.slug)).toEqual(['concepts']);
  });

  it('falls back to the five standard tabs, inherited and visible, when no standard row exists', () => {
    const items = pageListItems([], []);
    expect(items.map((i) => [i.slug, i.kind, i.isVisible, i.overridden])).toEqual([
      ['concepts', 'standard', true, false],
      ['creative_sheet', 'standard', true, false],
      ['ugc_management', 'standard', true, false],
      ['copywriting', 'standard', true, false],
      ['calendar', 'standard', true, false],
    ]);
  });
});
