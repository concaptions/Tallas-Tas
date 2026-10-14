import { describe, expect, it } from 'vitest';

import { RETIRED_COLUMNS, isRetiredColumn } from './retired-columns';

describe('retired-columns roster', () => {
  it('ships `elements_we_are_testing` on `creative_briefs` as the first retired column', () => {
    expect(RETIRED_COLUMNS[0]).toEqual({
      tableName: 'creative_briefs',
      columnName: 'elements_we_are_testing',
    });
  });

  it('isRetiredColumn: matches a (table, column) pair in the roster', () => {
    expect(isRetiredColumn('creative_briefs', 'elements_we_are_testing')).toBe(true);
    expect(isRetiredColumn('creative_sheet_items', 'elements_we_are_testing')).toBe(true);
  });

  it('isRetiredColumn: a live column on the same table is NOT retired', () => {
    expect(isRetiredColumn('creative_briefs', 'name')).toBe(false);
    expect(isRetiredColumn('concepts', 'elements_we_are_testing')).toBe(false);
  });
});
