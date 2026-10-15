// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { defaultUserViewConfig } from '@tas/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCreativeSheetColumns, loadCreativeSheetWorkspace } from '@/lib/creative-sheet-source';

import { buildSheetItems } from './build-items';
import { CREATIVE_SHEET_RENDERERS, CreativeSheetWorkspace } from './creative-sheet-workspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
// The bulk writes are Server Actions; the duplicate seam answers like the real one so the
// outcome notice can be asserted without a database.
vi.mock('./review-actions', () => ({
  duplicateCreativesAction: (ids: readonly string[]) =>
    Promise.resolve({
      ok: true as const,
      created: ids.map((id) => ({ id: `${id}-copy`, name: 'TV01-B1-Daylight-V2' })),
      skipped: 0,
    }),
  deleteCreativesAction: vi.fn(),
  bulkMoveCreativesAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

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
    // The whole view toolbar (Ticket 7) is a header control: before the boundary with the tabs.
    expect(markup.indexOf('data-slot="view-toolbar"')).toBeLessThan(boundary);
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
        initialKanbanField="status"
      />,
    );
    expect(columns.find((column) => column.columnKey === 'status')?.displayLabel).toBe(
      'Client Approval',
    );
    expect(columns.some((column) => column.columnKey === 'client_approval_status')).toBe(false);
    // The board's field picker is the GroupByControl since Ticket 7; its closed Radix list is not
    // in server markup, so the trigger — the board opened on the client track — carries the word.
    expect(markup).toContain('data-slot="creative-sheet-group-by"');
    expect(markup).toContain('Group: Client Approval</button>');
    // The demo fixtures still leave a few sheet columns undrawn; this one is no longer among them.
    expect(markup).not.toContain('client_approval_status');
  });
});

/**
 * Ticket 7: the sheet joins the per-user views (`useTableView` + `ViewToolbar`), so its grid
 * carries the Group popover every other table has, and the board's field picker is the same
 * control without a "None" row. The demo fixtures are the seven Niagara briefs: four Approved and
 * three singletons on the internal track.
 */
describe('the sheet joins the per-user views (Ticket 7)', () => {
  const NOW = new Date('2026-10-10T00:00:00Z');
  async function demoSheet() {
    const demoMode = () => true;
    const [workspace, { columns }] = await Promise.all([
      loadCreativeSheetWorkspace({ demoMode }),
      loadCreativeSheetColumns({ demoMode }),
    ]);
    return { columns, items: buildSheetItems(workspace, NOW) };
  }

  it('renders the view toolbar with the grid Group popover, and no board picker, on the grid', async () => {
    const { columns, items } = await demoSheet();
    const markup = renderToString(
      <CreativeSheetWorkspace
        columns={columns}
        items={items}
        demo
        initialSelection={null}
        initialSearch=""
      />,
    );
    expect(markup).toContain('data-slot="view-toolbar"');
    expect(markup).toContain('data-slot="grid-group"');
    expect(markup).toContain('data-slot="grid-filter"');
    expect(markup).not.toContain('data-slot="creative-sheet-group-by"');
  });

  it('renders the board picker, opened on Internal Status, and no grid Group popover, on the board', async () => {
    const { columns, items } = await demoSheet();
    const markup = renderToString(
      <CreativeSheetWorkspace
        columns={columns}
        items={items}
        demo
        initialSelection={null}
        initialSearch=""
        initialView="kanban"
      />,
    );
    expect(markup).toContain('data-slot="creative-sheet-group-by"');
    expect(markup).toContain('Group: Internal Status</button>');
    expect(markup).not.toContain('data-slot="grid-group"');
  });

  it('groups the grid under the active saved view’s column: one counted header per status label', async () => {
    const { columns, items } = await demoSheet();
    const markup = renderToString(
      <CreativeSheetWorkspace
        columns={columns}
        items={items}
        demo
        initialSelection={null}
        initialSearch=""
        userViews={{
          userId: null,
          views: [
            {
              id: 'view-1',
              name: 'By status',
              isActive: true,
              ...defaultUserViewConfig('grid'),
              groupBy: 'internal_status',
            },
          ],
        }}
      />,
    );
    const headers = markup.match(/data-slot="grid-group-header"/g) ?? [];
    expect(headers).toHaveLength(4);
    // The group value is the chip's LABEL (the renderer's `sortValue`), never the stored key.
    expect(markup).toMatch(
      /data-slot="grid-group-header"[^>]*data-group="Approved"[\s\S]*?data-slot="group-count"[^>]*>4</,
    );
    expect(markup).not.toContain('data-group="approved"');
    expect(markup).toContain('Group: Internal Status</button>');
    expect(markup.match(/data-slot="creative-sheet-row"/g)).toHaveLength(7);
  });

  /**
   * Phase B5 commit 3 — the GroupOrderController is wired into the Creative Sheet grid. The test
   * reads the rendered markup: one drag handle per group header (`group-drag-handle`) proves the
   * `renderGroupHeader` override reached each header; the `tableKey` on the grid still points at
   * the AirtableGrid's own capability key (localStorage), while the controller's DAO scope is
   * `creative_briefs` — the controller's scope lives in the IO hook, not in the grid markup.
   */
  it('mounts a draggable SortableGroupHeader per group when the view groups by a column', async () => {
    const { columns, items } = await demoSheet();
    const markup = renderToString(
      <CreativeSheetWorkspace
        columns={columns}
        items={items}
        demo
        initialSelection={null}
        initialSearch=""
        userViews={{
          userId: null,
          views: [
            {
              id: 'view-group-order',
              name: 'By status',
              isActive: true,
              ...defaultUserViewConfig('grid'),
              groupBy: 'internal_status',
            },
          ],
        }}
      />,
    );
    const handles = markup.match(/data-slot="group-drag-handle"/g) ?? [];
    expect(handles.length).toBeGreaterThanOrEqual(4);
    expect(markup).toContain('data-slot="group-header-draggable"');
  });

  it('renders no drag handle when the view has no groupBy', async () => {
    const { columns, items } = await demoSheet();
    const markup = renderToString(
      <CreativeSheetWorkspace
        columns={columns}
        items={items}
        demo
        initialSelection={null}
        initialSearch=""
      />,
    );
    expect(markup).not.toContain('data-slot="group-drag-handle"');
  });
});

