import { render, screen } from '@testing-library/react';
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
    render(<StatusChip tone={chipTone('Videos Revisions')} label="Videos Revisions" />);
    expect(screen.getByText('Videos Revisions').dataset['tone']).toBe('warn');
  });
});
