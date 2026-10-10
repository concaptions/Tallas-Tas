import { describe, expect, it } from 'vitest';

import { CLIENT_TAB_KEYS } from './custom-pages';
import {
  STANDARD_PAGE_SLUGS,
  interfacePageKeyForSlug,
  isStandardPageSlug,
  movePage,
} from './pages';

describe('the standard page set', () => {
  it('is the four client tabs and calendar, no exceptions', () => {
    expect(STANDARD_PAGE_SLUGS).toEqual([...CLIENT_TAB_KEYS, 'calendar']);
    expect(isStandardPageSlug('calendar')).toBe(true);
    expect(isStandardPageSlug('partnership-ads')).toBe(false);
  });

  it('maps every standard slug and the partnership module to a PRD §10 page key', () => {
    expect(STANDARD_PAGE_SLUGS.map(interfacePageKeyForSlug)).toEqual([
      'concepts',
      'creatives',
      'ugc',
      'copywriting',
      'calendar',
    ]);
    expect(interfacePageKeyForSlug('partnership-ads')).toBe('partnership');
    expect(interfacePageKeyForSlug('my-custom-view')).toBeNull();
  });
});

describe('movePage', () => {
  const pages = [
    { slug: 'a', sortOrder: 10 },
    { slug: 'b', sortOrder: 20 },
    { slug: 'c', sortOrder: 30 },
  ];

  it('swaps with the neighbour and renumbers densely from 0', () => {
    expect(movePage(pages, 'c', 'up').map((p) => [p.slug, p.sortOrder])).toEqual([
      ['a', 0],
      ['c', 1],
      ['b', 2],
    ]);
    expect(movePage(pages, 'a', 'down').map((p) => p.slug)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the order alone (renumbered) at either end or for an unknown slug', () => {
    expect(movePage(pages, 'a', 'up').map((p) => [p.slug, p.sortOrder])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
    expect(movePage(pages, 'c', 'down').map((p) => p.slug)).toEqual(['a', 'b', 'c']);
    expect(movePage(pages, 'zzz', 'up').map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate its input', () => {
    const copy = pages.map((p) => ({ ...p }));
    movePage(pages, 'b', 'up');
    expect(pages).toEqual(copy);
  });
});
