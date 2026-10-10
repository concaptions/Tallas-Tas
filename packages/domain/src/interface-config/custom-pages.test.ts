import { describe, expect, it } from 'vitest';

import {
  CLIENT_TAB_KEYS,
  CUSTOM_PAGE_FILTER_OPS,
  CUSTOM_PAGE_SOURCE_TABLE_KEYS,
  type CustomInterfacePageView,
  type InterfaceTabVisibilityView,
  clientTabLabel,
  filterOpNeedsValue,
  intersectCustomPageColumns,
  isClientTabKey,
  isCustomPageSourceTableKey,
  mergeCustomPages,
  mergeTabVisibility,
  rowMatchesFilter,
} from './custom-pages';

const BRAND_A = '00000000-0000-0000-0000-00000000000a';
const BRAND_T = '00000000-0000-0000-0000-00000000000t';

function tabRow(
  brandId: string,
  tabKey: (typeof CLIENT_TAB_KEYS)[number],
  isVisible: boolean,
  sortOrder: number,
): InterfaceTabVisibilityView {
  return { brandId, tabKey, isVisible, sortOrder };
}

function pageRow(
  brandId: string | null,
  slug: string,
  overrides: Partial<CustomInterfacePageView> = {},
): CustomInterfacePageView {
  return {
    id: `${slug}-${brandId ?? 'template'}`,
    brandId,
    slug,
    title: slug.replace(/-/g, ' '),
    sourceTableKey: 'creative_briefs',
    filterConfig: {},
    columnConfig: [],
    sortOrder: 0,
    isVisible: true,
    isInherited: brandId !== null,
    ...overrides,
  };
}

describe('CLIENT_TAB_KEYS', () => {
  it('names the four standard tabs in the shipped order', () => {
    expect(CLIENT_TAB_KEYS).toStrictEqual([
      'concepts',
      'creative_sheet',
      'ugc_management',
      'copywriting',
    ]);
  });

  it('narrows the type', () => {
    expect(isClientTabKey('concepts')).toBe(true);
    expect(isClientTabKey('themes')).toBe(false);
  });

  it('labels every key with a human-readable string', () => {
    for (const key of CLIENT_TAB_KEYS) {
      expect(clientTabLabel(key)).not.toBe('');
    }
  });
});

describe('CUSTOM_PAGE_SOURCE_TABLE_KEYS', () => {
  it('covers the six V0 source tables', () => {
    expect(CUSTOM_PAGE_SOURCE_TABLE_KEYS).toStrictEqual([
      'creative_briefs',
      'creators',
      'copywriting',
      'concepts',
      'collections',
      'products',
    ]);
  });

  it('excludes themes (global library, non-negotiable 3)', () => {
    expect(isCustomPageSourceTableKey('themes')).toBe(false);
  });

  it('narrows the type', () => {
    expect(isCustomPageSourceTableKey('creative_briefs')).toBe(true);
  });
});

describe('filterOpNeedsValue', () => {
  it('says value is required for the three value-op branches', () => {
    expect(filterOpNeedsValue('is')).toBe(true);
    expect(filterOpNeedsValue('is_not')).toBe(true);
    expect(filterOpNeedsValue('contains')).toBe(true);
  });

  it('says value is NOT required for the two empty-op branches', () => {
    expect(filterOpNeedsValue('is_empty')).toBe(false);
    expect(filterOpNeedsValue('is_not_empty')).toBe(false);
  });

  it('names every op in CUSTOM_PAGE_FILTER_OPS', () => {
    for (const op of CUSTOM_PAGE_FILTER_OPS) {
      filterOpNeedsValue(op);
    }
  });
});

describe('rowMatchesFilter', () => {
  it('keeps every row for an empty filter', () => {
    expect(rowMatchesFilter({ status: 'approved' }, {})).toBe(true);
    expect(rowMatchesFilter({}, {})).toBe(true);
  });

  it('is matches on exact text', () => {
    expect(
      rowMatchesFilter({ status: 'approved' }, { column: 'status', op: 'is', value: 'approved' }),
    ).toBe(true);
    expect(
      rowMatchesFilter({ status: 'pending' }, { column: 'status', op: 'is', value: 'approved' }),
    ).toBe(false);
  });

  it('is_not inverts', () => {
    expect(
      rowMatchesFilter(
        { status: 'approved' },
        { column: 'status', op: 'is_not', value: 'approved' },
      ),
    ).toBe(false);
  });

  it('contains is case-insensitive', () => {
    expect(
      rowMatchesFilter(
        { title: 'Spring Launch' },
        { column: 'title', op: 'contains', value: 'spring' },
      ),
    ).toBe(true);
  });

  it('is_empty treats null/undefined/whitespace as empty', () => {
    expect(rowMatchesFilter({ note: null }, { column: 'note', op: 'is_empty' })).toBe(true);
    expect(rowMatchesFilter({}, { column: 'note', op: 'is_empty' })).toBe(true);
    expect(rowMatchesFilter({ note: '  ' }, { column: 'note', op: 'is_empty' })).toBe(true);
    expect(rowMatchesFilter({ note: 'hi' }, { column: 'note', op: 'is_empty' })).toBe(false);
  });

  it('is_not_empty inverts is_empty', () => {
    expect(rowMatchesFilter({ note: 'hi' }, { column: 'note', op: 'is_not_empty' })).toBe(true);
    expect(rowMatchesFilter({ note: null }, { column: 'note', op: 'is_not_empty' })).toBe(false);
  });
});

