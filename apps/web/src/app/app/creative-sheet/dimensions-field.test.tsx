import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DimensionsField, type DimensionsFieldProps } from './dimensions-field';

/**
 * The Creative Sheet Dimensions field, held to the one rule the brief page's picker broke: choosing
 * a value FIRES THE SAVE. The brief detail page's `DropdownMenuCheckboxItem` only set React state
 * and wrote hidden inputs, so nothing reached the server until "Save brief" — "the values show but
 * the select does not fire". Here the field is a hook-free component whose `Select` calls
 * `onChange` with the NEW array synchronously, and the panel's handler is the server action.
 *
 * This app has no DOM test renderer (`vitest.config.ts`), so the test does what the other
 * component tests here do: calls the component as a function, walks the element tree it returns
 * and invokes the handler the `Select` was given — the same call Radix makes on a pick.
 */
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
  const children: unknown = node.props['children'];
  return findElement(children as ReactNode, predicate);
}

function render(props: Partial<DimensionsFieldProps> = {}) {
  const onChange = vi.fn<DimensionsFieldProps['onChange']>();
  const full: DimensionsFieldProps = {
    value: ['4:5', '1:1'],
    onChange,
    disabled: false,
    saveState: { status: 'idle' },
    ...props,
  };
  const tree = DimensionsField(full);
  return { tree, onChange, markup: renderToStaticMarkup(tree) };
}

/** The `Select` element: the one node in the tree handed an `onValueChange`. */
function selectOf(tree: ReactElement) {
  const select = findElement(
    tree,
    (element) => typeof element.props['onValueChange'] === 'function',
  );
  if (select === undefined) throw new Error('the field renders no Select');
  return select.props['onValueChange'] as (value: string) => void;
}

describe('DimensionsField', () => {
  it('fires onChange with the NEW array the moment a ratio is chosen — no Save button involved', () => {
    const { tree, onChange } = render();

    selectOf(tree)('9:16');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['4:5', '1:1', '9:16']);
  });

  it('does not fire for a ratio the row already carries, so a no-op pick is not a write', () => {
    const { tree, onChange } = render();

    selectOf(tree)('1:1');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a chip through the same callback, with the array minus that value', () => {
    const { tree, onChange } = render({ value: ['4:5', '1:1', '9:16'] });
    const remove = findElement(
      tree,
      (element) =>
        element.props['data-dimension'] === '1:1' && typeof element.props['onClick'] === 'function',
    );
    if (remove === undefined) throw new Error('no remove button for 1:1');

    (remove.props['onClick'] as () => void)();

    expect(onChange).toHaveBeenCalledWith(['4:5', '9:16']);
  });

  it('keeps an imported legacy name visible as a chip and selectable as an option', () => {
    const { tree, markup } = render({ value: ['IG Story / Reel', 'Billboard 970x250'] });
    const option = findElement(tree, (element) => element.props['value'] === 'Billboard 970x250');

    // The mapped name renders as its ratio; the unknown name renders as itself.
    expect(markup).toContain('9:16');
    expect(markup).toContain('Billboard 970x250');
    expect(option).toBeDefined();
  });

  it('shows the pending, saved and error states the panel passes in', () => {
    expect(render({ saveState: { status: 'pending' } }).markup).toContain('Saving…');
    expect(render({ saveState: { status: 'saved' } }).markup).toContain('Saved');
    expect(render({ saveState: { status: 'error', error: 'Nope.' } }).markup).toContain('Nope.');
  });

  it('is inert when disabled: the Select is disabled and no remove buttons are offered', () => {
    const { tree } = render({ disabled: true });
    const select = findElement(
      tree,
      (element) => typeof element.props['onValueChange'] === 'function',
    );
    const remove = findElement(
      tree,
      (element) => element.props['data-slot'] === 'creative-sheet-dimension-remove',
    );

    expect(select?.props['disabled']).toBe(true);
    expect(remove).toBeUndefined();
  });
});
