import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Checkbox, checkboxVariants } from './checkbox';

/**
 * The drawn checkbox (B2.V15): a native input that paints itself. Four states on the boards —
 * unchecked, checked, indeterminate, N/A — and the one contract every caller relies on: whatever
 * the caller passes reaches the `<input>`, so `[data-slot="row-select"]`, `.check()` and the
 * hidden-input form posts keep working after the swap.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

function input(): HTMLInputElement {
  return screen.getByRole('checkbox');
}

describe('Checkbox', () => {
  it('is a real checkbox that paints itself: appearance-none, 4px radius, token border and fill', () => {
    render(<Checkbox aria-label="Video Editor QA" />);
    const box = input();

    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(false);
    expect(box.className).toContain('appearance-none');
    expect(box.className).toContain('rounded-sm');
    expect(box.className).toContain('border-line2');
    expect(box.className).toContain('bg-surface2');
    expect(box.className).toContain('checked:bg-accent');
    expect(box.className).not.toContain('rounded-full');
  });

  it('wraps the input in the `checkbox` slot and keeps the caller’s slot on the input itself', () => {
    const { container } = render(<Checkbox data-slot="row-select" aria-label="Select TV01" />);

    expect(container.querySelector('[data-slot="checkbox"] input')).toBe(input());
    expect(input().dataset['slot']).toBe('row-select');
  });

  it('overlays a white tick only while checked, and toggles through the native input', () => {
    const { container } = render(<Checkbox defaultChecked aria-label="Creative Strategist QA" />);
    const tick = container.querySelector('svg.lucide-check');

    expect(input().checked).toBe(true);
    expect(tick?.getAttribute('class')).toContain('peer-checked:block');
    expect(tick?.getAttribute('class')).toContain('text-on-accent');
    expect(container.querySelector('svg.lucide-minus')).toBeNull();

    fireEvent.click(input());
    expect(input().checked).toBe(false);
  });

  it('sets the indeterminate DOM property, reads data-state=some, and draws the bar', () => {
    const { container } = render(
      <Checkbox indeterminate aria-label="Select every row on screen" />,
    );

    expect(input().indeterminate).toBe(true);
    expect(input().dataset['state']).toBe('some');
    expect(container.querySelector('svg.lucide-minus')).not.toBeNull();
    expect(container.querySelector('svg.lucide-check')).toBeNull();
  });

  it('lets the caller’s data-state win over the derived one', () => {
    render(<Checkbox indeterminate data-state="some-rows" aria-label="Select every row" />);

    expect(input().dataset['state']).toBe('some-rows');
  });

  it('draws the N/A variant dashed and transparent on the --line border', () => {
    const { container } = render(
      <Checkbox variant="na" disabled aria-label="Graphic Designer QA" />,
    );

    expect(input().className).toContain('border-dashed');
    expect(input().className).toContain('border-line');
    expect(input().className).toContain('bg-transparent');
    expect(input().className).not.toContain('bg-surface2');
    expect(input().disabled).toBe(true);
    expect(container.querySelector('[data-slot="checkbox"]')?.getAttribute('data-variant')).toBe(
      'na',
    );
  });

  it('passes id, name, aria-label, data-* and the ref through to the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <Checkbox
        ref={ref}
        id="qa-video"
        name="videoEditorQa"
        aria-label="Video Editor QA"
        data-check="video_editor_qa"
      />,
    );

    expect(ref.current).toBe(input());
    expect(input().id).toBe('qa-video');
    expect(input().name).toBe('videoEditorQa');
    expect(input().dataset['check']).toBe('video_editor_qa');
  });

  it('holds no colour literal in any state: every colour is a token class', () => {
    const html = renderToStaticMarkup(
      <>
        <Checkbox aria-label="off" />
        <Checkbox defaultChecked aria-label="on" />
        <Checkbox indeterminate aria-label="some" />
        <Checkbox variant="na" aria-label="na" />
        <Checkbox disabled aria-label="disabled" />
      </>,
    );

    expect(html).not.toMatch(COLOUR_LITERAL);
    expect(checkboxVariants({ variant: 'na' })).not.toMatch(COLOUR_LITERAL);
  });
});
