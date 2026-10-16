import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chipTone, type ChipTone } from '@tas/domain/state';

import { StatusChip } from './status-chip';

describe('StatusChip', () => {
  it('renders the label', () => {
    render(<StatusChip tone="ok" label="Approved" />);
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('applies the handoff type treatment', () => {
    render(<StatusChip tone="info" label="Pending for Approval" />);
    const chip = screen.getByText('Pending for Approval');
    expect(chip.style.fontSize).toBe('10.5px');
    // jsdom normalises the `.03em` of the handoff to a leading-zero form; same computed value.
    expect(chip.style.letterSpacing).toBe('0.03em');
    expect(chip.className).toContain('font-mono');
    expect(chip.className).toContain('rounded-input');
    expect(chip.className).toContain('border');
  });

  const toneToVariable: Record<ChipTone, string> = {
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
    info: 'var(--info)',
    accent: 'var(--accent)',
    mute: 'var(--text3)',
  };

  for (const [tone, variable] of Object.entries(toneToVariable) as [ChipTone, string][]) {
    it(`paints the ${tone} tone from ${variable} with a 13% mix background`, () => {
      render(<StatusChip tone={tone} label={tone} />);
      const chip = screen.getByText(tone);
      expect(chip.dataset['tone']).toBe(tone);
      expect(chip.style.borderColor).toBe(variable);
      expect(chip.style.backgroundColor).toBe(`color-mix(in srgb, ${variable} 13%, transparent)`);
    });
  }

  it('never carries a colour of its own: the tone always comes from chipTone', () => {
    render(<StatusChip tone={chipTone('Revisions Needed')} label="Revisions Needed" />);
    expect(screen.getByText('Revisions Needed').dataset['tone']).toBe('warn');
  });

  /**
   * The commit-3 cardinal rule: the Bold `variant` prop must not move a byte of the default
   * output — child brands render the chip unscoped, and the Bold dot is a scoped `::before` in
   * bold.css, not DOM. The reference below is the pre-commit-3 component's JSX, copied verbatim
   * (the byte-pin approach of `app-shell.test.tsx`).
   */
  it('renders the default chip byte-identical to the pre-Bold component', () => {
    const colour = 'var(--info)';
    const reference = (
      <span
        data-slot="status-chip"
        data-tone="info"
        className="inline-flex items-center rounded-input border px-1.5 py-0.5 font-mono leading-none whitespace-nowrap uppercase"
        style={{
          fontSize: '10.5px',
          letterSpacing: '.03em',
          borderColor: colour,
          color: colour,
          backgroundColor: `color-mix(in srgb, ${colour} 13%, transparent)`,
        }}
      >
        Pending for Approval
      </span>
    );
    expect(renderToStaticMarkup(<StatusChip tone="info" label="Pending for Approval" />)).toBe(
      renderToStaticMarkup(reference),
    );
  });

  it('emits data-variant only when a Bold call site passes one', () => {
    render(
      <>
        <StatusChip tone="info" label="ring" variant="ring" />
        <StatusChip tone="info" label="plain" variant="plain" />
        <StatusChip tone="info" label="default" />
      </>,
    );
    expect(screen.getByText('ring').dataset['variant']).toBe('ring');
    expect(screen.getByText('plain').dataset['variant']).toBe('plain');
    expect(screen.getByText('default').dataset['variant']).toBeUndefined();
  });
});
