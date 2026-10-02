import { describe, expect, it } from 'vitest';

import {
  getTableCapability,
  resolveViewType,
  supportsView,
  TABLE_VIEW_CAPABILITIES,
} from './table-views';

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

  // Talal, 2026-09-28 (AI-18): Kanban belongs to Creative Briefs. The five data tables are a grid
  // you work down; the board over the same rows was never read and is gone, group-by fields and all.
  it('none of the five data tables offers kanban, and none declares a group-by field', () => {
    for (const key of ['products', 'personas', 'angles', 'themes', 'concepts']) {
      const cap = TABLE_VIEW_CAPABILITIES[key];
      expect(cap?.supportedViews, key).toEqual(['grid', 'gallery']);
      expect(cap?.kanbanFields, key).toEqual([]);
    }
  });

  // AI-34: Production Status is hidden from the Concepts grid and form, and with the board gone it
  // is no longer offered as a lens either. The database column stays (it holds imported data).
  it('Production Status is no longer a group-by option anywhere', () => {
    for (const [key, cap] of Object.entries(TABLE_VIEW_CAPABILITIES)) {
      expect(
        cap.kanbanFields.map((entry) => entry.field),
        key,
      ).not.toContain('productionStatus');
    }
  });

  it('Creative Briefs keeps its editor Kanban and every group-by it had', () => {
    const cap = TABLE_VIEW_CAPABILITIES['briefs'];
    expect(cap?.supportedViews).toContain('kanban');
    expect(cap?.kanbanFields.map((entry) => entry.field)).toContain('editorStage');
  });
});

describe('resolveViewType', () => {
  it('keeps a view the table supports', () => {
    expect(resolveViewType('concepts', 'gallery')).toBe('gallery');
    expect(resolveViewType('briefs', 'kanban')).toBe('kanban');
  });

  it('falls back when a saved or shared view is no longer offered', () => {
    expect(resolveViewType('concepts', 'kanban')).toBe('grid');
    expect(resolveViewType('personas', 'timeline')).toBe('grid');
  });

  it('honours an explicit fallback, and the table first view when that is unsupported too', () => {
    expect(resolveViewType('concepts', 'kanban', 'gallery')).toBe('gallery');
    expect(resolveViewType('campaigns', 'kanban', 'gallery')).toBe('grid');
  });

  it('passes an unknown table key through rather than second-guessing it', () => {
    expect(resolveViewType('nonexistent', 'kanban')).toBe('kanban');
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
