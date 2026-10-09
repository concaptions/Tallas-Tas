import { assetCategories } from '@tas/db/schema';
import { describe, expect, it } from 'vitest';

import {
  assetLibraryFilterFrom,
  assetLibraryHref,
  CLIENT_FOLDERS_FILTER,
  type AssetLibraryFilter,
} from './filter';

/**
 * The type filter lives in the URL (audit item 4). The page reads it with `assetLibraryFilterFrom`
 * and the grid writes it with `assetLibraryHref`; these pin the two to one vocabulary so a chip
 * click, a refresh and the retired Client Assets redirect all land on the same filter.
 */
describe('assetLibraryFilterFrom', () => {
  it('reads every shipped category out of ?type=', () => {
    for (const category of assetCategories) {
      expect(assetLibraryFilterFrom({ type: category })).toBe(category);
    }
  });

  it('is "all" with no params, an unknown type, or a repeated type', () => {
    expect(assetLibraryFilterFrom({})).toBe('all');
    expect(assetLibraryFilterFrom({ type: 'thumbnail' })).toBe('all');
    expect(assetLibraryFilterFrom({ type: ['ad', 'broll'] })).toBe('all');
  });

  it('keeps the retired Client Assets redirect working: ?tab=client-folders wins over ?type=', () => {
    expect(assetLibraryFilterFrom({ tab: CLIENT_FOLDERS_FILTER })).toBe(CLIENT_FOLDERS_FILTER);
    expect(assetLibraryFilterFrom({ tab: CLIENT_FOLDERS_FILTER, type: 'ad' })).toBe(
      CLIENT_FOLDERS_FILTER,
    );
    expect(assetLibraryFilterFrom({ tab: 'uploads' })).toBe('all');
  });
});

describe('assetLibraryHref', () => {
  it('round-trips through assetLibraryFilterFrom for every filter', () => {
    const filters: AssetLibraryFilter[] = ['all', CLIENT_FOLDERS_FILTER, ...assetCategories];
    for (const filter of filters) {
      const url = new URL(assetLibraryHref(filter), 'https://example.test');
      expect(url.pathname).toBe('/app/assets');
      expect(assetLibraryFilterFrom(Object.fromEntries(url.searchParams))).toBe(filter);
    }
  });

  it('writes the bare library for "all" and a ?type= for a category', () => {
    expect(assetLibraryHref('all')).toBe('/app/assets');
    expect(assetLibraryHref('edited_footage')).toBe('/app/assets?type=edited_footage');
    expect(assetLibraryHref(CLIENT_FOLDERS_FILTER)).toBe('/app/assets?tab=client-folders');
  });
});
