import { describe, expect, it } from 'vitest';

import { PAGE_PUSH_TABLE, describePromotion } from './describe-promotion';
import {
  PAGE_EDIT_FIELD,
  PAGE_EDIT_TABLE,
  pageEditApplicable,
  pageEditConflicts,
  pageEditOf,
  parsePageEdit,
  serializePageEdit,
  type PageEditPayload,
} from './page-edit';

/**
 * Part B (2026-10-12): the "edit" request kind — one review request that applies a page edit to
 * selected brands or every client brand on approval, as each brand's own override, keeping or
 * overwriting what a brand already customised.
 */
const payload: PageEditPayload = {
  slug: 'concepts',
  targets: ['b-gratsi', 'b-niagara'],
  onConflict: 'skip',
  changes: {
    title: 'Ideas',
    isVisible: true,
    columnConfig: [{ columnKey: 'name', displayLabel: 'Concept', displayOrder: 0 }],
  },
};

describe('parsePageEdit / serializePageEdit', () => {
  it('round-trips a payload and shares the push table name', () => {
    expect(parsePageEdit(serializePageEdit(payload))).toEqual(payload);
    expect(PAGE_EDIT_TABLE).toBe(PAGE_PUSH_TABLE);
  });

  it('refuses anything that is not an edit', () => {
    expect(parsePageEdit('{"slug":"x"}')).toBeNull();
    expect(parsePageEdit('not json')).toBeNull();
    expect(parsePageEdit(serializePageEdit({ ...payload, onConflict: 'maybe' as 'skip' }))).toBe(
      null,
    );
    expect(parsePageEdit(JSON.stringify({ ...payload, targets: [1] }))).toBeNull();
    expect(
      pageEditOf({ tableName: PAGE_EDIT_TABLE, fieldName: 'push', proposedValue: '{}' }),
    ).toBeNull();
    expect(
      pageEditOf({
        tableName: PAGE_EDIT_TABLE,
        fieldName: PAGE_EDIT_FIELD,
        proposedValue: serializePageEdit(payload),
      }),
    ).toEqual(payload);
  });
});

describe('pageEditConflicts / pageEditApplicable', () => {
  it('lists the fields a brand already keeps, and skip leaves them to the brand', () => {
    const conflicts = pageEditConflicts(payload.changes, {
      overriddenFields: ['title', 'sort_order'],
      ownColumns: false,
    });
    expect(conflicts).toEqual(['title']);
    expect(pageEditApplicable(payload.changes, conflicts, 'skip')).toEqual({
      isVisible: true,
      columnConfig: payload.changes.columnConfig,
    });
    expect(pageEditApplicable(payload.changes, conflicts, 'overwrite')).toEqual(payload.changes);
  });

  it("a brand's own tab columns conflict with a column edit; nothing left means null", () => {
    const conflicts = pageEditConflicts(payload.changes, {
      overriddenFields: ['title', 'is_visible'],
      ownColumns: true,
    });
    expect(conflicts).toEqual(['title', 'is_visible', 'column_config']);
    expect(pageEditApplicable(payload.changes, conflicts, 'skip')).toBeNull();
  });
});

describe('describePromotion for an edit', () => {
  it('names the page, the targets and the policy', () => {
    expect(
      describePromotion({
        brandName: 'Creative Hub Template',
        tableName: PAGE_EDIT_TABLE,
        fieldName: PAGE_EDIT_FIELD,
        proposedValue: serializePageEdit(payload),
      }),
    ).toBe(
      `Creative Hub Template requests applying the edit of "Ideas" (concepts) to 2 client brands; a brand's own value for a field is kept.`,
    );
    expect(
      describePromotion({
        brandName: 'Creative Hub Template',
        tableName: PAGE_EDIT_TABLE,
        fieldName: PAGE_EDIT_FIELD,
        proposedValue: serializePageEdit({ ...payload, targets: 'all', onConflict: 'overwrite' }),
      }),
    ).toBe(
      `Creative Hub Template requests applying the edit of "Ideas" (concepts) to every client brand; a brand's own value for a field is overwritten.`,
    );
  });
});
