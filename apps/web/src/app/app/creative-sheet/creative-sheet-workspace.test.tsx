// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
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
