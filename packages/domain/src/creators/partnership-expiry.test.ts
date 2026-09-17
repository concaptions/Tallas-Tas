import { describe, expect, it } from 'vitest';

import {
  EXPIRED_LABEL,
  NO_EXPIRY_LABEL,
  PARTNERSHIP_EXPIRING_DAYS,
  PARTNERSHIP_REMINDER_DAYS,
  daysUntilPartnershipExpiry,
  expiryStateFor,
  expiryTone,
  isPartnershipDueReminder,
  isPartnershipNearExpiry,
  partnershipCountdownLabel,
  partnershipExpiresOn,
  partnershipExpiry,
} from './partnership-expiry';

/** The instant `demo-data.ts` pins its partnership fixtures to (`PARTNERSHIP_REFERENCE_DATE`). */
const NOW = new Date('2026-09-17T09:00:00.000Z');

/** A window that lapses exactly `days` whole days after `NOW`, built backwards from the answer. */
function lapsingIn(days: number, extensionDays = 0) {
  const periodDays = 60;
  const activatedAt = new Date(
    NOW.getTime() + days * 86_400_000 - (periodDays + extensionDays) * 86_400_000,
  );
  return { activatedAt, periodDays, extensionDays };
}

describe('partnershipExpiresOn', () => {
  it('is activation plus period, to the instant', () => {
    expect(
      partnershipExpiresOn({
        activatedAt: new Date('2026-07-22T09:00:00.000Z'),
        periodDays: 60,
        extensionDays: 0,
      }),
    ).toEqual(new Date('2026-09-20T09:00:00.000Z'));
  });

  it('adds the extension on top of the period', () => {
    const withoutExtension = partnershipExpiresOn({
      activatedAt: new Date('2026-07-09T09:00:00.000Z'),
      periodDays: 60,
      extensionDays: 0,
    });
    const withExtension = partnershipExpiresOn({
      activatedAt: new Date('2026-07-09T09:00:00.000Z'),
      periodDays: 60,
      extensionDays: 30,
    });
    expect(withoutExtension).toEqual(new Date('2026-09-07T09:00:00.000Z'));
    // 60 + 30 days from 2026-07-09, i.e. the extension pushes the lapse date out by exactly 30 days.
    expect(withExtension).toEqual(new Date('2026-10-07T09:00:00.000Z'));
    expect((withExtension as Date).getTime() - (withoutExtension as Date).getTime()).toBe(
      30 * 86_400_000,
    );
  });

  it('treats a missing extension as zero rather than refusing to compute', () => {
    const activatedAt = new Date('2026-07-22T09:00:00.000Z');
    const expected = new Date('2026-09-20T09:00:00.000Z');
    expect(partnershipExpiresOn({ activatedAt, periodDays: 60 })).toEqual(expected);
    expect(partnershipExpiresOn({ activatedAt, periodDays: 60, extensionDays: null })).toEqual(
      expected,
    );
  });

  it('is null when there is no window to compute', () => {
    expect(partnershipExpiresOn({ activatedAt: null, periodDays: 60 })).toBeNull();
    expect(
      partnershipExpiresOn({ activatedAt: new Date('2026-07-22T09:00:00.000Z'), periodDays: null }),
    ).toBeNull();
    expect(partnershipExpiresOn({ activatedAt: null, periodDays: null })).toBeNull();
    expect(partnershipExpiresOn({ activatedAt: new Date('nonsense'), periodDays: 60 })).toBeNull();
    expect(
      partnershipExpiresOn({
        activatedAt: new Date('2026-07-22T09:00:00.000Z'),
        periodDays: Number.NaN,
      }),
    ).toBeNull();
  });

  it('truncates a fractional period so the lapse instant is always a whole number of days out', () => {
    expect(
      partnershipExpiresOn({
        activatedAt: new Date('2026-07-22T09:00:00.000Z'),
        periodDays: 60.9,
        extensionDays: 0.9,
      }),
    ).toEqual(new Date('2026-09-20T09:00:00.000Z'));
  });
});

