// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCreatorColumns, loadUgc } from '@/lib/ugc-source';

import { UgcWorkspace } from './ugc-workspace';

/**
 * The UGC creators grid's multi-select wiring (Ticket 8): the shared `useGridSelection` +
 * `GridSelectionOverlay` beside the existing grid, with the page's own noun, menu items, TWO status
 * tracks and delete detail — and the selection cleared the moment the tab leaves the creators grid.
 * The bulk writes are Server Actions, so `./bulk-actions` is a seam the way
 * `creative-sheet-workspace.test.tsx` mocks `./review-actions`; everything else is the real
 * workspace over the demo fixtures.
 */

const seam = vi.hoisted(() => ({
  refresh: vi.fn(),
  deleteCreatorsAction: vi.fn(),
  bulkMoveCreatorsAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: seam.refresh, push: vi.fn() }),
}));
vi.mock('./bulk-actions', () => ({
  deleteCreatorsAction: seam.deleteCreatorsAction,
  bulkMoveCreatorsAction: seam.bulkMoveCreatorsAction,
}));

afterEach(() => {
  cleanup();
  seam.refresh.mockReset();
  seam.deleteCreatorsAction.mockReset();
  seam.bulkMoveCreatorsAction.mockReset();
});

async function mount(demo: boolean) {
  const demoMode = () => true;
  const [{ creators, now }, { columns }] = await Promise.all([
    loadUgc({ demoMode }),
    loadCreatorColumns({ demoMode }),
  ]);
  const utils = render(
    <UgcWorkspace
      columns={columns}
      creators={creators}
      partnerships={[]}
      concepts={[]}
      products={[]}
      demo={demo}
      initialTab="creators"
      initialSearch=""
      initialSelection={null}
      initialCollabs={[]}
      userViews={{ userId: null, views: [] }}
      now={now}
    />,
  );
  return { ...utils, creators };
}

function tickFirstRow(container: HTMLElement): void {
  const box = container.querySelector<HTMLInputElement>('[data-slot="row-select"]');
  if (box === null) throw new Error('no row checkbox');
  fireEvent.click(box);
}

describe('the UGC creators multi-select (Ticket 8)', () => {
  it('ticking a row shows the bar with the page’s noun and its two bulk actions, no Duplicate', async () => {
    const { container } = await mount(false);
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    expect(bar.textContent).toContain('creator selected');
    expect(bar.querySelector('[data-slot="selection-change-status"]')).not.toBeNull();
    expect(bar.querySelector('[data-slot="selection-delete"]')?.textContent).toContain(
      'Delete (1)',
    );
    // No formula names a creator (PRD §7), so no Duplicate anywhere on this page.
    expect(bar.querySelector('[data-slot="selection-duplicate"]')).toBeNull();
  });

  it('Change status offers BOTH tracks; the client track holds back its note-required keys', async () => {
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
      'Internal Status',
      'Client Status',
    ]);

    // The client track's options: the vocabulary minus the two note-required keys (Oct 6 ruling —
    // a bulk move has no per-row reason to store, so those are set one creator at a time).
    if (trackSelect === null) throw new Error('no track select');
    fireEvent.change(trackSelect, { target: { value: 'clientStatus' } });
    const valueSelect = container.querySelector<HTMLSelectElement>(
      '[data-slot="selection-status-value"]',
    );
    const offered = [...(valueSelect?.options ?? [])].map((option) => option.value);
    expect(offered).toContain('approved');
    expect(offered).toContain('filming_in_progress');
    expect(offered).not.toContain('revisions_needed');
    expect(offered).not.toContain('disapproved');
  });

  it('right-click lists Open, Copy link and Delete, in that order', async () => {
    const { container } = await mount(false);
    const row = container.querySelector('[data-slot="creator-row"]');
    if (row === null) throw new Error('no creator row');

    fireEvent.contextMenu(row);

    const items = [
      ...container.querySelectorAll('[data-slot="row-context-menu"] [role="menuitem"]'),
    ];
    expect(items.map((item) => item.textContent)).toEqual(['Open', 'Copy link', 'Delete']);
  });

  it('Delete asks once with the page’s detail sentence, then runs the action and reports', async () => {
    const { container, creators } = await mount(false);
    const [first] = creators;
    if (first === undefined) throw new Error('no fixture creators');
    seam.deleteCreatorsAction.mockResolvedValue({ ok: true, deleted: [first.id] });

    tickFirstRow(container);
    const remove = container.querySelector<HTMLButtonElement>('[data-slot="selection-delete"]');
    if (remove === null) throw new Error('no Delete action');
    fireEvent.click(remove);

    // The confirm line carries the question and what the soft delete means for linked rows.
    const confirm = container.querySelector('[data-slot="selection-delete-confirm"]');
    expect(confirm?.textContent).toContain('Delete 1 creator?');
    expect(confirm?.textContent).toContain(
      'Linked collaborations and concepts keep their creator reference and go nameless; nothing is erased.',
    );
    expect(seam.deleteCreatorsAction).not.toHaveBeenCalled();

    const yes = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-delete-confirm-yes"]',
    );
    if (yes === null) throw new Error('no confirm button');
    fireEvent.click(yes);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-notice"]')?.textContent).toBe(
        '1 creator deleted.',
      );
    });
    expect(seam.deleteCreatorsAction).toHaveBeenCalledWith([first.id]);
    expect(seam.refresh).toHaveBeenCalled();
    // The notice outlives the cleared selection (B3.A29): the toolbar is gone, the line stays.
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();
  });

  it('leaving the creators tab clears the selection: the bar never floats over another tab', async () => {
    const { container } = await mount(false);
    tickFirstRow(container);
    expect(container.querySelector('[data-slot="selection-bar"]')).not.toBeNull();

    const partnerships = container.querySelector<HTMLButtonElement>(
      '[data-slot="tabs-trigger"][data-tab="partnerships"]',
    );
    if (partnerships === null) throw new Error('no partnerships tab');
    fireEvent.mouseDown(partnerships, { button: 0 });
    fireEvent.click(partnerships);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();
    });
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
