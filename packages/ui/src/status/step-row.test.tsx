import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusChip } from './status-chip';
import { StepRow } from './step-row';

function dotOf(container: HTMLElement): HTMLElement {
  const dot = container.querySelector<HTMLElement>('[data-slot="step-row-dot"]');
  if (dot === null) {
    throw new Error('step row rendered without a dot');
  }
  return dot;
}

describe('StepRow', () => {
  it('gives a done step a --text3 dot', () => {
    const { container } = render(<StepRow label="Ad Submitted" state="done" />);
    expect(dotOf(container).style.backgroundColor).toBe('var(--text3)');
  });

  it('gives the current step an --accent dot with a 3px --accent-soft halo', () => {
    const { container } = render(<StepRow label="Ad Submitted" state="now" />);
    const dot = dotOf(container);
    expect(dot.style.backgroundColor).toBe('var(--accent)');
    expect(dot.style.boxShadow).toBe('0 0 0 3px var(--accent-soft)');
  });

  it('gives an upcoming step a hollow --line2 ring', () => {
    const { container } = render(<StepRow label="Launched" state="next" />);
    const dot = dotOf(container);
    expect(dot.style.backgroundColor).toBe('transparent');
    expect(dot.style.border).toBe('1px solid var(--line2)');
  });

  it('draws a connector unless the row is last', () => {
    const { container: middle } = render(<StepRow label="Approved" state="next" />);
    expect(middle.querySelector('[data-slot="step-row-connector"]')).not.toBeNull();

    const { container: last } = render(<StepRow label="Launched" state="next" isLast />);
    expect(last.querySelector('[data-slot="step-row-connector"]')).toBeNull();
  });

  it('renders the tip when one is given and nothing when it is not', () => {
    const { container: withTip } = render(
      <StepRow label="Approved" tip="Internal sign-off." state="now" />,
    );
    expect(withTip.textContent).toContain('Internal sign-off.');

    const { container: withoutTip } = render(<StepRow label="Approved" state="now" />);
    expect(withoutTip.querySelectorAll('p')).toHaveLength(0);
  });

  it('renders an optional side badge next to the label', () => {
    render(
      <StepRow
        label="Video Editing in Progress"
        state="now"
        badge={<StatusChip tone="mute" label="On Hold" />}
      />,
    );
    expect(screen.getByText('On Hold').dataset['slot']).toBe('status-chip');
  });

  it('exposes its state for styling and assertions', () => {
    const { container } = render(<StepRow label="Approved" state="done" />);
    expect(container.querySelector('[data-slot="step-row"]')?.getAttribute('data-state')).toBe(
      'done',
    );
  });
});
