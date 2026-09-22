import { describe, expect, it } from 'vitest';

import { getTableCapability, supportsView, TABLE_VIEW_CAPABILITIES } from './table-views';

describe('TABLE_VIEW_CAPABILITIES', () => {
  it('every entry includes grid', () => {
    for (const cap of Object.values(TABLE_VIEW_CAPABILITIES)) {
      expect(cap.supportedViews).toContain('grid');
    }
  });

  it('kanban is only listed when kanbanFields is non-empty', () => {
    for (const cap of Object.values(TABLE_VIEW_CAPABILITIES)) {
      if (cap.supportedViews.includes('kanban')) {
        expect(cap.kanbanFields.length).toBeGreaterThan(0);
      }
    }
  });

  it('gallery is only listed when galleryFields is non-empty', () => {
    for (const cap of Object.values(TABLE_VIEW_CAPABILITIES)) {
      if (cap.supportedViews.includes('gallery')) {
        expect(cap.galleryFields.length).toBeGreaterThan(0);
      }
    }
  });

  it('timeline is only listed when timelineDates is set', () => {
    for (const cap of Object.values(TABLE_VIEW_CAPABILITIES)) {
      if (cap.supportedViews.includes('timeline')) {
        expect(cap.timelineDates).not.toBeNull();
      }
    }
  });

  it('campaigns supports timeline with adsLaunchDate/adsEndDate', () => {
    const cap = TABLE_VIEW_CAPABILITIES['campaigns'];
    expect(cap).toBeDefined();
    expect(cap?.supportedViews).toContain('timeline');
    expect(cap?.timelineDates).toEqual({
      startField: 'adsLaunchDate',
      endField: 'adsEndDate',
    });
  });

  it('products is grid-only', () => {
    const cap = TABLE_VIEW_CAPABILITIES['products'];
    expect(cap).toBeDefined();
    expect(cap?.supportedViews).toEqual(['grid']);
  });
});

describe('getTableCapability', () => {
  it('returns the capability for a known table', () => {
    expect(getTableCapability('briefs')).toBeDefined();
  });

  it('returns undefined for an unknown table', () => {
    expect(getTableCapability('nonexistent')).toBeUndefined();
  });
});

describe('supportsView', () => {
  it('returns true for a supported view', () => {
    expect(supportsView('briefs', 'kanban')).toBe(true);
  });

  it('returns false for an unsupported view', () => {
    expect(supportsView('products', 'kanban')).toBe(false);
  });

  it('returns false for an unknown table', () => {
    expect(supportsView('nonexistent', 'grid')).toBe(false);
  });
});
