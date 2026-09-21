import { describe, expect, it } from 'vitest';
import { PARTNERSHIP_REFERENCE_DATE } from '@tas/db';

import {
  collabDateLabel,
  collabStats,
  countdownCellLabel,
  creatorInitials,
  creatorTracks,
  DEFAULT_TAB,
  expiryRowClassName,
  expiryRowStyle,
  filteredCountLabel,
  identityLine,
  isoDateLabel,
  matchesQuery,
  partnershipRow,
  periodLabel,
  creatorCountLabel,
  partnershipCountLabel,
  tabFromParam,
  UGC_TABS,
  type CollabRow,
  type PartnershipSourceRow,
} from './fields';

/**
 * The route's presentation rules. Every one of these is a decision a component would otherwise make
 * inline: which tab a URL means, what two letters stand in for a missing headshot, how an extension
 * reads, and which of the three tracks a chip belongs to.
 */
describe('tabFromParam', () => {
  it('narrows the two known tabs', () => {
    expect(tabFromParam('creators')).toBe('creators');
    expect(tabFromParam('partnerships')).toBe('partnerships');
  });

  it('falls back to Creators for anything else, so a stale link still renders a page', () => {
    expect(tabFromParam(null)).toBe(DEFAULT_TAB);
    expect(tabFromParam(undefined)).toBe(DEFAULT_TAB);
    expect(tabFromParam('')).toBe('creators');
    expect(tabFromParam('partnership-ads')).toBe('creators');
  });

  it('is case- and whitespace-insensitive, because a pasted link is', () => {
    expect(tabFromParam(' Partnerships ')).toBe('partnerships');
    expect(tabFromParam('CREATORS')).toBe('creators');
  });

  it('offers exactly the two tabs, roster first', () => {
    expect(UGC_TABS.map((tab) => tab.label)).toEqual(['Creators', 'Partnership Ads']);
  });
});

describe('creatorInitials', () => {
  it('takes the first letter of the first and last words', () => {
    expect(creatorInitials('Danielle Okonkwo')).toBe('DO');
    expect(creatorInitials('Priya Raghunathan')).toBe('PR');
  });

  it('handles one word, punctuation and accents without producing a symbol', () => {
    expect(creatorInitials('Tomás')).toBe('T');
    expect(creatorInitials("Hannah O'Whitcombe-Smith")).toBe('HS');
    expect(creatorInitials('  ')).toBe('?');
    expect(creatorInitials('—')).toBe('?');
  });
});

describe('identityLine', () => {
  it('reads gender then bracket, with the hyphen typeset as an en dash', () => {
    expect(identityLine({ gender: 'Female', ageBracket: '25-34' })).toBe('Female · 25–34');
  });

  it('degrades to whichever half exists, and to the em dash when neither does', () => {
    expect(identityLine({ gender: 'Non-binary', ageBracket: null })).toBe('Non-binary');
    expect(identityLine({ gender: null, ageBracket: '55-64' })).toBe('55–64');
    expect(identityLine({ gender: null, ageBracket: null })).toBe('—');
  });
});

describe('creatorTracks', () => {
  it('labels all three tracks and takes every label and tone from the domain', () => {
    const tracks = creatorTracks({
      internalCreatorStatus: 'approved',
      clientStatus: 'filming_in_progress',
      internalAssetsStatus: 'pending_for_cs_approval',
    });

    expect(tracks.map((track) => [track.label, track.statusLabel, track.tone])).toEqual([
      ['Internal', 'Approved', 'ok'],
      ['Client', 'Filming In Progress', 'accent'],
      ['Assets', 'Pending for CS Approval', 'info'],
    ]);
  });

  it('keeps the two same-named reviews apart: one row, two different answers', () => {
    const tracks = creatorTracks({
      internalCreatorStatus: 'approved',
      clientStatus: 'revisions_needed',
      internalAssetsStatus: 'revisions_needed',
    });

    expect(tracks.map((track) => track.tone)).toEqual(['ok', 'warn', 'warn']);
  });
});

