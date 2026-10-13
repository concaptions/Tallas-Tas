// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAngleColumns, loadAngles } from '@/lib/angles-source';

import { AnglesWorkspace, type AngleItem } from './angles-workspace';

/**
 * The Angles grid's multi-select wiring (Ticket 8): the shared `useGridSelection` +
 * `GridSelectionOverlay` beside the existing grid, with the page's own noun, menu items and delete
 * detail. The bulk writes are Server Actions, so `./bulk-actions` is a seam the way
 * `creative-sheet-workspace.test.tsx` mocks `./review-actions`; everything else is the real
 * workspace over the demo fixtures.
 */

const seam = vi.hoisted(() => ({
  refresh: vi.fn(),
  deleteAnglesAction: vi.fn(),
  bulkMoveAnglesAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: seam.refresh, push: vi.fn() }),
}));
vi.mock('./bulk-actions', () => ({
  deleteAnglesAction: seam.deleteAnglesAction,
  bulkMoveAnglesAction: seam.bulkMoveAnglesAction,
}));

afterEach(() => {
  cleanup();
  seam.refresh.mockReset();
  seam.deleteAnglesAction.mockReset();
  seam.bulkMoveAnglesAction.mockReset();
});

async function demoProps() {
  const demoMode = () => true;
  const [{ rows }, { columns }] = await Promise.all([
    loadAngles({ demoMode }),
    loadAngleColumns({ demoMode }),
  ]);
  const items: AngleItem[] = rows.map((angle) => ({
    angle,
    updatedLabel: 'today',
    updatedTitle: 'today',
  }));
  return { items, columns };
}

async function mount(demo: boolean) {
  const { items, columns } = await demoProps();
  const utils = render(
    <AnglesWorkspace
      columns={columns}
      items={items}
      personas={[]}
      products={[]}
      creativeModulesByAngle={{}}
      conceptsByAngle={{}}
      creativeDesignsByAngle={{}}
      demo={demo}
      initialSelection={null}
      initialSearch=""
      userViews={{ userId: null, views: [] }}
    />,
  );
  return { ...utils, items };
}

function tickFirstRow(container: HTMLElement): void {
  const box = container.querySelector<HTMLInputElement>('[data-slot="row-select"]');
  if (box === null) throw new Error('no row checkbox');
  fireEvent.click(box);
}

describe('the Angles multi-select (Ticket 8)', () => {
  it('ticking a row shows the bar with the page’s noun and its two bulk actions, no Duplicate', async () => {
    const { container } = await mount(false);
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    expect(bar.textContent).toContain('angle selected');
    expect(bar.querySelector('[data-slot="selection-change-status"]')).not.toBeNull();
    expect(bar.querySelector('[data-slot="selection-delete"]')?.textContent).toContain(
      'Delete (1)',
    );
    // No formula names an angle (PRD §7), so no Duplicate anywhere on this page.
    expect(bar.querySelector('[data-slot="selection-duplicate"]')).toBeNull();
  });

  it('right-click lists Open, Copy link and Delete, in that order', async () => {
    const { container } = await mount(false);
    const row = container.querySelector('[data-slot="angle-row"]');
    if (row === null) throw new Error('no angle row');

    fireEvent.contextMenu(row);

    const items = [
      ...container.querySelectorAll('[data-slot="row-context-menu"] [role="menuitem"]'),
    ];
    expect(items.map((item) => item.textContent)).toEqual(['Open', 'Copy link', 'Delete']);
  });

  it('Delete asks once with the page’s detail sentence, then runs the action and reports', async () => {
    const { container, items } = await mount(false);
    const [first] = items;
    if (first === undefined) throw new Error('no fixture angles');
    seam.deleteAnglesAction.mockResolvedValue({ ok: true, deleted: [first.angle.id] });

    tickFirstRow(container);
    const remove = container.querySelector<HTMLButtonElement>('[data-slot="selection-delete"]');
    if (remove === null) throw new Error('no Delete action');
    fireEvent.click(remove);

    // The confirm line carries the question and what the soft delete means for linked rows.
    const confirm = container.querySelector('[data-slot="selection-delete-confirm"]');
    expect(confirm?.textContent).toContain('Delete 1 angle?');
    expect(confirm?.textContent).toContain(
      'Linked concepts and creatives keep their reference and go nameless; nothing is erased.',
    );
    expect(seam.deleteAnglesAction).not.toHaveBeenCalled();

    const yes = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-delete-confirm-yes"]',
    );
    if (yes === null) throw new Error('no confirm button');
    fireEvent.click(yes);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-notice"]')?.textContent).toBe(
        '1 angle deleted.',
      );
    });
    expect(seam.deleteAnglesAction).toHaveBeenCalledWith([first.angle.id]);
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