describe('mergeCustomPages', () => {
  it('returns the template page when a child has none', () => {
    const templ = pageRow(null, 'queue');
    expect(mergeCustomPages([templ], [])).toStrictEqual([templ]);
  });

  it("prefers the child's row when the slug collides", () => {
    const templ = pageRow(null, 'queue', { title: 'Template Queue' });
    const child = pageRow(BRAND_A, 'queue', { title: 'Brand Queue' });
    expect(mergeCustomPages([templ], [child])).toStrictEqual([child]);
  });

  it('sorts by sortOrder, then by title', () => {
    const a = pageRow(null, 'b', { sortOrder: 2, title: 'B' });
    const b = pageRow(null, 'a', { sortOrder: 1, title: 'A' });
    const c = pageRow(null, 'c', { sortOrder: 1, title: 'C' });
    expect(mergeCustomPages([a, b, c], [])).toStrictEqual([b, c, a]);
  });
});

describe('mergeTabVisibility', () => {
  it('falls through to the template row when the brand has no row for the tab', () => {
    const templ = tabRow(BRAND_T, 'concepts', true, 1);
    const merged = mergeTabVisibility([templ], []);
    expect(merged.find((row) => row.tabKey === 'concepts')?.isVisible).toBe(true);
  });

  it("prefers the brand's own row when both exist", () => {
    const templ = tabRow(BRAND_T, 'concepts', true, 1);
    const child = tabRow(BRAND_A, 'concepts', false, 1);
    const merged = mergeTabVisibility([templ], [child]);
    const row = merged.find((r) => r.tabKey === 'concepts');
    expect(row?.isVisible).toBe(false);
    expect(row?.brandId).toBe(BRAND_A);
  });

  it('returns one row per CLIENT_TAB_KEYS even when neither the brand nor the template has them', () => {
    const merged = mergeTabVisibility([], []);
    expect(merged).toHaveLength(CLIENT_TAB_KEYS.length);
    for (const row of merged) {
      expect(row.isVisible).toBe(true);
    }
  });

  it('sorts by sortOrder ascending', () => {
    const rows = [
      tabRow(BRAND_T, 'concepts', true, 10),
      tabRow(BRAND_T, 'creative_sheet', true, 5),
      tabRow(BRAND_T, 'ugc_management', true, 20),
      tabRow(BRAND_T, 'copywriting', true, 15),
    ];
    const merged = mergeTabVisibility(rows, []);
    expect(merged.map((row) => row.tabKey)).toStrictEqual([
      'creative_sheet',
      'concepts',
      'copywriting',
      'ugc_management',
    ]);
  });
});

describe('intersectCustomPageColumns', () => {
  const resolver = [
    { columnKey: 'name', displayLabel: 'Name', displayOrder: 1 },
    { columnKey: 'status', displayLabel: 'Status', displayOrder: 2 },
    { columnKey: 'created_at', displayLabel: 'Created', displayOrder: 3 },
  ];

  it('returns the resolver untouched when columnConfig is empty', () => {
    expect(intersectCustomPageColumns(resolver, [])).toStrictEqual(resolver);
  });

  it('picks only the configured columns and preserves their configured order', () => {
    const picks = [
      { columnKey: 'status', displayLabel: 'Status', displayOrder: 1 },
      { columnKey: 'name', displayLabel: 'Name', displayOrder: 2 },
    ];
    const result = intersectCustomPageColumns(resolver, picks);
    expect(result.map((c) => c.columnKey)).toStrictEqual(['status', 'name']);
  });

  it('silently drops a configured column the resolver no longer carries', () => {
    const picks = [
      { columnKey: 'ghost', displayLabel: 'Ghost', displayOrder: 1 },
      { columnKey: 'name', displayLabel: 'Name', displayOrder: 2 },
    ];
    const result = intersectCustomPageColumns(resolver, picks);
    expect(result.map((c) => c.columnKey)).toStrictEqual(['name']);
  });

  it('reads label and order from the resolver, not the pick (admin rename flows through)', () => {
    const picks = [{ columnKey: 'name', displayLabel: 'OLD', displayOrder: 99 }];
    const result = intersectCustomPageColumns(resolver, picks);
    expect(result[0]?.displayLabel).toBe('Name');
    expect(result[0]?.displayOrder).toBe(1);
  });
});

describe('rowMatchesFilter on a boolean column (the Partnership Ads module preset, B5)', () => {
  it("reads a boolean cell as 'true' / 'false', so `for_partnership_ads is true` keeps only partners", () => {
    const filter = { column: 'for_partnership_ads', op: 'is' as const, value: 'true' };
    expect(rowMatchesFilter({ for_partnership_ads: true }, filter)).toBe(true);
    expect(rowMatchesFilter({ for_partnership_ads: false }, filter)).toBe(false);
    expect(rowMatchesFilter({ for_partnership_ads: null }, filter)).toBe(false);
  });
});
