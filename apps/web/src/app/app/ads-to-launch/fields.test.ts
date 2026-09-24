import { demoBriefs } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { toBriefRow, type BriefRow } from '@/lib/briefs-source';

import {
  downloadUrlOf,
  launchCountLabel,
  launchQueueItem,
  launchStatusView,
  launchedAtLabel,
  priorityLabel,
} from './fields';

function row(overrides: Partial<BriefRow>): BriefRow {
  const base = demoBriefs[0];
  if (base === undefined) throw new Error('no demo brief');
  return { ...toBriefRow(base), ...overrides };
}

describe('launchStatusView', () => {
  it('uses the domain label and tone for every launch-queue status, Paused included', () => {
    expect(launchStatusView('approved')).toEqual({ label: 'Approved', tone: 'ok' });
    expect(launchStatusView('launched')).toEqual({ label: 'Launched', tone: 'accent' });
    expect(launchStatusView('paused')).toEqual({ label: 'Paused', tone: 'warn' });
  });

  it('renders an unknown stored status as its own key on a muted chip, never an empty pill', () => {
    expect(launchStatusView('from_a_newer_build')).toEqual({
      label: 'from_a_newer_build',
      tone: 'mute',
    });
  });
});

describe('labels', () => {
  it('prints a launch moment in UTC, identical on server and browser', () => {
    expect(launchedAtLabel(new Date('2026-09-22T14:05:59Z'))).toBe('2026-09-22 14:05 UTC');
    expect(launchedAtLabel(null)).toBeNull();
    expect(launchedAtLabel(new Date('not a date'))).toBeNull();
  });

  it('prints a priority as P<n>, and nothing when none was set', () => {
    expect(priorityLabel(1)).toBe('P1');
    expect(priorityLabel(null)).toBeNull();
  });

  it('counts with the right plural', () => {
    expect(launchCountLabel(1, 'ad')).toBe('1 ad');
    expect(launchCountLabel(3, 'ad')).toBe('3 ads');
    expect(launchCountLabel(0, 'creative')).toBe('0 creatives');
  });

  it('downloads the design file link first, then the first attached design file', () => {
    expect(
      downloadUrlOf({ designFileUrl: 'https://a.test/x', designFile: ['https://b.test/y'] }),
    ).toBe('https://a.test/x');
    expect(downloadUrlOf({ designFileUrl: null, designFile: ['https://b.test/y'] })).toBe(
      'https://b.test/y',
    );
    expect(downloadUrlOf({ designFileUrl: null, designFile: null })).toBeNull();
  });
});

describe('launchQueueItem', () => {
  it('offers Mark as Launched, and only that, on a client-approved creative', () => {
    const item = launchQueueItem(
      row({ internalStatus: 'approved', clientStatus: 'approved', launchPriority: 2 }),
      '/app/briefs/x',
    );

    expect(item.controls.map((control) => control.key)).toEqual(['launch']);
    expect(item.statusLabel).toBe('Approved');
    expect(item.priorityLabel).toBe('P2');
    expect(item.href).toBe('/app/briefs/x');
  });

  it('offers Pause on a live ad and Resume on a paused one', () => {
    const live = launchQueueItem(
      row({ internalStatus: 'launched', clientStatus: 'launched' }),
      '/app/briefs/x',
    );
    const paused = launchQueueItem(
      row({ internalStatus: 'launched', clientStatus: 'paused' }),
      '/app/briefs/x',
    );

    expect(live.controls.map((control) => control.key)).toEqual(['pause']);
    expect(paused.controls.map((control) => control.key)).toEqual(['resume']);
  });
});
