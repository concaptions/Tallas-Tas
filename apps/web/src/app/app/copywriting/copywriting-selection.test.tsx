// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCopyColumns, loadCopyWorkspace } from '@/lib/copy-source';
import { loadCopyTypes } from '@/lib/copy-types-source';

import { buildCopyItems } from './build-items';
import { CopywritingWorkspace } from './copywriting-workspace';

/**
 * The Copywriting grid's multi-select wiring (Ticket 8): the shared `useGridSelection` +
 * `GridSelectionOverlay` beside the existing grid, with the page's own noun — `copy`, whose plural
 * is `copies`, the irregular the `plural` prop exists for — its menu items, TWO status tracks and
 * delete detail. The bulk writes are Server Actions, so `./bulk-actions` is a seam the way
 * `creative-sheet-workspace.test.tsx` mocks `./review-actions`; everything else is the real
 * workspace over the demo fixtures, through the same `buildCopyItems` the page runs.
 */

const seam = vi.hoisted(() => ({
  refresh: vi.fn(),
  deleteCopyAction: vi.fn(),
  bulkMoveCopyAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: seam.refresh, push: vi.fn() }),
}));
vi.mock('./actions', () => ({
  createCopyAction: vi.fn(),
  updateCopyAction: vi.fn(),
  updateCopyClientApproval: vi.fn(),
}));
vi.mock('./bulk-actions', () => ({
  deleteCopyAction: seam.deleteCopyAction,
  bulkMoveCopyAction: seam.bulkMoveCopyAction,
}));

afterEach(() => {
  cleanup();
  seam.refresh.mockReset();
  seam.deleteCopyAction.mockReset();
  seam.bulkMoveCopyAction.mockReset();
});

async function mount(demo: boolean) {
  const demoMode = () => true;
  const [workspace, { columns }, copyTypeResult] = await Promise.all([
    loadCopyWorkspace({ demoMode }),
    loadCopyColumns({ demoMode }),
    loadCopyTypes({ demoMode }),
  ]);
  const items = buildCopyItems(
    {
      rows: workspace.rows,
      campaigns: workspace.campaigns,
      products: workspace.products,
      briefLookups: workspace.briefLookups,
      copyTypes: copyTypeResult.rows,
    },
    new Date(),
  );
  const utils = render(
    <CopywritingWorkspace
      columns={columns}
      items={items}
      creatives={workspace.creatives}
      concepts={workspace.concepts}
      products={workspace.products.map(({ id, name }) => ({ id, name }))}
      copyTypes={copyTypeResult.rows.map(({ id, name }) => ({ id, name }))}
      demo={demo}
      initialSelection={null}
      initialSearch=""
      userViews={{ userId: null, views: [] }}
    />,
  );
  return { ...utils, items };
}

function rowCheckboxes(container: HTMLElement): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('[data-slot="row-select"]')];
}

function tickFirstRow(container: HTMLElement): void {
  const [box] = rowCheckboxes(container);
  if (box === undefined) throw new Error('no row checkbox');
  fireEvent.click(box);
}

