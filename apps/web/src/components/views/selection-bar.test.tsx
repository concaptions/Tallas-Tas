import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SelectionBar, selectionCountLabel } from './selection-bar';

/** A hex colour, a hex-with-alpha or an `rgb(` call — a colour literal in a component is a token-layer defect. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

const actions = [
  { label: 'Duplicate (2)', onSelect: () => undefined, slot: 'selection-duplicate' },
  {
    label: 'Delete (2)',
    tone: 'bad' as const,
    onSelect: () => undefined,
    slot: 'selection-delete',
  },
];

describe('SelectionBar', () => {
  it('renders nothing at all with no selection and no notice', () => {
    expect(
      renderToStaticMarkup(
        <SelectionBar count={0} noun="creative" actions={actions} onClear={() => undefined} />,
      ),
    ).toBe('');
  });

  it('keeps painting the notice after the selection is cleared, with the toolbar gone (B3.A29)', () => {
    // Duplicate and Delete clear the selection BEFORE they report; the bar used to unmount at zero
    // and "2 copies created." was never seen.
    const markup = renderToStaticMarkup(
      <SelectionBar
        count={0}
        noun="creative"
        actions={actions}
        onClear={() => undefined}
        notice="2 copies created."
      />,
    );
    expect(markup).toContain('data-slot="selection-notice"');
    expect(markup).toContain('2 copies created.');
    expect(markup).not.toContain('data-slot="selection-bar"');
    expect(markup).not.toContain('role="toolbar"');
  });

  it('draws the toolbar on the floating surface: white ink on the gradient badge, red-tinted Delete', () => {
    const markup = renderToStaticMarkup(
      <SelectionBar
        count={2}
        noun="creative"
        actions={actions}
        onClear={() => undefined}
        notice="1 moved."
      />,
    );
    expect(markup).toContain('data-slot="selection-bar"');
    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain(`aria-label="2 ${selectionCountLabel(2, 'creative')}"`);
    // B3.V1: the count badge's digit is `--on-accent`, never `text-bg` (near-black in dark mode).
    expect(markup).toMatch(/data-slot="selection-count"[^>]*text-on-accent/);
    expect(markup).not.toContain('text-bg');
    // B3.V2 / B3.V9: the board's shadow token on the bar and the notice; 12px radius on the bar.
    expect(markup.match(/shadow-float/g)).toHaveLength(2);
    expect(markup).toMatch(/role="toolbar"[^>]*rounded-xl/);
    expect(markup).not.toContain('shadow-lg');
    expect(markup).not.toContain('shadow-md');
    // B3.V6 / B3.V7: action chrome, and Delete on the bad tint.
    expect(markup).toMatch(/data-slot="selection-duplicate"[^>]*border-line2/);
    expect(markup).toMatch(/data-slot="selection-delete"[^>]*border-bad\/40 bg-bad\/10 text-bad/);
    expect(markup).not.toContain('rounded-full');
  });

  it('holds no colour literal', () => {
    const markup = renderToStaticMarkup(
      <SelectionBar
        count={1}
        noun="creative"
        actions={actions}
        onClear={() => undefined}
        notice="Link copied."
      />,
    );
    expect(markup).not.toMatch(COLOUR_LITERAL);
  });
});