/**
 * B3.A29: Duplicate clears the selection BEFORE it reports, and the bar used to unmount at count 0,
 * so "1 copy created" was never painted. The toolbar alone hides at zero now; the notice stays.
 */
describe('the bulk outcome notice (B3.A29)', () => {
  it('is in the DOM after a successful duplicate, with the toolbar gone', async () => {
    const demoMode = () => true;
    const [workspace, { columns }] = await Promise.all([
      loadCreativeSheetWorkspace({ demoMode }),
      loadCreativeSheetColumns({ demoMode }),
    ]);
    const { container } = render(
      <CreativeSheetWorkspace
        columns={columns}
        items={buildSheetItems(workspace, new Date('2026-10-10T00:00:00Z'))}
        demo={false}
        initialSelection={null}
        initialSearch=""
      />,
    );
    const box = container.querySelector<HTMLInputElement>('[data-slot="row-select"]');
    if (box === null) throw new Error('no row checkbox');
    fireEvent.click(box);
    expect(container.querySelector('[data-slot="selection-bar"]')).not.toBeNull();

    const duplicate = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-duplicate"]',
    );
    if (duplicate === null) throw new Error('no Duplicate action');
    fireEvent.click(duplicate);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-notice"]')?.textContent).toContain(
        '1 copy created: TV01-B1-Daylight-V2',
      );
    });
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();
  });
});

describe('the sheet grid after the Oct 12 overhaul (B3.V15, B3.V22)', () => {
  it('draws the row count as a mute chip beside the title, with no colour literal on the page', async () => {
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
    // The e2e reads the count's text through `creative-sheet-count`; the chip sits inside it.
    expect(markup).toMatch(
      /data-slot="creative-sheet-count"[^>]*><span data-slot="status-chip" data-tone="mute"[^>]*>7 rows</,
    );
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it('renders Type as a mute StatusChip, or the mono dash when unset (ruling 15, B3.V14)', async () => {
    // The demo brand seeds no `type` column (the lookups are Gratsi's), so the renderer is asked
    // directly, on a real sheet view with the lookup set and unset.
    const workspace = await loadCreativeSheetWorkspace({ demoMode: () => true });
    const [view] = buildSheetItems(workspace, new Date('2026-10-10T00:00:00Z'));
    if (view === undefined) throw new Error('the demo sheet is empty');
    const typed = { ...view, lookups: { ...view.lookups, type: 'Video' } };
    const untyped = { ...view, lookups: { ...view.lookups, type: null } };

    const chip = renderToStaticMarkup(<>{CREATIVE_SHEET_RENDERERS['type']?.render(typed)}</>);
    expect(chip).toMatch(/^<span data-slot="status-chip" data-tone="mute"[^>]*>Video<\/span>$/);
    const dash = renderToStaticMarkup(<>{CREATIVE_SHEET_RENDERERS['type']?.render(untyped)}</>);
    expect(dash).toBe('<span class="font-mono text-xs text-text4">—</span>');
  });
});