describe('isoDateLabel and periodLabel', () => {
  it('writes a date as UTC ISO, so the server and the browser agree', () => {
    expect(isoDateLabel(new Date('2026-07-22T09:00:00.000Z'))).toBe('2026-07-22');
    expect(isoDateLabel(null)).toBe('—');
    expect(isoDateLabel(new Date(Number.NaN))).toBe('—');
  });

  it('keeps an extension as its own term rather than folding it into a total', () => {
    expect(periodLabel(60, 0)).toBe('60 days');
    expect(periodLabel(60, 30)).toBe('60 + 30 days');
    expect(periodLabel(1, 0)).toBe('1 day');
    expect(periodLabel(null, 0)).toBe('—');
  });
});

describe('partnershipRow', () => {
  const danielle: PartnershipSourceRow = {
    id: 'a',
    name: 'Danielle Okonkwo',
    instagramUsername: '@danielle.sleeps.late',
    partnershipActivity: 'active',
    partnershipActivatedAt: new Date('2026-07-22T09:00:00.000Z'),
    partnershipPeriodDays: 60,
    extensionDays: 0,
  };

  it('reads the fixture three-day row as three days left, highlighted', () => {
    const row = partnershipRow(danielle, PARTNERSHIP_REFERENCE_DATE);

    expect(row.countdownLabel).toBe('3 days left');
    expect(row.expiryState).toBe('expiring');
    expect(row.nearExpiry).toBe(true);
    expect(row.countdownTone).toBe('warn');
    expect(row.activityLabel).toBe('Active');
    expect(row.activityTone).toBe('ok');
    expect(row.activatedLabel).toBe('2026-07-22');
    expect(row.periodLabel).toBe('60 days');
  });

  it('counts the extension, so a later activation can still lapse later', () => {
    const marcus = partnershipRow(
      {
        ...danielle,
        id: 'b',
        name: 'Marcus Delacroix',
        partnershipActivatedAt: new Date('2026-07-09T09:00:00.000Z'),
        extensionDays: 30,
      },
      PARTNERSHIP_REFERENCE_DATE,
    );

    expect(marcus.periodLabel).toBe('60 + 30 days');
    expect(marcus.countdownLabel).toBe('20 days left');
    expect(marcus.expiryState).toBe('active');
    expect(marcus.nearExpiry).toBe(false);
  });

  it('reads a lapsed window as Expired in the bad tone, never a negative number', () => {
    const priya = partnershipRow(
      {
        ...danielle,
        id: 'c',
        name: 'Priya Raghunathan',
        partnershipActivity: 'ended',
        partnershipActivatedAt: new Date('2026-04-15T09:00:00.000Z'),
        partnershipPeriodDays: 30,
      },
      PARTNERSHIP_REFERENCE_DATE,
    );

    expect(priya.countdownLabel).toBe('Expired');
    expect(priya.expiryState).toBe('expired');
    expect(priya.nearExpiry).toBe(false);
    expect(priya.countdownTone).toBe('bad');
    expect(priya.activityTone).toBe('bad');
  });

  it('shows a never-activated row as an em dash rather than colouring it as a problem', () => {
    const row = partnershipRow(
      {
        ...danielle,
        id: 'd',
        instagramUsername: null,
        partnershipActivity: 'not_active',
        partnershipActivatedAt: null,
        partnershipPeriodDays: null,
      },
      PARTNERSHIP_REFERENCE_DATE,
    );

    expect(row.instagramUsername).toBe('—');
    expect(row.countdownLabel).toBe('—');
    expect(row.expiryState).toBeNull();
    expect(row.countdownTone).toBe('mute');
    expect(row.nearExpiry).toBe(false);
  });
});

