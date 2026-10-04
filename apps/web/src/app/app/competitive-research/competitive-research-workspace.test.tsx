import { renderToStaticMarkup } from 'react-dom/server';
import { COLUMN_SEED, demoCompetitiveResearch } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { gridColumnsFrom } from '@/components/views/resolved-columns';

import {
  COMPETITIVE_RESEARCH_RENDERERS,
  type CompetitiveResearchItem,
} from './competitive-research-workspace';

/**
 * The GRATSI-MATCH guarantee on the renderer side (briefs-workspace.test.tsx style): every
 * competitive_research column the seed can make the resolver emit has a renderer, so the
 * "Configured for this brand but not drawn here" notice can never fire for a seeded column.
 */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'competitive_research' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

const [fixture] = demoCompetitiveResearch;
if (fixture === undefined) {
  throw new Error('the demo fixtures are empty');
}

const item: CompetitiveResearchItem = { entry: fixture, websiteHost: 'casper.com' };

describe('COMPETITIVE_RESEARCH_RENDERERS', () => {
  it('draws every column the seed can resolve — the three previously undrawn ones included', () => {
    const resolved = seededColumns.map((columnKey, index) => ({
      columnKey,
      displayLabel: columnKey,
      displayOrder: index + 1,
    }));

    const grid = gridColumnsFrom(resolved, COMPETITIVE_RESEARCH_RENDERERS);

    expect(grid.missing).toEqual([]);
    expect(grid.columns).toHaveLength(seededColumns.length);
    for (const added of ['facebook_page', 'meta_ads_library', 'analysis']) {
      expect(seededColumns).toContain(added);
    }
  });

  it('renders the three newly drawn cells from the stored row values', () => {
    const markupOf = (columnKey: string): string => {
      const renderer = COMPETITIVE_RESEARCH_RENDERERS[columnKey];
      if (renderer === undefined) throw new Error(`no renderer for ${columnKey}`);
      return renderToStaticMarkup(<>{renderer.render(item)}</>);
    };

    expect(markupOf('facebook_page')).toContain(fixture.facebookPage ?? '');
    expect(markupOf('meta_ads_library')).toContain('Heavy Q4 spending');
    expect(markupOf('analysis')).toContain('Market leader');
  });
});
