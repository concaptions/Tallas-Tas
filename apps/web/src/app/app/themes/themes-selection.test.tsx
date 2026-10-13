// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadThemes } from '@/lib/themes-source';

import { ALL_CATEGORIES } from './fields';
import { ThemesWorkspace, type ThemeTab } from './themes-workspace';

/**
 * The Themes grid's multi-select wiring (Ticket 8): the shared `useGridSelection` +
 * `GridSelectionOverlay` beside the existing grid, with the page's own noun and menu items. The
 * bulk write is a Server Action, so `./bulk-actions` is a seam the way
 * `creative-sheet-workspace.test.tsx` mocks `./review-actions`; everything else is the real
 * workspace over the demo fixtures. What is pinned: the GLOBAL library offers NO Delete and NO
 * Change status anywhere — the one bulk action is Archive on the Active tab and Restore on the
 * Archived one, the reversible flip.
 */

const seam = vi.hoisted(() => ({
  refresh: vi.fn(),
  archiveThemesAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: seam.refresh, push: vi.fn() }),
}));
vi.mock('./bulk-actions', () => ({
  archiveThemesAction: seam.archiveThemesAction,
}));

afterEach(() => {
  cleanup();
  seam.refresh.mockReset();
  seam.archiveThemesAction.mockReset();
});

async function mount(demo: boolean, tab: ThemeTab = 'active') {
  const { rows } = await loadThemes({ demoMode: () => true });
  const utils = render(
    <ThemesWorkspace
      themes={rows}
      demo={demo}
      initialCategory={ALL_CATEGORIES}
      initialSearch=""
      initialTab={tab}
      userViews={{ userId: null, views: [] }}
    />,
  );
  return { ...utils, rows };
}

function tickFirstRow(container: HTMLElement): void {
  const box = container.querySelector<HTMLInputElement>('[data-slot="row-select"]');
  if (box === null) throw new Error('no row checkbox');
  fireEvent.click(box);
}

describe('the Themes multi-select (Ticket 8)', () => {
  it('ticking a row shows the bar with the page’s noun and Archive alone — no Delete, ever', async () => {
    const { container } = await mount(false);
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    expect(bar.textContent).toContain('theme selected');
    expect(bar.querySelector('[data-slot="selection-archive"]')?.textContent).toContain(
      'Archive (1)',
    );
    // The library is GLOBAL (non-negotiable 3): no bulk Delete, no Change status, no Duplicate.
    expect(bar.querySelector('[data-slot="selection-delete"]')).toBeNull();
    expect(bar.querySelector('[data-slot="selection-change-status"]')).toBeNull();
    expect(bar.querySelector('[data-slot="selection-duplicate"]')).toBeNull();
  });

  it('right-click lists Open and Copy link, in that order, and nothing destructive', async () => {
    const { container } = await mount(false);
    const row = container.querySelector('[data-slot="theme-row"]');
    if (row === null) throw new Error('no theme row');

    fireEvent.contextMenu(row);

    const items = [
      ...container.querySelectorAll('[data-slot="row-context-menu"] [role="menuitem"]'),
    ];
    expect(items.map((item) => item.textContent)).toEqual(['Open', 'Copy link']);
  });

  it('Archive runs the action with the ticked ids and false, reports its notice, and clears', async () => {
    const { container, rows } = await mount(false);
    const first = rows.filter((theme) => theme.isActive)[0];
    if (first === undefined) throw new Error('no active fixture themes');
    seam.archiveThemesAction.mockResolvedValue({
      ok: true,
      changed: [first.id],
      notice: '1 theme archived.',
    });

    tickFirstRow(container);
    const archive = container.querySelector<HTMLButtonElement>('[data-slot="selection-archive"]');
    if (archive === null) throw new Error('no Archive action');
    fireEvent.click(archive);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-notice"]')?.textContent).toBe(
        '1 theme archived.',
      );
    });
    expect(seam.archiveThemesAction).toHaveBeenCalledWith([first.id], false);
    expect(seam.refresh).toHaveBeenCalled();
    // The notice outlives the cleared selection (B3.A29): the toolbar is gone, the line stays.
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();
  });

  it('the Archived tab offers Restore instead, running the same action with true', async () => {
    const { container, rows } = await mount(false, 'archived');
    const archived = rows.find((theme) => !theme.isActive);
    if (archived === undefined) throw new Error('no archived fixture theme');
    seam.archiveThemesAction.mockResolvedValue({
      ok: true,
      changed: [archived.id],
      notice: '1 theme restored.',
    });

    tickFirstRow(container);
    const restore = container.querySelector<HTMLButtonElement>('[data-slot="selection-restore"]');
    if (restore === null) throw new Error('no Restore action');
    expect(restore.textContent).toContain('Restore (1)');
    expect(container.querySelector('[data-slot="selection-archive"]')).toBeNull();
    fireEvent.click(restore);

    await waitFor(() => {
      expect(seam.archiveThemesAction).toHaveBeenCalledWith([archived.id], true);
    });
  });

  it('demo mode disables the one bulk write with the shared hint; selecting itself stays live', async () => {
    const { container } = await mount(true);

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    if (bar === null) throw new Error('no selection bar');
    const archive = bar.querySelector<HTMLButtonElement>('[data-slot="selection-archive"]');
    expect(archive?.disabled).toBe(true);
    expect(archive?.closest('[data-slot="disabled-write"]')?.getAttribute('title')).toBe(
      DEMO_WRITE_HINT,
    );
  });
});