describe('daysUntilPartnershipExpiry', () => {
  it('counts whole days to the lapse date', () => {
    expect(daysUntilPartnershipExpiry(lapsingIn(3), NOW)).toBe(3);
    expect(daysUntilPartnershipExpiry(lapsingIn(20), NOW)).toBe(20);
    expect(daysUntilPartnershipExpiry(lapsingIn(0), NOW)).toBe(0);
  });

  it('is negative once the window has lapsed', () => {
    expect(daysUntilPartnershipExpiry(lapsingIn(-1), NOW)).toBe(-1);
    expect(daysUntilPartnershipExpiry(lapsingIn(-125), NOW)).toBe(-125);
  });

  it('floors, so a part-day left is zero and a part-day past is already negative', () => {
    const fourHoursBefore = new Date(NOW.getTime() + 4 * 3_600_000);
    const fourHoursAfter = new Date(NOW.getTime() - 4 * 3_600_000);
    expect(daysUntilPartnershipExpiry(lapsingIn(0), fourHoursAfter)).toBe(0);
    expect(daysUntilPartnershipExpiry(lapsingIn(0), fourHoursBefore)).toBe(-1);
  });

  it('is null when there is no window, and when `now` is unusable', () => {
    expect(daysUntilPartnershipExpiry({ activatedAt: null, periodDays: null }, NOW)).toBeNull();
    expect(daysUntilPartnershipExpiry(lapsingIn(3), new Date('nonsense'))).toBeNull();
  });
});

describe('expiryStateFor', () => {
  it('is expiring at exactly the threshold and active one day beyond it', () => {
    expect(PARTNERSHIP_EXPIRING_DAYS).toBe(5);
    expect(expiryStateFor(5)).toBe('expiring');
    expect(expiryStateFor(6)).toBe('active');
  });

  it('is expiring at zero: on the last day permission is still live', () => {
    expect(expiryStateFor(0)).toBe('expiring');
  });

  it('is expired below zero', () => {
    expect(expiryStateFor(-1)).toBe('expired');
    expect(expiryStateFor(-125)).toBe('expired');
  });

  it('is active far out', () => {
    expect(expiryStateFor(20)).toBe('active');
    expect(expiryStateFor(89)).toBe('active');
  });
});

describe('partnershipExpiry', () => {
  it('returns the date, the countdown and the state together', () => {
    expect(
      partnershipExpiry(
        {
          activatedAt: new Date('2026-07-22T09:00:00.000Z'),
          periodDays: 60,
          extensionDays: 0,
        },
        NOW,
      ),
    ).toEqual({
      expiresAt: new Date('2026-09-20T09:00:00.000Z'),
      daysRemaining: 3,
      state: 'expiring',
    });
  });

  it('walks the whole range at the boundaries', () => {
    expect(partnershipExpiry(lapsingIn(6), NOW)?.state).toBe('active');
    expect(partnershipExpiry(lapsingIn(5), NOW)?.state).toBe('expiring');
    expect(partnershipExpiry(lapsingIn(0), NOW)?.state).toBe('expiring');
    expect(partnershipExpiry(lapsingIn(-1), NOW)?.state).toBe('expired');
  });

  it('carries an extension through to the state: it can move a row out of expiring', () => {
    const base = { activatedAt: new Date('2026-07-22T09:00:00.000Z'), periodDays: 60 };
    expect(partnershipExpiry({ ...base, extensionDays: 0 }, NOW)).toMatchObject({
      daysRemaining: 3,
      state: 'expiring',
    });
    expect(partnershipExpiry({ ...base, extensionDays: 30 }, NOW)).toMatchObject({
      expiresAt: new Date('2026-10-20T09:00:00.000Z'),
      daysRemaining: 33,
      state: 'active',
    });
  });

  it('is null for a creator marked for partnership ads who was never whitelisted', () => {
    expect(
      partnershipExpiry({ activatedAt: null, periodDays: null, extensionDays: 0 }, NOW),
    ).toBeNull();
  });
});

describe('the demo fixtures pinned to PARTNERSHIP_REFERENCE_DATE', () => {
  // Copied from `demoCreators` in `packages/db/src/demo-data.ts`. The e2e test asserts the same
  // three numbers on the rendered page; this pins the arithmetic behind them.
  const danielle = {
    activatedAt: new Date('2026-07-22T09:00:00.000Z'),
    periodDays: 60,
    extensionDays: 0,
  };
  const marcus = {
    activatedAt: new Date('2026-07-09T09:00:00.000Z'),
    periodDays: 60,
    extensionDays: 30,
  };
  const priya = {
    activatedAt: new Date('2026-04-15T09:00:00.000Z'),
    periodDays: 30,
    extensionDays: 0,
  };

  it('reads 3 days, 20 days and long lapsed', () => {
    expect(partnershipExpiry(danielle, NOW)).toEqual({
      expiresAt: new Date('2026-09-20T09:00:00.000Z'),
      daysRemaining: 3,
      state: 'expiring',
    });
    expect(partnershipExpiry(marcus, NOW)).toEqual({
      expiresAt: new Date('2026-10-07T09:00:00.000Z'),
      daysRemaining: 20,
      state: 'active',
    });
    expect(partnershipExpiry(priya, NOW)).toMatchObject({
      expiresAt: new Date('2026-05-15T09:00:00.000Z'),
      state: 'expired',
    });
    expect(partnershipExpiry(priya, NOW)?.daysRemaining).toBeLessThan(0);
  });

  it('highlights exactly one of the three rows', () => {
    const highlighted = [danielle, marcus, priya].filter((row) =>
      isPartnershipNearExpiry(row, NOW),
    );
    expect(highlighted).toEqual([danielle]);
  });
});

