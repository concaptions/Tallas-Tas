import { renderToStaticMarkup } from 'react-dom/server';
import { COLUMN_SEED, demoCreativeDimensions } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { gridColumnsFrom } from '@/components/views/resolved-columns';

import {
  CREATIVE_DIMENSION_RENDERERS,
  type CreativeDimensionItem,
} from './creative-dimensions-workspace';
import { linkedDesignsForDimension } from './fields';

/**
 * The GRATSI-MATCH guarantee on the renderer side (briefs-workspace.test.tsx style): every
 * creative_dimensions column the seed can make the resolver emit has a renderer, so the
 * "Configured for this brand but not drawn here" notice can never fire for a seeded column.
 */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'creative_dimensions' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

const [fixture] = demoCreativeDimensions;
if (fixture === undefined) {
  throw new Error('the demo fixtures are empty');
}

describe('CREATIVE_DIMENSION_RENDERERS', () => {
  it('draws every column the seed can resolve', () => {
    const resolved = seededColumns.map((columnKey, index) => ({
      columnKey,
      displayLabel: columnKey,
      displayOrder: index + 1,
    }));

    const grid = gridColumnsFrom(resolved, CREATIVE_DIMENSION_RENDERERS);

    expect(grid.missing).toEqual([]);
    expect(grid.columns).toHaveLength(seededColumns.length);
  });

  it('renders the reverse brief link as generated §7 names in font-mono', () => {
    // The demo fixtures exercise the STORED end of the link (`creative_design_id`), so the demo
    // page's cell is proven non-empty here with the same resolution the page runs.
    const linkedDesigns = linkedDesignsForDimension(fixture, [
      { id: fixture.creativeDesignId ?? 'never', name: 'TV1-B1-BFCM-V1', dimensions: [] },
      { id: 'by-name', name: 'TS2-B1-BFCM-V1', dimensions: [fixture.name] },
    ]);
    const item: CreativeDimensionItem = { dimension: fixture, linkedDesigns };

    const renderer = CREATIVE_DIMENSION_RENDERERS['creative_design_id'];
    if (renderer === undefined) throw new Error('no renderer for creative_design_id');
    const markup = renderToStaticMarkup(<>{renderer.render(item)}</>);

    expect(markup).toContain('TV1-B1-BFCM-V1');
    expect(markup).toContain('TS2-B1-BFCM-V1');
    expect(markup).toContain('font-mono');
    expect(markup).not.toContain(fixture.creativeDesignId ?? 'never');
  });
});
