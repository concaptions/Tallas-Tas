import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PageRow, PushReviewDialog, type PageListItem, type PageRowProps } from './pages-section';

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node as readonly ReactNode[]) {
      const found = findElement(child, predicate);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  if (predicate(node)) return node;
  return findElement(node.props['children'] as ReactNode, predicate);
}

const PAGE: PageListItem = {
  id: 'p1',
  slug: 'ugc_management',
  title: 'UGC Management',
  kind: 'standard',
  isVisible: true,
  overridden: false,
  isTemplate: true,
};

function row(overrides: Partial<PageRowProps> = {}) {
  const handlers = {
    onToggle: vi.fn<PageRowProps['onToggle']>(),
    onMove: vi.fn<PageRowProps['onMove']>(),
    onReset: vi.fn<PageRowProps['onReset']>(),
    onPush: vi.fn<PageRowProps['onPush']>(),
  };
  const tree = PageRow({
    page: PAGE,
    canMoveUp: true,
    canMoveDown: true,
    demo: false,
    disabled: false,
    canPush: true,
    ...handlers,
    ...overrides,
  });
  return { tree, ...handlers };
}

const slot = (tree: ReactElement, name: string, extra: Record<string, unknown> = {}) =>
  findElement(
    tree,
    (e) =>
      e.props['data-slot'] === name && Object.entries(extra).every(([k, v]) => e.props[k] === v),
  );

/**
 * The Pages section's row, hook-free: a switch fires the toggle with the NEXT visibility, an arrow
 * fires the move, the push button opens the review dialog (and never a write), and a non-template
 * row or a non-Admin gets no push button at all.
 */
describe('PageRow', () => {
  it('the switch toggles visibility, synchronously, with the next value', () => {
    const { tree, onToggle } = row();
    (slot(tree, 'page-visibility-switch')?.props['onCheckedChange'] as (c: boolean) => void)(false);
    expect(onToggle).toHaveBeenCalledWith('ugc_management', false);
  });

  it('the arrows move the page a step', () => {
    const { tree, onMove } = row();
    (slot(tree, 'page-move', { 'data-direction': 'down' })?.props['onClick'] as () => void)();
    expect(onMove).toHaveBeenCalledWith('ugc_management', 'down');
    expect(slot(tree, 'page-move', { 'data-direction': 'up' })?.props['disabled']).toBe(false);
  });

  it('push opens the review dialog with the page — the write happens only on confirm', () => {
    const { tree, onPush } = row();
    (slot(tree, 'page-push')?.props['onClick'] as () => void)();
    expect(onPush).toHaveBeenCalledWith(PAGE);
  });

  it('offers no push to a non-Admin, nor on a brand-own row', () => {
    expect(slot(row({ canPush: false }).tree, 'page-push')).toBeUndefined();
    expect(slot(row({ page: { ...PAGE, isTemplate: false } }).tree, 'page-push')).toBeUndefined();
  });

  it('shows Reset only for a brand override, and the inheritance chip reads the state', () => {
    expect(slot(row().tree, 'page-reset')).toBeUndefined();
    const over = row({ page: { ...PAGE, overridden: true } });
    expect(slot(over.tree, 'page-reset')).toBeDefined();
    expect(renderToStaticMarkup(over.tree)).toContain('overridden');
    expect(renderToStaticMarkup(row().tree)).toContain('inherited');
  });
});

describe('PushReviewDialog', () => {
  it('names the page and confirms through onConfirm', () => {
    const onConfirm = vi.fn();
    const tree = PushReviewDialog({ page: PAGE, pending: false, onClose: vi.fn(), onConfirm });
    const confirm = findElement(tree, (e) => e.props['data-slot'] === 'page-push-confirm');
    (confirm?.props['onClick'] as () => void)();
    expect(onConfirm).toHaveBeenCalledWith(PAGE);
    expect(findElement(tree, (e) => e.props['open'] === true)).toBeDefined();
  });
});
