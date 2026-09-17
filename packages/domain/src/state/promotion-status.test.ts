import { describe, expect, it } from 'vitest';

import { chipTone } from './creative-status';
import {
  PROMOTION_STATUS,
  PROMOTION_STATUS_INITIAL,
  PROMOTION_STATUS_KEYS,
  isPromotionStatus,
  promotionStatusEntry,
  promotionStatusLabel,
  promotionStatusTone,
  type PromotionStatusKey,
} from './promotion-status';

describe('PROMOTION_STATUS', () => {
  it('is exactly the three keys the status column stores, in machine order', () => {
    expect(PROMOTION_STATUS.map((entry) => entry.key)).toEqual(['pending', 'approved', 'rejected']);
  });

  it('matches the storage vocabulary @tas/db hand-copies in schema/promotion-requests.ts', () => {
    // `PromotionRequestStatus` there is written out as a literal union because @tas/db does not
    // depend on @tas/domain. This is this side of that contract; apps/web asserts the two equal.
    const stored: readonly ('pending' | 'approved' | 'rejected')[] = PROMOTION_STATUS_KEYS;
    expect(stored).toEqual(['pending', 'approved', 'rejected']);
  });

  it('gives every status a label, a description and a tone', () => {
    for (const entry of PROMOTION_STATUS) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.tone.length).toBeGreaterThan(0);
    }
  });

  it('labels each status as the page prints it', () => {
    expect(PROMOTION_STATUS.map((entry) => entry.label)).toEqual([
      'Pending',
      'Approved',
      'Rejected',
    ]);
  });

  it('starts at pending, which is the only state the queue lists', () => {
    expect(PROMOTION_STATUS_INITIAL).toBe('pending');
    expect(PROMOTION_STATUS[0].key).toBe(PROMOTION_STATUS_INITIAL);
  });

  it('has no duplicate keys', () => {
    expect(new Set(PROMOTION_STATUS_KEYS).size).toBe(PROMOTION_STATUS_KEYS.length);
  });
});

describe('isPromotionStatus', () => {
  it('accepts every key in the tuple', () => {
    for (const key of PROMOTION_STATUS_KEYS) {
      expect(isPromotionStatus(key)).toBe(true);
    }
  });

  it('refuses a status from another table and an empty string', () => {
    expect(isPromotionStatus('approved_by_client')).toBe(false);
    expect(isPromotionStatus('disapproved')).toBe(false);
    expect(isPromotionStatus('Pending')).toBe(false);
    expect(isPromotionStatus('')).toBe(false);
  });
});

describe('promotionStatusEntry', () => {
  it('finds each status', () => {
    for (const entry of PROMOTION_STATUS) {
      expect(promotionStatusEntry(entry.key)).toBe(entry);
    }
  });

  it('is undefined for a value this build does not know', () => {
    expect(promotionStatusEntry('withdrawn')).toBeUndefined();
  });
});

describe('promotionStatusLabel', () => {
  it('labels every status', () => {
    expect(PROMOTION_STATUS_KEYS.map(promotionStatusLabel)).toEqual([
      'Pending',
      'Approved',
      'Rejected',
    ]);
  });

  it('echoes an unknown value back rather than rendering a blank chip', () => {
    expect(promotionStatusLabel('withdrawn')).toBe('withdrawn');
    expect(promotionStatusLabel('')).toBe('');
  });
});

describe('promotionStatusTone', () => {
  it('tones every status: pending info, approved ok, rejected bad', () => {
    expect(promotionStatusTone('pending')).toBe('info');
    expect(promotionStatusTone('approved')).toBe('ok');
    expect(promotionStatusTone('rejected')).toBe('bad');
  });

  it('covers every key in the tuple, so no status can render untoned', () => {
    const tones = PROMOTION_STATUS_KEYS.map(promotionStatusTone);
    expect(tones).toHaveLength(PROMOTION_STATUS.length);
    expect(tones).not.toContain('mute');
  });

  it('agrees with chipTone on Approved, which means the same thing on a creative', () => {
    expect(promotionStatusTone('approved')).toBe(chipTone('Approved'));
  });

  it('falls back to mute for a value this build does not know', () => {
    expect(promotionStatusTone('withdrawn')).toBe('mute');
    expect(promotionStatusTone('')).toBe('mute');
  });

  it('reads the tone off the entry, so the two can never disagree', () => {
    for (const entry of PROMOTION_STATUS) {
      expect(promotionStatusTone(entry.key)).toBe(entry.tone);
    }
  });
});

describe('PromotionStatusKey', () => {
  it('is the union of the three keys', () => {
    const keys: PromotionStatusKey[] = ['pending', 'approved', 'rejected'];
    expect(keys.every(isPromotionStatus)).toBe(true);
  });
});
