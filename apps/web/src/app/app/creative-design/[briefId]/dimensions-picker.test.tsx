import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BriefDimensionsPicker, type BriefDimensionsPickerProps } from './dimensions-picker';

/** The first element in the tree the predicate accepts — the dimensions-field test's walker. */
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

function render(props: Partial<BriefDimensionsPickerProps> = {}) {
  const onToggle = vi.fn<BriefDimensionsPickerProps['onToggle']>();
  const tree = BriefDimensionsPicker({
    selected: ['1:1', '9:16'],
    disabled: false,
    saveState: { status: 'idle' },
    onToggle,
    ...props,
  });
  return { tree, onToggle };
}

const option = (tree: ReactElement, key: string) =>
  findElement(tree, (element) => element.props['data-dimension'] === key);

/**
 * The brief page's Dimensions picker, held to the rule the sheet's field already keeps: a tick
 * FIRES THE CHANGE, synchronously, through `onToggle`. Before 2026-10-10 the checkbox items only
 * set React state and re-rendered hidden inputs, so nothing reached the server until "Save brief"
 * — the smoke test's "click 1:1, no network request fires, refresh reverts".
 */
describe('BriefDimensionsPicker', () => {
  it('ticks the ratios the brief carries', () => {
    const { tree } = render();
    expect(option(tree, '1:1')?.props['checked']).toBe(true);
    expect(option(tree, '9:16')?.props['checked']).toBe(true);
    expect(option(tree, '4:5')?.props['checked']).toBe(false);
  });

  it('fires onToggle with the ratio the moment an item is ticked — no Save button involved', () => {
    const { tree, onToggle } = render();
    const item = option(tree, '4:5');
    if (item === undefined) throw new Error('no option for 4:5');

    (item.props['onCheckedChange'] as (checked: boolean) => void)(true);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('4:5');
  });

  it('reads the count of ticked ratios on its trigger', () => {
    const { tree } = render({ selected: ['4:5', '1:1', '9:16'] });
    const trigger = findElement(tree, (e) => e.props['data-slot'] === 'brief-dimensions-trigger');
    expect(trigger?.props['children']).toBe('3 selected');
  });
});
