import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DEMO_WRITE_HINT, DisabledWrite, disabledWriteClassName } from './disabled-write';

/**
 * The gate popover (B1.V6 / B1.A6, ruling 8). Opt-in: every existing caller renders exactly what it
 * rendered before — the wrapper slot, the native `title` and the `aria-label` the e2e specs read —
 * and only a caller that asks for `popover` gets board 1's styled tooltip under the control.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;
const HINT = 'Video Editor QA must be ticked before this brief can go to the client.';

function popover(): HTMLElement | null {
  return document.querySelector('[data-slot="disabled-write-popover"]');
}

describe('DisabledWrite', () => {
  it('keeps the slot, the title and the aria-label, and no popover, by default', () => {
    const { container } = render(
      <DisabledWrite>
        <button disabled>Save</button>
      </DisabledWrite>,
    );
    const wrapper = container.querySelector<HTMLElement>('[data-slot="disabled-write"]');

    expect(wrapper?.title).toBe(DEMO_WRITE_HINT);
    expect(wrapper?.getAttribute('aria-label')).toBe(DEMO_WRITE_HINT);
    expect(wrapper?.hasAttribute('tabindex')).toBe(false);
    expect(popover()).toBeNull();
  });

  it('renders the child untouched when inactive', () => {
    const { container } = render(
      <DisabledWrite active={false}>
        <button>Save</button>
      </DisabledWrite>,
    );

    expect(container.querySelector('[data-slot="disabled-write"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
  });

  it('draws the popover on request: a focusable wrapper, a tooltip with the heading and the hint', () => {
    const { container } = render(
      <DisabledWrite popover heading="QA checklist incomplete" hint={HINT}>
        <button disabled>Submit to Client</button>
      </DisabledWrite>,
    );
    const wrapper = container.querySelector<HTMLElement>('[data-slot="disabled-write"]');
    const tip = popover();

    expect(wrapper?.tabIndex).toBe(0);
    expect(wrapper?.className).toContain('group/hint');
    expect(wrapper?.title).toBe(HINT);
    expect(tip?.getAttribute('role')).toBe('tooltip');
    expect(wrapper?.getAttribute('aria-describedby')).toBe(tip?.id);
    expect(tip?.className).toContain('group-hover/hint:visible');
    expect(tip?.className).toContain('group-focus-within/hint:visible');
    expect(tip?.className).toContain('shadow-float');
    expect(tip?.className).toContain('bg-surface4');
    expect(screen.getByText('QA checklist incomplete').className).toContain('text-warn');
    expect(tip?.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
    expect(tip?.textContent).toContain(HINT);
  });

  it('bolds the hint’s leading phrase when asked, and leaves a non-leading phrase alone', () => {
    const { unmount } = render(
      <DisabledWrite popover hint={HINT} hintEmphasis="Video Editor QA">
        <button disabled>Submit to Client</button>
      </DisabledWrite>,
    );
    const bold = popover()?.querySelector('b');

    expect(bold?.textContent).toBe('Video Editor QA');
    expect(bold?.className).toContain('text-text');
    expect(popover()?.textContent).toBe(HINT);
    unmount();

    render(
      <DisabledWrite popover hint={HINT} hintEmphasis="the client">
        <button disabled>Submit to Client</button>
      </DisabledWrite>,
    );
    expect(popover()?.querySelector('b')).toBeNull();
    expect(popover()?.textContent).toBe(HINT);
  });

  it('omits the heading row when no heading is given', () => {
    render(
      <DisabledWrite popover hint={HINT}>
        <button disabled>Submit to Client</button>
      </DisabledWrite>,
    );

    expect(popover()?.querySelector('svg')).toBeNull();
    expect(popover()?.textContent).toBe(HINT);
  });

  it('holds no colour literal, open or closed', () => {
    const html = renderToStaticMarkup(
      <>
        <DisabledWrite>
          <button disabled>Save</button>
        </DisabledWrite>
        <DisabledWrite
          popover
          heading="QA checklist incomplete"
          hint={HINT}
          hintEmphasis="Video Editor QA"
        >
          <button disabled>Submit to Client</button>
        </DisabledWrite>
      </>,
    );

    expect(html).not.toMatch(COLOUR_LITERAL);
    expect(disabledWriteClassName).not.toMatch(COLOUR_LITERAL);
  });
});
