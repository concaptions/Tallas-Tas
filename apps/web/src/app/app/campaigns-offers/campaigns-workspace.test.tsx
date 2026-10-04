import { renderToStaticMarkup } from 'react-dom/server';
import { COLUMN_SEED, demoCampaigns } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { gridColumnsFrom } from '@/components/views/resolved-columns';

import { CAMPAIGN_RENDERERS, type CampaignItem } from './campaigns-workspace';

/**
 * The GRATSI-MATCH guarantee on the renderer side (briefs-workspace.test.tsx style): every
 * campaigns_offers column the seed can make the resolver emit — parent set and Gratsi's
 * departures alike — has a renderer, so the "Configured for this brand but not drawn here" notice
 * can never fire for a seeded column.
 */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'campaigns_offers' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

const [fixture] = demoCampaigns;
if (fixture === undefined) {
  throw new Error('the demo fixtures are empty');
}

const item: CampaignItem = {
  campaign: fixture,
  productName: 'Reset Bundle',
  collections: ['BFCM 2026 Collection', 'Gift Sets'],
  emailCampaigns: [{ id: 'e1', label: 'BFCM Early Access — VIP list' }],
  emailFlows: [{ id: 'f1', label: 'Abandoned Cart Recovery' }],
  youtubeCopy: [{ id: 'y1', label: 'Copy 1 · Sleep Like Your Shift Never Happened' }],
  metaCopy: [{ id: 'm1', label: 'Copy 2 · Blackout' }],
  concepts: [{ id: 'c1', label: 'B1-Body Clock-Science' }],
};

describe('CAMPAIGN_RENDERERS', () => {
  it('draws every column the seed can resolve, parent and Gratsi alike', () => {
    const resolved = seededColumns.map((columnKey, index) => ({
      columnKey,
      displayLabel: columnKey,
      displayOrder: index + 1,
    }));

    const grid = gridColumnsFrom(resolved, CAMPAIGN_RENDERERS);

    expect(grid.missing).toEqual([]);
    expect(grid.columns).toHaveLength(seededColumns.length);
  });

  it('renders the reverse-link cells as the far rows’ names, generated titles in font-mono', () => {
    const markupOf = (columnKey: string): string => {
      const renderer = CAMPAIGN_RENDERERS[columnKey];
      if (renderer === undefined) throw new Error(`no renderer for ${columnKey}`);
      return renderToStaticMarkup(<>{renderer.render(item)}</>);
    };

    // The reverse of collections.campaign_id: plain typed names.
    expect(markupOf('collections')).toContain('BFCM 2026 Collection, Gift Sets');
    // Junction-backed links whose labels are generated system titles: font-mono (non-negotiable 6).
    expect(markupOf('youtube_copy_campaigns')).toContain('font-mono');
    expect(markupOf('youtube_copy_campaigns')).toContain('Copy 1');
    expect(markupOf('campaign_concepts')).toContain('font-mono');
    expect(markupOf('copywriting_campaigns')).toContain('Copy 2');
    expect(markupOf('email_flow_campaigns')).toContain('Abandoned Cart Recovery');
    // The generated campaign name itself is system output, always font-mono.
    expect(markupOf('name')).toContain('font-mono');
  });
});
