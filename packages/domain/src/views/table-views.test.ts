import { describe, expect, it } from 'vitest';

import {
  getTableCapability,
  resolveViewType,
  supportsView,
  TABLE_VIEW_CAPABILITIES,
} from './table-views';

/** The five tables action item 18 names: Kanban is a brief/creator board, never a data table. */
const DATA_TABLES = ['products', 'personas', 'angles', 'themes', 'concepts'] as const;

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

  it('products is grid, gallery and list, never kanban (it has no status to group by)', () => {
    const cap = TABLE_VIEW_CAPABILITIES['products'];
    expect(cap).toBeDefined();
    expect(cap?.supportedViews).toEqual(['grid', 'gallery', 'list']);
  });

  it('the six core tables offer the list — the compact reading of the same rows (AI-17)', () => {
    for (const key of ['products', 'personas', 'angles', 'themes', 'concepts', 'creators']) {
      expect(TABLE_VIEW_CAPABILITIES[key]?.supportedViews, key).toContain('list');
    }
  });

  it('the list stays on the six data tables: no module table grew one unasked', () => {
    // AI-17 names six tables. A list on, say, Performance would be a new product decision,
    // not a side effect of this change.
    for (const [key, cap] of Object.entries(TABLE_VIEW_CAPABILITIES)) {
      if (['products', 'personas', 'angles', 'themes', 'concepts', 'creators'].includes(key)) {
        continue;
      }
      expect(cap.supportedViews, key).not.toContain('list');
    }
  });

  it('no data table offers Kanban, and none keeps a kanbanField (action item 18)', () => {
    for (const key of DATA_TABLES) {
      const cap = TABLE_VIEW_CAPABILITIES[key];
      expect(cap, key).toBeDefined();
      expect(cap?.supportedViews, key).not.toContain('kanban');
      // The group-by list goes with the board: a lane field nothing can render is dead data that
      // the next person wires a board back up from.
      expect(cap?.kanbanFields, key).toEqual([]);
    }
  });

  it('the data tables keep the grid and the gallery — the lens went, the views did not', () => {
    for (const key of DATA_TABLES) {
      expect(TABLE_VIEW_CAPABILITIES[key]?.supportedViews, key).toEqual([
        'grid',
        'gallery',
        'list',
      ]);
    }
  });

  it('briefs and creators keep Kanban: there the lanes ARE the workflow (item 29)', () => {
    expect(TABLE_VIEW_CAPABILITIES['briefs']?.supportedViews).toContain('kanban');
    expect(TABLE_VIEW_CAPABILITIES['creators']?.supportedViews).toContain('kanban');
    expect(TABLE_VIEW_CAPABILITIES['creators']?.kanbanFields.length).toBeGreaterThan(0);
  });
});

describe('resolveViewType', () => {
  it('passes a supported view through', () => {
    expect(resolveViewType('creators', 'kanban')).toBe('kanban');
  });

  it('falls back to the grid when a stale saved view names a dropped lens (item 18)', () => {
    // The exact production row the audit found: one personas view saved as a Kanban.
    expect(resolveViewType('personas', 'kanban')).toBe('grid');
    expect(resolveViewType('concepts', 'kanban')).toBe('grid');
    expect(resolveViewType('themes', 'kanban')).toBe('grid');
    expect(resolveViewType('angles', 'kanban')).toBe('grid');
  });

  it("honours the caller's fallback when the table supports it", () => {
    expect(resolveViewType('personas', 'kanban', 'gallery')).toBe('gallery');
  });

  it("falls back to the table's first view when it supports neither", () => {
    expect(resolveViewType('products', 'timeline', 'kanban')).toBe('grid');
  });

  it('passes an unknown table through: no declared capability is not a refusal', () => {
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
