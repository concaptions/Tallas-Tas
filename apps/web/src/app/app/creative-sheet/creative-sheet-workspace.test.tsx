import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { loadCreativeSheetColumns, loadCreativeSheetWorkspace } from '@/lib/creative-sheet-source';

import { buildSheetItems } from './build-items';
import { CreativeSheetWorkspace } from './creative-sheet-workspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

/**
 * The hydration boundary (smoke test, 2026-10-10: "first click ignored" on New creative and the
 * Kanban tab). A click that lands before React has hydrated the root is dropped, and this page
 * hydrates every cell of every row, so the boundary puts the grid at lower priority and the header
 * controls first. `renderToString` marks a Suspense boundary with `<!--$-->`; the assertion is that
 * the New creative button and the view switcher come BEFORE the first marker and the table AFTER
 * it — a boundary that wrapped the whole page would hold neither.
 */
describe('CreativeSheetWorkspace hydration boundary', () => {
  it('hydrates the header controls before the grid: the table sits inside a Suspense boundary', async () => {
    const demoMode = () => true;
    const [workspace, { columns }] = await Promise.all([
      loadCreativeSheetWorkspace({ demoMode }),
      loadCreativeSheetColumns({ demoMode }),
    ]);
    const markup = renderToString(
      <CreativeSheetWorkspace
        columns={columns}
        items={buildSheetItems(workspace, new Date('2026-10-10T00:00:00Z'))}
        demo
        initialSelection={null}
        initialSearch=""
      />,
    );

    const boundary = markup.indexOf('<!--$-->');
    expect(boundary).toBeGreaterThan(0);
    expect(markup.indexOf('data-slot="new-creative"')).toBeLessThan(boundary);
    expect(markup.indexOf('data-slot="tabs-trigger"')).toBeLessThan(boundary);
    expect(markup.indexOf('data-slot="creative-sheet-table"')).toBeGreaterThan(boundary);
  });
});