describe('isPartnershipNearExpiry', () => {
  it('is the highlight window: still live, at or inside the threshold', () => {
    expect(isPartnershipNearExpiry(lapsingIn(6), NOW)).toBe(false);
    expect(isPartnershipNearExpiry(lapsingIn(5), NOW)).toBe(true);
    expect(isPartnershipNearExpiry(lapsingIn(1), NOW)).toBe(true);
    expect(isPartnershipNearExpiry(lapsingIn(0), NOW)).toBe(true);
  });

  it('is false once lapsed — an expired row is past expiry, not near it', () => {
    expect(isPartnershipNearExpiry(lapsingIn(-1), NOW)).toBe(false);
  });

  it('is false for a row with no partnership window', () => {
    expect(isPartnershipNearExpiry({ activatedAt: null, periodDays: null }, NOW)).toBe(false);
  });
});

describe('isPartnershipDueReminder', () => {
  it('is the wider §5.8.1 renewal cadence, not the row highlight', () => {
    expect(PARTNERSHIP_REMINDER_DAYS).toBe(25);
    expect(isPartnershipDueReminder(lapsingIn(26), NOW)).toBe(false);
    expect(isPartnershipDueReminder(lapsingIn(25), NOW)).toBe(true);
    expect(isPartnershipDueReminder(lapsingIn(20), NOW)).toBe(true);
    expect(isPartnershipDueReminder(lapsingIn(0), NOW)).toBe(true);
    expect(isPartnershipDueReminder(lapsingIn(-1), NOW)).toBe(false);
  });

  it('contains every near-expiry row, so the two thresholds cannot invert', () => {
    for (let days = -2; days <= 30; days += 1) {
      const row = lapsingIn(days);
      if (isPartnershipNearExpiry(row, NOW)) {
        expect(isPartnershipDueReminder(row, NOW)).toBe(true);
      }
    }
  });

  it('is false for a row with no partnership window', () => {
    expect(isPartnershipDueReminder({ activatedAt: null, periodDays: null }, NOW)).toBe(false);
  });
});

describe('expiryTone', () => {
  it('maps active to ok, expiring to warn and expired to bad', () => {
    expect(expiryTone('active')).toBe('ok');
    expect(expiryTone('expiring')).toBe('warn');
    expect(expiryTone('expired')).toBe('bad');
  });

  it('is mute for a row with no window, rather than colouring it as a problem', () => {
    expect(expiryTone(null)).toBe('mute');
  });
});

describe('partnershipCountdownLabel', () => {
  it('reads Expired once lapsed, never a negative number', () => {
    const label = partnershipCountdownLabel(partnershipExpiry(lapsingIn(-1), NOW));
    expect(label).toBe(EXPIRED_LABEL);
    expect(label).toBe('Expired');
    expect(label).not.toContain('-');
  });

  it('reads Today on the last day, never "0 days"', () => {
    expect(partnershipCountdownLabel(partnershipExpiry(lapsingIn(0), NOW))).toBe('Today');
  });

  it('is singular at one and plural above it', () => {
    expect(partnershipCountdownLabel(partnershipExpiry(lapsingIn(1), NOW))).toBe('1 day');
    expect(partnershipCountdownLabel(partnershipExpiry(lapsingIn(3), NOW))).toBe('3 days');
    expect(partnershipCountdownLabel(partnershipExpiry(lapsingIn(20), NOW))).toBe('20 days');
  });

  it('is an em dash for a row that was never activated', () => {
    expect(partnershipCountdownLabel(null)).toBe(NO_EXPIRY_LABEL);
    expect(partnershipCountdownLabel(null)).toBe('—');
  });
});
