import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_TRACK_STEPS,
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
} from '@tas/domain/state';

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
      <TwoTrackApproval track="video" internal="ad_submitted" client="pending_for_approval" />,
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
      <TwoTrackApproval track="video" internal="approved" client="pending_for_approval" />,
    );
    const track = clientTrack(container);

    expect(track.dataset['open']).toBe('true');
    expect(track.style.opacity).toBe('1');
    expect(track.style.filter).toBe('saturate(1)');
    expect(track.style.borderColor).toBe('var(--accent-line)');
    expect(screen.getByText(CLIENT_TRACK_LIVE_NOTE)).toBeDefined();
    expect(screen.queryByText('locked')).toBeNull();
  });

  it('stays live at Launched', () => {
    const { container } = render(
      <TwoTrackApproval track="video" internal="launched" client="launched" />,
    );
    expect(clientTrack(container).dataset['open']).toBe('true');
  });

  it('carries the 500ms CSS transition on the client bar wrapper', () => {
    const { container } = render(
      <TwoTrackApproval track="video" internal="ad_submitted" client="pending_for_approval" />,
    );
    const transition = clientTrack(container).style.transition;
    expect(transition).toContain('opacity 500ms ease');
    expect(transition).toContain('border-color 500ms ease');
    expect(transition).toContain('filter 500ms ease');
  });
});

describe('TwoTrackApproval — the internal bar', () => {
  it('renders the video stepper with the current step marked now', () => {
    const { container } = render(
      <TwoTrackApproval track="video" internal="ad_submitted" client="pending_for_approval" />,
    );
    const steps = container.querySelectorAll('[data-slot="internal-steps"] [data-slot="step-row"]');
    expect(steps).toHaveLength(INTERNAL_VIDEO_STATUS.length);
    // `Launched` and `Approved` appear in both steppers, so every lookup is scoped to one bar.
    expect(stepStateOf(container, 'internal-steps', 'Sent to Video Editor')).toBe('done');
    expect(stepStateOf(container, 'internal-steps', 'Ad Submitted')).toBe('now');
    expect(stepStateOf(container, 'internal-steps', 'Launched')).toBe('next');
    expect(stepStateOf(container, 'client-steps', 'Pending for Approval')).toBe('now');
  });

  it('renders the static stepper on the static track', () => {
    const { container } = render(
      <TwoTrackApproval
        track="static"
        internal="static_design_in_progress"
        client="pending_for_approval"
      />,
    );
    const steps = container.querySelectorAll('[data-slot="internal-steps"] [data-slot="step-row"]');
    expect(steps).toHaveLength(INTERNAL_STATIC_STATUS.length);
    expect(screen.getByText('Sent to Designer')).toBeDefined();
    // Twice: once as the step row, once as the header chip for the current status.
    expect(screen.getAllByText('Static Design in Progress')).toHaveLength(2);
    expect(screen.queryByText('Sent to Video Editor')).toBeNull();
  });

  it('hides the internal bar entirely and never dims the client bar with clientOnly', () => {
    const { container } = render(
      <TwoTrackApproval
        track="video"
        internal="video_editing_in_progress"
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
    expect(screen.queryByText('Video Editing in Progress')).toBeNull();
  });
});

describe('TwoTrackApproval — advance handlers', () => {
  it('renders no buttons when no handler is given', () => {
    const { container } = render(
      <TwoTrackApproval track="video" internal="approved" client="pending_for_approval" />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('disables the client advance while the gate is closed and enables it once open', () => {
    const noop = (): void => undefined;
    const { container: closed } = render(
      <TwoTrackApproval
        track="video"
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
      <TwoTrackApproval
        track="video"
        internal="approved"
        client="pending_for_approval"
        onAdvanceClient={noop}
      />,
    );
    expect(
      open.querySelector<HTMLButtonElement>('[data-slot="client-track"] button')?.disabled,
    ).toBe(false);
  });
});

describe('TwoTrackApproval — the client branch', () => {
  it('walks the linear client path only: Revisions Needed is never a step row', () => {
    const { container } = render(
      <TwoTrackApproval track="video" internal="approved" client="pending_for_approval" />,
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
      <TwoTrackApproval track="video" internal="approved" client="revisions_needed" />,
    );

    expect(stepStateOf(container, 'client-steps', 'Pending for Approval')).toBe('next');
    expect(stepStateOf(container, 'client-steps', 'Approved')).toBe('next');
    expect(stepStateOf(container, 'client-steps', 'Launched')).toBe('next');
  });

  it('names the branch with the header chip instead, in the domain\u2019s own warn tone', () => {
    render(<TwoTrackApproval track="video" internal="approved" client="revisions_needed" />);

    expect(screen.getByText('Revisions Needed').dataset['tone']).toBe('warn');
  });
});
