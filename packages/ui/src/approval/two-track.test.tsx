import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLIENT_TRACK_STEPS, INTERNAL_STATUS } from '@tas/domain/state';

import { CLIENT_TRACK_LIVE_NOTE, CLIENT_TRACK_LOCKED_NOTE, TwoTrackApproval } from './two-track';

/** The state of one step row, found by its label inside one of the two steppers. */
function stepStateOf(
  container: HTMLElement,
  scope: 'internal-steps' | 'client-steps',
  label: string,
): string | null {
  const rows = container.querySelectorAll<HTMLElement>(
    `[data-slot="${scope}"] [data-slot="step-row"]`,
  );
  for (const row of rows) {
    if (row.textContent.startsWith(label)) {
      return row.getAttribute('data-state');
    }
  }
  throw new Error(`no step row labelled ${label} in ${scope}`);
}

function clientTrack(container: HTMLElement): HTMLElement {
  const track = container.querySelector<HTMLElement>('[data-slot="client-track"]');
  if (track === null) {
    throw new Error('the widget rendered without a client track');
  }
  return track;
}

describe('TwoTrackApproval — the gate', () => {
  it('dims the client bar and reads locked while internal is earlier than Approved', () => {
    const { container } = render(
      <TwoTrackApproval internal="ad_submitted" client="pending_for_approval" />,
    );
    const track = clientTrack(container);

    expect(track.dataset['open']).toBe('false');
    expect(track.style.opacity).toBe('0.42');
    expect(track.style.filter).toBe('saturate(.4)');
    expect(track.style.borderColor).toBe('var(--line)');
    expect(screen.getByText('locked').dataset['tone']).toBe('mute');
    expect(screen.getByText(CLIENT_TRACK_LOCKED_NOTE)).toBeDefined();
    expect(screen.queryByText(CLIENT_TRACK_LIVE_NOTE)).toBeNull();
  });

  it('goes live at Approved: full opacity and saturation, accent border, live note', () => {
    const { container } = render(
      <TwoTrackApproval internal="approved" client="pending_for_approval" />,
    );
    const track = clientTrack(container);

    expect(track.dataset['open']).toBe('true');
    expect(track.style.opacity).toBe('1');
    expect(track.style.filter).toBe('saturate(1)');
    expect(track.style.borderColor).toBe('var(--accent-line)');
    expect(screen.getByText(CLIENT_TRACK_LIVE_NOTE)).toBeDefined();
    expect(screen.queryByText('locked')).toBeNull();
  });

  it('stays live at Approved with client Launched', () => {
    const { container } = render(<TwoTrackApproval internal="approved" client="launched" />);
    expect(clientTrack(container).dataset['open']).toBe('true');
  });

  it('carries the 500ms CSS transition on the client bar wrapper', () => {
    const { container } = render(
      <TwoTrackApproval internal="ad_submitted" client="pending_for_approval" />,
    );
    const transition = clientTrack(container).style.transition;
    expect(transition).toContain('opacity 500ms ease');
    expect(transition).toContain('border-color 500ms ease');
    expect(transition).toContain('filter 500ms ease');
  });
});