describe('the Copywriting multi-select (Ticket 8)', () => {
  it('ticking a row shows the bar with the page’s noun and its two bulk actions, no Duplicate', async () => {
    const { container } = await mount(false);
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    expect(bar.textContent).toContain('copy selected');
    expect(bar.querySelector('[data-slot="selection-change-status"]')).not.toBeNull();
    expect(bar.querySelector('[data-slot="selection-delete"]')?.textContent).toContain(
      'Delete (1)',
    );
    // The Copy # is allocator-generated, never typed (PRD §7), so no Duplicate anywhere here.
    expect(bar.querySelector('[data-slot="selection-duplicate"]')).toBeNull();
  });

  it('two ticked rows pluralise as “copies”, never “copys” (the plural prop)', async () => {
    const { container } = await mount(false);
    const [first, second] = rowCheckboxes(container);
    if (first === undefined || second === undefined) throw new Error('fewer than two rows');
    fireEvent.click(first);
    fireEvent.click(second);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    expect(bar.querySelector('[data-slot="selection-count"]')?.textContent).toBe('2');
    expect(bar.textContent).toContain('copies selected');
    expect(bar.textContent).not.toContain('copys');
  });

  it('Change status offers BOTH tracks; the status track holds back its note-required keys', async () => {
    const { container } = await mount(false);
    tickFirstRow(container);

    const change = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-change-status"]',
    );
    if (change === null) throw new Error('no Change status action');
    fireEvent.click(change);

    const picker = container.querySelector('[data-slot="selection-status-picker"]');
    if (picker === null) throw new Error('no status picker');
    const trackSelect = picker.querySelector<HTMLSelectElement>('select[aria-label="Track"]');
    expect([...(trackSelect?.options ?? [])].map((option) => option.textContent)).toEqual([
      'Status',
      'Client Approval',
    ]);

    // The status track's options: COPY_STATUS minus the two note-required keys (Oct 6 ruling — a
    // bulk move has no per-row reason to store, so those are set one copy at a time).
    const valueOptions = () =>
      [
        ...(container.querySelector<HTMLSelectElement>('[data-slot="selection-status-value"]')
          ?.options ?? []),
      ].map((option) => option.value);
    expect(valueOptions()).toContain('approved');
    expect(valueOptions()).toContain('pending_for_client_review');
    expect(valueOptions()).not.toContain('revisions_needed');
    expect(valueOptions()).not.toContain('disapproved');

    // The client-approval track offers the whole CLIENT_STATUS vocabulary, exactly as the
    // single-row updateCopyClientApproval action accepts it.
    if (trackSelect === null) throw new Error('no track select');
    fireEvent.change(trackSelect, { target: { value: 'clientApprovalStatus' } });
    expect(valueOptions()).toContain('pending_for_approval');
    expect(valueOptions()).toContain('approved');
    expect(valueOptions()).toContain('launched');
  });

  it('right-click lists Open, Copy link and Delete, in that order', async () => {
    const { container } = await mount(false);
    const row = container.querySelector('[data-slot="copy-row"]');
    if (row === null) throw new Error('no copy row');

    fireEvent.contextMenu(row);

    const items = [
      ...container.querySelectorAll('[data-slot="row-context-menu"] [role="menuitem"]'),
    ];
    expect(items.map((item) => item.textContent)).toEqual(['Open', 'Copy link', 'Delete']);
  });

  it('Delete asks once with the page’s detail sentence, then runs the action and reports', async () => {
    const { container, items } = await mount(false);
    const [first] = items;
    if (first === undefined) throw new Error('no fixture copy');
    seam.deleteCopyAction.mockResolvedValue({ ok: true, deleted: [first.id] });

    tickFirstRow(container);
    const remove = container.querySelector<HTMLButtonElement>('[data-slot="selection-delete"]');
    if (remove === null) throw new Error('no Delete action');
    fireEvent.click(remove);

    // The confirm line carries the question and what the soft delete means for linked rows.
    const confirm = container.querySelector('[data-slot="selection-delete-confirm"]');
    expect(confirm?.textContent).toContain('Delete 1 copy?');
    expect(confirm?.textContent).toContain(
      'Linked copy types and campaigns keep their copy reference and go nameless; nothing is erased.',
    );
    expect(seam.deleteCopyAction).not.toHaveBeenCalled();

    const yes = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-delete-confirm-yes"]',
    );
    if (yes === null) throw new Error('no confirm button');
    fireEvent.click(yes);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-notice"]')?.textContent).toBe(
        '1 copy deleted.',
      );
    });
    expect(seam.deleteCopyAction).toHaveBeenCalledWith([first.id]);
    expect(seam.refresh).toHaveBeenCalled();
    // The notice outlives the cleared selection (B3.A29): the toolbar is gone, the line stays.
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();
  });

  it('demo mode disables every bulk write with the shared hint; selecting itself stays live', async () => {
    const { container } = await mount(true);

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    for (const slot of ['selection-change-status', 'selection-delete']) {
      const action = bar.querySelector<HTMLButtonElement>(`[data-slot="${slot}"]`);
      expect(action?.disabled, slot).toBe(true);
      expect(action?.closest('[data-slot="disabled-write"]')?.getAttribute('title'), slot).toBe(
        DEMO_WRITE_HINT,
      );
    }
  });
});
