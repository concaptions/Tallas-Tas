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

  /**
   * Oct-15 walkthrough follow-up (DEV_NOTICE_PART2): the four Creative Sheet keys dropped from
   * the seed by Oct 14 follow-up #5 kept their `column_definitions` rows on live brands, which
   * made the Column Admin notice flag them. Pinning the roster so a future removal is explicit.
   */
  it('retires the four Creative Sheet keys dropped by Oct 14 follow-up #5', () => {
    expect(isRetiredColumn('creative_sheet_items', 'client_comments')).toBe(true);
    expect(isRetiredColumn('creative_sheet_items', 'used')).toBe(true);
    expect(isRetiredColumn('creative_sheet_items', 'denied_revisions_needed')).toBe(true);
    expect(isRetiredColumn('creative_sheet_items', 'winning')).toBe(true);
  });

  /**
   * `creators.profile_pic_url` renders inside the Name cell (never as its own cell), and
   * `creators.shipping_location` is hidden by the Oct-15 PII_UGC fix. Both are retired so the
   * Column Admin's `missing` notice no longer flags a key the UI deliberately does not draw.
   */
  it('retires the two UGC keys the UGC grid does not draw as cells', () => {
    expect(isRetiredColumn('creators', 'profile_pic_url')).toBe(true);
    expect(isRetiredColumn('creators', 'shipping_location')).toBe(true);
  });

  /**
   * The scoping guard: Concepts' own `client_comments` renderer is live
   * (`concepts-workspace.tsx`), so the Concepts column must not be retired by the Creative
   * Sheet-scoped roster entry.
   */
  it('does not retire concepts.client_comments (Concepts renderer is live)', () => {
    expect(isRetiredColumn('concepts', 'client_comments')).toBe(false);
  });
});
