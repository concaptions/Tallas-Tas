import { renderToStaticMarkup } from 'react-dom/server';
import { COLUMN_SEED, demoCollections } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { gridColumnsFrom } from '@/components/views/resolved-columns';

import { COLLECTION_RENDERERS, type CollectionItem } from './collections-workspace';

/**
 * The GRATSI-MATCH guarantee on the renderer side (briefs-workspace.test.tsx style): every
 * collections column the seed can make the resolver emit — the template's eight and Gratsi's
 * three junction-backed reverse links — has a renderer, so the "Configured for this brand but
 * not drawn here" notice can never fire for a seeded column.
 */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'collections' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

const [fixture] = demoCollections;
if (fixture === undefined) {
  throw new Error('the demo fixtures are empty');
}

const item: CollectionItem = {
  collection: fixture,
  urlHost: 'niagarasleep.com',
  emailCampaigns: [{ id: 'e1', label: 'BFCM Early Access — VIP list' }],
  youtubeCopy: [{ id: 'y1', label: 'Copy 1' }],
  concepts: [{ id: 'c1', label: 'B1-Body Clock-Science' }],
  creativeDesigns: [{ id: 'b1', label: 'TV1-B1-BFCM-V1' }],
  metaCopy: { id: 'm1', label: 'Copy #1' },
  creativeDesign2: { id: 'b2', label: 'TS2-B1-BFCM-V1' },
};

describe('COLLECTION_RENDERERS', () => {
  it('draws every column the seed can resolve, parent and Gratsi alike', () => {
    const resolved = seededColumns.map((columnKey, index) => ({
      columnKey,
      displayLabel: columnKey,
      displayOrder: index + 1,
    }));

    const grid = gridColumnsFrom(resolved, COLLECTION_RENDERERS);

    expect(grid.missing).toEqual([]);
    expect(grid.columns).toHaveLength(seededColumns.length);
  });

  it('renders the reverse links and stored single links as names, never uuids', () => {
    const markupOf = (columnKey: string): string => {
      const renderer = COLLECTION_RENDERERS[columnKey];
      if (renderer === undefined) throw new Error(`no renderer for ${columnKey}`);
      return renderToStaticMarkup(<>{renderer.render(item)}</>);
    };

    // Gratsi's `Copywriting` (youtube_copy_collections) and `Angles` (concept_collections).
    expect(markupOf('youtube_copy_collections')).toContain('Copy 1');
    expect(markupOf('concept_collections')).toContain('B1-Body Clock-Science');
    // The briefs' collection_id read backwards; §7 names are system output, font-mono.
    expect(markupOf('creative_briefs')).toContain('TV1-B1-BFCM-V1');
    expect(markupOf('creative_briefs')).toContain('font-mono');
    // The stored single links resolve to titles, not the uuids the row carries.
    expect(markupOf('copywriting_id')).toContain('Copy #1');
    expect(markupOf('creative_design_2_id')).toContain('TS2-B1-BFCM-V1');
    expect(markupOf('creative_design_2_id')).not.toContain(fixture.creativeDesign2Id ?? 'never');
    // The loose text column renders the note as typed.
    expect(markupOf('creative_design_note')).toContain(fixture.creativeDesignNote ?? '');
  });
});
