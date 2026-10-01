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

  it('galleryFields is only listed on tables that support the gallery', () => {
    // A table may offer the gallery with no media field: its cards then show the record's initial
    // on a coloured tile (Sprint 7). The reverse never holds — a media field with no gallery is dead.
    for (const cap of Object.values(TABLE_VIEW_CAPABILITIES)) {
      if (cap.galleryFields.length > 0) {
        expect(cap.supportedViews).toContain('gallery');
      }
    }
  });

  it('the six core tables all offer the gallery', () => {
    for (const key of ['products', 'personas', 'angles', 'themes', 'concepts', 'creators']) {
      expect(TABLE_VIEW_CAPABILITIES[key]?.supportedViews, key).toContain('gallery');
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

  it('products is grid and gallery, never kanban (it has no status to group by)', () => {
    const cap = TABLE_VIEW_CAPABILITIES['products'];
    expect(cap).toBeDefined();
    expect(cap?.supportedViews).toEqual(['grid', 'gallery']);
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
