import { describe, expect, it } from 'vitest';

import {
  LAUNCHED_CLIENT_STATUSES,
  LAUNCH_PAUSED_CLIENT_STATUS,
  LAUNCH_PRIORITIES,
  LAUNCH_QUEUE_ACTIONS,
  LAUNCH_READY_CLIENT_STATUS,
  RECENTLY_LAUNCHED_DAYS,
  isLaunchPriority,
  launchQueueAction,
  launchQueueActionsFor,
  launchTransition,
  recentlyLaunchedSince,
} from './launch-queue';

function action(key: 'launch' | 'pause' | 'resume') {
  const found = launchQueueAction(key);
  if (found === undefined) {
    throw new Error(`no ${key} action`);
  }
  return found;
}

describe('the launch queue vocabulary', () => {
  it('waits on client Approved and treats Launched and Paused as launched', () => {
    expect(LAUNCH_READY_CLIENT_STATUS).toBe('approved');
    expect(LAUNCHED_CLIENT_STATUSES).toEqual(['launched', 'paused']);
  });

  it('reaches back exactly seven days from the clock it is handed', () => {
    const now = new Date('2026-09-24T12:00:00Z');
    expect(RECENTLY_LAUNCHED_DAYS).toBe(7);
    expect(recentlyLaunchedSince(now).toISOString()).toBe('2026-09-17T12:00:00.000Z');
  });

  it('writes each label once, in the order the row draws them', () => {
    expect(LAUNCH_QUEUE_ACTIONS.map((entry) => entry.label)).toEqual([
      'Mark as Launched',
      'Pause',
      'Resume',
    ]);
    expect(launchQueueAction('delete')).toBeUndefined();
  });
});

describe('the paused status and priority range', () => {
  it('names paused as one of the launched statuses', () => {
    expect(LAUNCH_PAUSED_CLIENT_STATUS).toBe('paused');
    expect(LAUNCHED_CLIENT_STATUSES).toContain(LAUNCH_PAUSED_CLIENT_STATUS);
  });

  it('offers priorities 1 through 10, in order', () => {
    expect(LAUNCH_PRIORITIES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('accepts an integer 1–10 and rejects everything else', () => {
    expect(LAUNCH_PRIORITIES.every(isLaunchPriority)).toBe(true);
    expect(isLaunchPriority(0)).toBe(false);
    expect(isLaunchPriority(11)).toBe(false);
    expect(isLaunchPriority(2.5)).toBe(false);
    expect(isLaunchPriority(-1)).toBe(false);
    expect(isLaunchPriority(Number.NaN)).toBe(false);
  });
});

describe('launchTransition', () => {
  it('launches a client-approved creative on BOTH tracks (PRD §9)', () => {
    expect(launchTransition(action('launch'), 'video', 'approved', 'approved')).toEqual({
      clientStatus: 'launched',
      internalStatus: 'launched',
    });
    expect(launchTransition(action('launch'), 'static', 'approved', 'approved')).toEqual({
      clientStatus: 'launched',
      internalStatus: 'launched',
    });
  });

  it('pauses and resumes on the client track only, leaving the team status Launched', () => {
    expect(launchTransition(action('pause'), 'video', 'launched', 'launched')).toEqual({
      clientStatus: 'paused',
      internalStatus: 'launched',
    });
    expect(launchTransition(action('resume'), 'video', 'launched', 'paused')).toEqual({
      clientStatus: 'launched',
      internalStatus: 'launched',
    });
  });

  it('refuses every move from the wrong starting status', () => {
    expect(
      launchTransition(action('launch'), 'video', 'approved', 'pending_for_approval'),
    ).toBeNull();
    expect(launchTransition(action('launch'), 'video', 'launched', 'launched')).toBeNull();
    expect(launchTransition(action('pause'), 'video', 'approved', 'approved')).toBeNull();
    expect(launchTransition(action('resume'), 'video', 'launched', 'launched')).toBeNull();
  });

  it('never lets Launch stand in for Resume: both aim at Launched, only one starts at Paused', () => {
    expect(launchTransition(action('launch'), 'video', 'launched', 'paused')).toBeNull();
    expect(launchTransition(action('resume'), 'video', 'approved', 'approved')).toBeNull();
  });

  it('refuses while the internal gate is shut, whatever the stored client status says', () => {
    expect(launchTransition(action('launch'), 'video', 'ad_submitted', 'approved')).toBeNull();
    expect(launchTransition(action('pause'), 'static', 'sent_to_designer', 'launched')).toBeNull();
  });
});

describe('launchQueueActionsFor', () => {
  it('draws exactly one control per state a launch-queue row can be in', () => {
    const keys = (internal: 'approved' | 'launched', client: 'approved' | 'launched' | 'paused') =>
      launchQueueActionsFor('video', internal, client).map((entry) => entry.key);

    expect(keys('approved', 'approved')).toEqual(['launch']);
    expect(keys('launched', 'launched')).toEqual(['pause']);
    expect(keys('launched', 'paused')).toEqual(['resume']);
  });

  it('draws nothing for a creative the client has not signed off', () => {
    expect(launchQueueActionsFor('video', 'approved', 'pending_for_approval')).toEqual([]);
  });
});
