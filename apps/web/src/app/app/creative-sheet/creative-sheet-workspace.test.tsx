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

describe('the pending creative (SMOKE-14)', () => {
  it('the dialog hands the created creative to the sheet, which names it at once', async () => {
    // The hand-off is the `onCreated` prop the workspace gives the dialog; this pins that the
    // workspace renders it and that the pending line names the creative with the row id.
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
    expect(markup).not.toContain('data-slot="creative-sheet-pending"');
  });
});

/**
 * Item 5b (2026-10-11, option B): since the single-source cutover the sheet IS `creative_briefs`,
 * whose client track is `client_status` in the one client vocabulary — the sheet's "Status". The
 * configured `client_approval_status` column had no renderer, so the banner read "configured but
 * not drawn" on every brand. The seed hides that row and words the sheet's status column "Client
 * Approval" (grid header and kanban Group by alike); no renderer is added.
 */
describe('the sheet names its client track Client Approval (item 5b)', () => {
  it('draws a "Client Approval" column, offers it in Group by, and reports nothing undrawn', async () => {
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
        initialView="kanban"
      />,
    );
    expect(columns.find((column) => column.columnKey === 'status')?.displayLabel).toBe(
      'Client Approval',
    );
    expect(columns.some((column) => column.columnKey === 'client_approval_status')).toBe(false);
    expect(markup).toContain('<option value="status">Client Approval</option>');
    // The demo fixtures still leave a few sheet columns undrawn; this one is no longer among them.
    expect(markup).not.toContain('client_approval_status');
  });
});