describe('TwoTrackApproval — the internal bar', () => {
  it('renders the internal stepper with the current step marked now', () => {
    const { container } = render(
      <TwoTrackApproval internal="ad_submitted" client="pending_for_approval" />,
    );
    const steps = container.querySelectorAll('[data-slot="internal-steps"] [data-slot="step-row"]');
    expect(steps).toHaveLength(INTERNAL_STATUS.length);
    // `Approved` appears in both steppers, so every lookup is scoped to one bar.
    expect(stepStateOf(container, 'internal-steps', 'Sent to Editor / Designer')).toBe('done');
    expect(stepStateOf(container, 'internal-steps', 'Ad Submitted')).toBe('now');
    expect(stepStateOf(container, 'internal-steps', 'Approved')).toBe('next');
    expect(stepStateOf(container, 'client-steps', 'Pending for Approval')).toBe('now');
  });

  /**
   * One list for both tracks (Oct 12 client sync, Ticket 5 / 0067): a static brief walks the same
   * seven steps as a video one, and no track-specific label exists any more.
   */
  it('renders the same seven steps for a static brief', () => {
    const { container } = render(
      <TwoTrackApproval internal="under_editing_or_designing" client="pending_for_approval" />,
    );
    const steps = container.querySelectorAll('[data-slot="internal-steps"] [data-slot="step-row"]');
    expect(steps).toHaveLength(INTERNAL_STATUS.length);
    expect(steps).toHaveLength(7);
    expect(screen.getByText('Sent to Editor / Designer')).toBeDefined();
    // Twice: once as the step row, once as the header chip for the current status.
    expect(screen.getAllByText('Under Editing / Designing')).toHaveLength(2);
    expect(screen.queryByText('Sent to Video Editor')).toBeNull();
    expect(screen.queryByText('Sent to Designer')).toBeNull();
  });

  it('hides the internal bar entirely and never dims the client bar with clientOnly', () => {
    const { container } = render(
      <TwoTrackApproval
        internal="under_editing_or_designing"
        client="pending_for_approval"
        clientOnly
      />,
    );
    expect(container.querySelector('[data-slot="internal-track"]')).toBeNull();

    const track = clientTrack(container);
    expect(track.dataset['open']).toBe('true');
    expect(track.style.opacity).toBe('1');
    expect(screen.getByText(CLIENT_TRACK_LIVE_NOTE)).toBeDefined();
    // Internal step labels must never reach a client screen.
    expect(screen.queryByText('Under Editing / Designing')).toBeNull();
  });
});

describe('TwoTrackApproval — advance handlers', () => {
  it('hides the client bar entirely with internalOnly, keeping the internal stepper (SMOKE-27)', () => {
    const { container } = render(
      <TwoTrackApproval internal="ad_submitted" client="approved" internalOnly />,
    );
    expect(container.querySelector('[data-slot="client-track"]')).toBeNull();
    expect(container.querySelector('[data-slot="internal-track"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Client status');
  });

  it('renders no buttons when no handler is given', () => {
    const { container } = render(
      <TwoTrackApproval internal="approved" client="pending_for_approval" />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('disables the client advance while the gate is closed and enables it once open', () => {
    const noop = (): void => undefined;
    const { container: closed } = render(
      <TwoTrackApproval
        internal="ad_submitted"
        client="pending_for_approval"
        onAdvanceInternal={noop}
        onAdvanceClient={noop}
      />,
    );
    const closedButtons = closed.querySelectorAll('button');
    expect(closedButtons).toHaveLength(2);
    expect(
      closed.querySelector<HTMLButtonElement>('[data-slot="client-track"] button')?.disabled,
    ).toBe(true);

    const { container: open } = render(
      <TwoTrackApproval internal="approved" client="pending_for_approval" onAdvanceClient={noop} />,
    );
    expect(
      open.querySelector<HTMLButtonElement>('[data-slot="client-track"] button')?.disabled,
    ).toBe(false);
  });
});

describe('TwoTrackApproval — the client branch', () => {
  it('walks the linear client path only: Revisions Needed is never a step row', () => {
    const { container } = render(
      <TwoTrackApproval internal="approved" client="pending_for_approval" />,
    );
    const steps = container.querySelectorAll('[data-slot="client-steps"] [data-slot="step-row"]');

    expect(steps).toHaveLength(CLIENT_TRACK_STEPS.length);
    expect([...steps].some((row) => row.textContent.startsWith('Revisions Needed'))).toBe(false);
  });

  /**
   * The defect a linear stepper would introduce: a creative the client sent back must never draw
   * Approved as a step it has already passed.
   */
  it('marks nothing done while the creative sits on the Revisions Needed branch', () => {
    const { container } = render(
      <TwoTrackApproval internal="approved" client="revisions_needed" />,
    );

    expect(stepStateOf(container, 'client-steps', 'Pending for Approval')).toBe('next');
    expect(stepStateOf(container, 'client-steps', 'Approved')).toBe('next');
    expect(stepStateOf(container, 'client-steps', 'Launched')).toBe('next');
  });

  it('names the branch with the header chip instead, in the domain\u2019s own warn tone', () => {
    const { container } = render(
      <TwoTrackApproval internal="approved" client="revisions_needed" />,
    );

    // Scoped to the client bar: the one internal list (0067) carries its own Revisions Needed step.
    expect(within(clientTrack(container)).getByText('Revisions Needed').dataset['tone']).toBe(
      'warn',
    );
  });
});
