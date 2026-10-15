// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadProductColumns, loadProducts } from '@/lib/products-source';

import { ProductsWorkspace, type ProductItem } from './products-workspace';

/**
 * The Ticket 8 multi-select wiring on the Products grid, with the one bulk Server Action mocked
 * (`./bulk-actions`), the way the sheet's workspace test mocks `./review-actions`. What is pinned:
 * ticking a row shows the bar with the page's noun, the right-click menu lists Open / Copy link /
 * Delete in that order (no Duplicate, no Change status — PRD §7, no status column), Delete asks
 * once with the page's detail sentence, a confirmed delete runs the action and refreshes, and demo
 * mode withholds the write with its hint.
 */
const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const deleteProductsAction = vi.hoisted(() =>
  vi.fn((ids: readonly string[]) => Promise.resolve({ ok: true as const, deleted: [...ids] })),
);
vi.mock('./bulk-actions', () => ({ deleteProductsAction }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderProducts(demo: boolean): Promise<RenderResult> {
  const demoMode = () => true;
  const [{ rows }, { columns }] = await Promise.all([
    loadProducts({ demoMode }),
    loadProductColumns({ demoMode }),
  ]);
  const items: ProductItem[] = rows.map((product) => ({
    product,
    linkHost: '',
    collectionHost: null,
    updatedLabel: '',
    updatedTitle: '',
    emailCampaigns: [],
    youtubeCopy: [],
    creativeDesigns: [],
    creators: [],
    metaCopywriting: [],
    personas: [],
    concepts: [],
    angleIds: [],
  }));
  return render(
    <ProductsWorkspace
      items={items}
      columns={columns.map(({ columnKey, displayLabel, displayOrder }) => ({
        columnKey,
        displayLabel,
        displayOrder,
      }))}
      demo={demo}
      initialSelection={null}
      initialSearch=""
      templateColumns={['name', 'link', 'collection_link']}
      userViews={{ userId: null, views: [] }}
    />,
  );
}

function tickFirstRow(container: HTMLElement): void {
  const box = container.querySelector<HTMLInputElement>('[data-slot="row-select"]');
  if (box === null) throw new Error('no row checkbox');
  fireEvent.click(box);
}

describe('the Products grid multi-select (Ticket 8)', () => {
  it('ticking a row shows the bar with the product noun, without opening the panel', async () => {
    const { container } = await renderProducts(false);

    tickFirstRow(container);

    const bar = container.querySelector('[data-slot="selection-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.textContent).toContain('product selected');
    expect(bar?.querySelector('[data-slot="selection-count"]')?.textContent).toBe('1');
    expect(container.querySelector('[data-slot="product-panel"]')).toBeNull();
  });

  it('right-click lists Open, Copy link and Delete, in that order', async () => {
    const { container } = await renderProducts(false);

    const row = container.querySelector('[data-slot="product-row"]');
    if (row === null) throw new Error('no product row');
    fireEvent.contextMenu(row);

    const menu = container.querySelector('[data-slot="row-context-menu"]');
    if (menu === null) throw new Error('no context menu');
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((item) =>
      item.textContent.trim(),
    );
    expect(labels).toEqual(['Open', 'Copy link', 'Delete']);
  });

  it('Delete asks once, with the page detail; the confirmed delete runs the action and refreshes', async () => {
    const { container } = await renderProducts(false);

    const row = container.querySelector('[data-slot="product-row"]');
    const id = row?.getAttribute('data-product-id');
    if (id === null || id === undefined) throw new Error('no product id on the row');
    tickFirstRow(container);

    const del = container.querySelector<HTMLButtonElement>('[data-slot="selection-delete"]');
    if (del === null) throw new Error('no Delete action');
    fireEvent.click(del);

    const confirm = container.querySelector('[data-slot="selection-delete-confirm"]');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Delete 1 product?');
    expect(confirm?.textContent).toContain(
      'Briefs and copy keep their link to a deleted product, but it no longer resolves to a name',
    );
    expect(deleteProductsAction).not.toHaveBeenCalled();

    const yes = container.querySelector<HTMLButtonElement>(
      '[data-slot="selection-delete-confirm-yes"]',
    );
    if (yes === null) throw new Error('no confirming button');
    fireEvent.click(yes);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="selection-notice"]')?.textContent).toBe(
        '1 product deleted.',
      );
    });
    expect(deleteProductsAction).toHaveBeenCalledWith([id]);
    expect(refresh).toHaveBeenCalled();
    // The selection cleared with the write; the notice outlives it (B3.A29).
    expect(container.querySelector('[data-slot="selection-bar"]')).toBeNull();
  });

  it('demo mode withholds Delete everywhere, with the hint', async () => {
    const { container } = await renderProducts(true);

    tickFirstRow(container);

    const del = container.querySelector<HTMLButtonElement>('[data-slot="selection-delete"]');
    expect(del?.disabled).toBe(true);
    expect(del?.closest('[data-slot="disabled-write"]')?.getAttribute('title')).toBe(
      'Sign in required to save changes',
    );

    const row = container.querySelectorAll('[data-slot="product-row"]')[1];
    if (row === undefined) throw new Error('no second product row');
    fireEvent.contextMenu(row);
    const contextDelete = container.querySelector<HTMLButtonElement>(
      '[data-slot="context-delete"]',
    );
    expect(contextDelete?.disabled).toBe(true);
  });
});
