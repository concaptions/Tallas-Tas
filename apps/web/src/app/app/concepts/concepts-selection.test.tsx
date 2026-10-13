// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConceptColumns, loadConcepts } from '@/lib/concepts-source';
import { conceptPath } from '@/lib/routes';

import { ConceptsWorkspace } from './concepts-workspace';
import {
  EMPTY_CONCEPT_RECORD,
  clientStatusView,
  internalStatusView,
  type ConceptItem,
} from './fields';

/**
 * The Concepts grid's multi-select wiring (Ticket 8): the shared `useGridSelection` +
 * `GridSelectionOverlay` beside the existing grid, with the page's own noun, its FOUR menu items —
 * a concept has both a panel ("Open") and a real route ("Open full page", AI-52) — and its delete
 * detail. The bulk writes are Server Actions, so `./bulk-actions` is a seam the way
 * `creative-sheet-workspace.test.tsx` mocks `./review-actions`; everything else is the real
 * workspace over the demo fixtures.
 */

const seam = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  deleteConceptsAction: vi.fn(),
  bulkMoveConceptsAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: seam.refresh, push: seam.push }),
}));
vi.mock('./bulk-actions', () => ({
  deleteConceptsAction: seam.deleteConceptsAction,
  bulkMoveConceptsAction: seam.bulkMoveConceptsAction,
}));

afterEach(() => {
  cleanup();
  seam.refresh.mockReset();
  seam.push.mockReset();
  seam.deleteConceptsAction.mockReset();
  seam.bulkMoveConceptsAction.mockReset();
});

async function demoProps() {
  const demoMode = () => true;
  const [{ rows }, { columns }] = await Promise.all([
    loadConcepts({ demoMode }),
    loadConceptColumns({ demoMode }),
  ]);
  const items: ConceptItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    batch: row.batch,
    angleName: row.angleName,
    personaName: row.personaName,
    productName: row.productName,
    themeName: row.themeName,
    href: conceptPath(row.id),
    ...EMPTY_CONCEPT_RECORD,
    status: internalStatusView(row.internalStatus),
    clientStatus: clientStatusView(row.clientStatus),
  }));
  return { items, columns };
}

async function mount(demo: boolean) {
  const { items, columns } = await demoProps();
  const utils = render(
    <ConceptsWorkspace
      columns={columns}
      items={items}
      demo={demo}
      initialView="table"
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

describe('the Concepts multi-select (Ticket 8)', () => {
  it('ticking a row shows the bar with the page’s noun and its two bulk actions, no Duplicate', async () => {
    const { container } = await mount(false);
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    expect(bar.textContent).toContain('concept selected');
    expect(bar.querySelector('[data-slot="selection-change-status"]')).not.toBeNull();
    expect(bar.querySelector('[data-slot="selection-delete"]')?.textContent).toContain(
      'Delete (1)',
    );
    // A concept's name is the Batch-Angle-Theme formula: a copy would collide, so no Duplicate
    // anywhere on this page (PRD §7).
    expect(bar.querySelector('[data-slot="selection-duplicate"]')).toBeNull();
  });

  it('Change status offers BOTH tracks, Internal first (non-negotiable 4)', async () => {
    const { container } = await mount(false);
    tickFirstRow(container);

    const change = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-change-status"]',
    );
    if (change === null) throw new Error('no Change status action');
    fireEvent.click(change);

    const picker = container.querySelector('[data-slot="selection-status-picker"]');
    if (picker === null) throw new Error('no status picker');
    const tracks = [...picker.querySelectorAll('select[aria-label="Track"] option')];
    expect(tracks.map((option) => option.textContent)).toEqual([
      'Internal Status',
      'Client Status',
    ]);
  });

  it('right-click lists Open, Open full page, Copy link and Delete, in that order', async () => {
    const { container } = await mount(false);
    const row = container.querySelector('[data-slot="concept-row"]');
    if (row === null) throw new Error('no concept row');

    fireEvent.contextMenu(row);

    const items = [
      ...container.querySelectorAll('[data-slot="row-context-menu"] [role="menuitem"]'),
    ];
    expect(items.map((item) => item.textContent)).toEqual([
      'Open',
      'Open full page',
      'Copy link',
      'Delete',
    ]);
  });

  it('Delete asks once with the page’s detail sentence, then runs the action and reports', async () => {
    const { container, items } = await mount(false);
    const [first] = items;
    if (first === undefined) throw new Error('no fixture concepts');
    seam.deleteConceptsAction.mockResolvedValue({ ok: true, deleted: [first.id] });

    tickFirstRow(container);
    const remove = container.querySelector<HTMLButtonElement>('[data-slot="selection-delete"]');
    if (remove === null) throw new Error('no Delete action');
    fireEvent.click(remove);

    // The confirm line carries the question and what the soft delete means for linked rows.
    const confirm = container.querySelector('[data-slot="selection-delete-confirm"]');
    expect(confirm?.textContent).toContain('Delete 1 concept?');
    expect(confirm?.textContent).toContain(
      'Linked creatives and copy keep their concept reference and go nameless; nothing is erased.',
    );
    expect(seam.deleteConceptsAction).not.toHaveBeenCalled();

    const yes = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-delete-confirm-yes"]',
    );
    if (yes === null) throw new Error('no confirm button');
    fireEvent.click(yes);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-notice"]')?.textContent).toBe(
        '1 concept deleted.',
      );
    });
    expect(seam.deleteConceptsAction).toHaveBeenCalledWith([first.id]);
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
