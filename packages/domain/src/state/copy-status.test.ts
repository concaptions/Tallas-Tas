import { describe, expect, it } from 'vitest';

import { CLIENT_STATUS, chipTone, type ChipTone } from './creative-status';
import {
  COPY_STATUS,
  COPY_STATUS_INITIAL,
  COPY_STATUS_KEYS,
  copyStatusEntry,
  copyStatusLabel,
  copyStatusTone,
  isCopyStatus,
} from './copy-status';

describe('COPY_STATUS · the PRD §5.11 vocabulary', () => {
  it('is exactly the five states, in the PRD order: the entry state, then the four ways out', () => {
    expect(COPY_STATUS.map((entry) => entry.key)).toEqual([
      'pending_for_client_review',
      'edited_by_client',
      'approved',
      'revisions_needed',
      'disapproved',
    ]);
  });

  it('labels every state the way the PRD writes it', () => {
    expect(COPY_STATUS.map((entry) => entry.label)).toEqual([
      'Pending For Client Review',
      'Edited By Client',
      'Approved',
      'Revisions Needed',
      'Disapproved',
    ]);
  });

  it('gives every state a non-empty description, because they are the tooltips', () => {
    for (const entry of COPY_STATUS) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('has the `key` / `label` / `description` shape CLIENT_STATUS has', () => {
    expect(Object.keys(COPY_STATUS[0]).sort()).toEqual(Object.keys(CLIENT_STATUS[0]).sort());
  });

  it('has no duplicate key and no duplicate label', () => {
    expect(new Set(COPY_STATUS.map((entry) => entry.key)).size).toBe(COPY_STATUS.length);
    expect(new Set(COPY_STATUS.map((entry) => entry.label)).size).toBe(COPY_STATUS.length);
  });

  it("starts a row in the first entry — the value @tas/db's COPY_STATUS_DEFAULT copies", () => {
    expect(COPY_STATUS_INITIAL).toBe('pending_for_client_review');
    expect(COPY_STATUS_INITIAL).toBe(COPY_STATUS[0].key);
  });

  it('exposes the keys in the same order as the entries', () => {
    expect(COPY_STATUS_KEYS).toEqual(COPY_STATUS.map((entry) => entry.key));
  });
});

describe('isCopyStatus', () => {
  it.each(COPY_STATUS_KEYS)('accepts %s', (key) => {
    expect(isCopyStatus(key)).toBe(true);
  });

  it.each([
    ['', 'the empty string a fresh form holds'],
    ['Approved', 'a label rather than a key'],
    ['pending_for_approval', "the CLIENT track's near-miss key"],
    ['launched', 'a creative-only state'],
  ])('refuses %s (%s)', (value) => {
    expect(isCopyStatus(value)).toBe(false);
  });
});

describe('copyStatusEntry / copyStatusLabel', () => {
  it.each(COPY_STATUS)('finds the entry for $key and labels it $label', (entry) => {
    expect(copyStatusEntry(entry.key)).toEqual(entry);
    expect(copyStatusLabel(entry.key)).toBe(entry.label);
  });

  it('has no entry for a value this build does not know', () => {
    expect(copyStatusEntry('archived')).toBeUndefined();
  });

  it('renders an unknown stored value back, so a cell is never blank', () => {
    expect(copyStatusLabel('archived')).toBe('archived');
    expect(copyStatusLabel('')).toBe('');
  });
});

describe('copyStatusTone', () => {
  const expected: Record<string, ChipTone> = {
    pending_for_client_review: 'info',
    edited_by_client: 'accent',
    approved: 'ok',
    revisions_needed: 'warn',
    disapproved: 'bad',
  };

  it.each(COPY_STATUS_KEYS)('tones %s', (key) => {
    expect(copyStatusTone(key)).toBe(expected[key]);
  });

  it('agrees with chipTone on the two labels the creative track already owns', () => {
    expect(copyStatusTone('approved')).toBe(chipTone('Approved'));
    expect(copyStatusTone('revisions_needed')).toBe(chipTone('Revisions Needed'));
  });

  it('falls back to mute for an unknown value, exactly as chipTone does', () => {
    expect(copyStatusTone('archived')).toBe('mute');
    expect(copyStatusTone('')).toBe('mute');
    expect(copyStatusTone('Approved')).toBe('mute');
  });

  it('uses only tones from the shared ChipTone vocabulary', () => {
    const tones: readonly ChipTone[] = ['ok', 'warn', 'bad', 'info', 'accent', 'mute'];
    for (const key of COPY_STATUS_KEYS) {
      expect(tones).toContain(copyStatusTone(key));
    }
  });
});