describe('countdownCellLabel', () => {
  it('adds the reading direction only where it is a sentence', () => {
    expect(countdownCellLabel(null)).toBe('—');
    expect(countdownCellLabel({ expiresAt: new Date(), daysRemaining: -4, state: 'expired' })).toBe(
      'Expired',
    );
    expect(countdownCellLabel({ expiresAt: new Date(), daysRemaining: 0, state: 'expiring' })).toBe(
      'Today',
    );
    expect(countdownCellLabel({ expiresAt: new Date(), daysRemaining: 1, state: 'expiring' })).toBe(
      '1 day left',
    );
  });
});

describe('the near-expiry highlight', () => {
  it('rules the left edge in the row tone and tints only the two states that need it', () => {
    expect(expiryRowClassName('expiring')).toContain('border-l-warn');
    expect(expiryRowClassName('expired')).toContain('border-l-bad');
    expect(expiryRowClassName('active')).toContain('transparent');
    expect(expiryRowClassName(null)).toContain('transparent');

    expect(expiryRowStyle('expiring')?.backgroundColor).toContain('var(--warn)');
    expect(expiryRowStyle('expired')?.backgroundColor).toContain('var(--bad)');
    expect(expiryRowStyle('active')).toBeUndefined();
    expect(expiryRowStyle(null)).toBeUndefined();
  });
});

describe('the search and the count line', () => {
  it('matches a creator name case-insensitively and lets an empty query through', () => {
    expect(matchesQuery('Danielle Okonkwo', '')).toBe(true);
    expect(matchesQuery('Danielle Okonkwo', 'okon')).toBe(true);
    expect(matchesQuery('Danielle Okonkwo', 'marcus')).toBe(false);
  });

  it('counts in words, singular and plural, and says so while narrowed', () => {
    expect(creatorCountLabel(5)).toBe('5 creators');
    expect(creatorCountLabel(1)).toBe('1 creator');
    expect(creatorCountLabel(0)).toBe('0 creators');
    expect(partnershipCountLabel(3)).toBe('3 partnerships');
    expect(partnershipCountLabel(1)).toBe('1 partnership');
    expect(filteredCountLabel(1, creatorCountLabel(5))).toBe('1 of 5 creators');
  });
});

function makeCollab(overrides: Partial<CollabRow> = {}): CollabRow {
  return {
    id: 'collab-1',
    conceptId: null,
    briefId: null,
    costUsd: null,
    startDate: null,
    endDate: null,
    internalStatus: 'request',
    clientStatus: 'pending_for_approval',
    assetsStatus: 'pending_for_cs_approval',
    notes: null,
    ...overrides,
  };
}

describe('collabStats', () => {
  it('totals cost and counts active collabs', () => {
    const collabs = [
      makeCollab({
        costUsd: 500,
        internalStatus: 'approved',
        clientStatus: 'approved',
        assetsStatus: 'approved',
      }),
      makeCollab({ id: 'c2', costUsd: 300, internalStatus: 'in_progress' }),
      makeCollab({ id: 'c3', costUsd: null, internalStatus: 'request' }),
    ];
    const stats = collabStats(collabs);
    expect(stats.totalCollabs).toBe(3);
    expect(stats.totalPaid).toBe(800);
    expect(stats.activeCollabs).toBe(2);
  });

  it('returns zeroes for an empty list', () => {
    const stats = collabStats([]);
    expect(stats.totalCollabs).toBe(0);
    expect(stats.totalPaid).toBe(0);
    expect(stats.activeCollabs).toBe(0);
  });
});

describe('collabDateLabel', () => {
  it('formats a range with start and end', () => {
    const label = collabDateLabel(
      makeCollab({
        startDate: new Date('2026-07-05T10:00:00.000Z'),
        endDate: new Date('2026-08-04T10:00:00.000Z'),
      }),
    );
    expect(label).toBe('2026-07-05 → 2026-08-04');
  });

  it('shows ongoing when endDate is null', () => {
    const label = collabDateLabel(
      makeCollab({ startDate: new Date('2026-09-15T08:30:00.000Z'), endDate: null }),
    );
    expect(label).toBe('2026-09-15 → ongoing');
  });
});
