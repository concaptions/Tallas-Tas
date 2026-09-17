import { describe, expect, it } from 'vitest';

import { chipTone } from './creative-status';
import {
  CREATOR_ASSETS_STATUS,
  CREATOR_ASSETS_STATUS_INITIAL,
  CREATOR_ASSETS_STATUS_KEYS,
  CREATOR_INTERNAL_STATUS,
  CREATOR_INTERNAL_STATUS_INITIAL,
  CREATOR_INTERNAL_STATUS_KEYS,
  CREATOR_STATUS,
  CREATOR_STATUS_INITIAL,
  CREATOR_STATUS_KEYS,
  PARTNERSHIP_ACTIVITY,
  PARTNERSHIP_ACTIVITY_ACTIVE,
  PARTNERSHIP_ACTIVITY_INITIAL,
  PARTNERSHIP_ACTIVITY_KEYS,
  creatorAssetsStatusEntry,
  creatorAssetsStatusLabel,
  creatorAssetsStatusTone,
  creatorInternalStatusEntry,
  creatorInternalStatusLabel,
  creatorInternalStatusTone,
  creatorStatusEntry,
  creatorStatusLabel,
  creatorStatusTone,
  isCreatorAssetsStatus,
  isCreatorInternalStatus,
  isCreatorStatus,
  isPartnershipActivity,
  partnershipActivityEntry,
  partnershipActivityLabel,
  partnershipActivityTone,
} from './creator-status';

describe('the three creator tracks', () => {
  it('are the PRD §5.8 keys the database stores, in PRD order', () => {
    expect(CREATOR_INTERNAL_STATUS_KEYS).toEqual([
      'request',
      'pending_for_cs_approval',
      'revisions_needed',
      'approved',
    ]);
    expect(CREATOR_STATUS_KEYS).toEqual([
      'pending_for_approval',
      'approved',
      'revisions_needed',
      'disapproved',
      'due_shipment',
      'filming_in_progress',
      'video_delivered',
    ]);
    expect(CREATOR_ASSETS_STATUS_KEYS).toEqual([
      'pending_for_cs_approval',
      'revisions_needed',
      'approved',
    ]);
    expect(PARTNERSHIP_ACTIVITY_KEYS).toEqual(['active', 'not_active', 'ended']);
  });

  it('carry the PRD labels, so no component writes one', () => {
    expect(CREATOR_STATUS.map((entry) => entry.label)).toEqual([
      'Pending For Approval',
      'Approved',
      'Revisions Needed',
      'Disapproved',
      'Due Shipment',
      'Filming In Progress',
      'Video Delivered',
    ]);
    expect(CREATOR_INTERNAL_STATUS.map((entry) => entry.label)).toEqual([
      'Request',
      'Pending for CS Approval',
      'Revisions Needed',
      'Approved',
    ]);
    expect(CREATOR_ASSETS_STATUS.map((entry) => entry.label)).toEqual([
      'Pending for CS Approval',
      'Revisions Needed',
      'Approved',
    ]);
    expect(PARTNERSHIP_ACTIVITY.map((entry) => entry.label)).toEqual([
      'Active',
      'Not Active',
      'Ended',
    ]);
  });

  it('give every entry a description, because the chip tooltip reads it', () => {
    for (const list of [
      CREATOR_INTERNAL_STATUS,
      CREATOR_STATUS,
      CREATOR_ASSETS_STATUS,
      PARTNERSHIP_ACTIVITY,
    ]) {
      for (const entry of list) {
        expect(entry.description.length).toBeGreaterThan(20);
      }
    }
  });

  it('have no duplicate key inside a list', () => {
    for (const keys of [
      CREATOR_INTERNAL_STATUS_KEYS,
      CREATOR_STATUS_KEYS,
      CREATOR_ASSETS_STATUS_KEYS,
      PARTNERSHIP_ACTIVITY_KEYS,
    ]) {
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('the initial states `@tas/db` copies as its column defaults', () => {
  it('match the schema constants verbatim', () => {
    expect(CREATOR_INTERNAL_STATUS_INITIAL).toBe('request');
    expect(CREATOR_STATUS_INITIAL).toBe('pending_for_approval');
    expect(CREATOR_ASSETS_STATUS_INITIAL).toBe('pending_for_cs_approval');
    expect(PARTNERSHIP_ACTIVITY_INITIAL).toBe('not_active');
  });

  it('are members of their own list — `not_active` included, though it is not first', () => {
    expect(isCreatorInternalStatus(CREATOR_INTERNAL_STATUS_INITIAL)).toBe(true);
    expect(isCreatorStatus(CREATOR_STATUS_INITIAL)).toBe(true);
    expect(isCreatorAssetsStatus(CREATOR_ASSETS_STATUS_INITIAL)).toBe(true);
    expect(isPartnershipActivity(PARTNERSHIP_ACTIVITY_INITIAL)).toBe(true);
    expect(PARTNERSHIP_ACTIVITY[0].key).not.toBe(PARTNERSHIP_ACTIVITY_INITIAL);
  });

  it('name the live window so a write path never types the key', () => {
    expect(PARTNERSHIP_ACTIVITY_ACTIVE).toBe('active');
    expect(isPartnershipActivity(PARTNERSHIP_ACTIVITY_ACTIVE)).toBe(true);
    expect(PARTNERSHIP_ACTIVITY_ACTIVE).not.toBe(PARTNERSHIP_ACTIVITY_INITIAL);
  });
});

describe('the guards', () => {
  it('accept every member and reject a value from a neighbouring track', () => {
    expect(isCreatorStatus('due_shipment')).toBe(true);
    expect(isCreatorStatus('request')).toBe(false);
    expect(isCreatorInternalStatus('request')).toBe(true);
    expect(isCreatorInternalStatus('due_shipment')).toBe(false);
    expect(isCreatorAssetsStatus('approved')).toBe(true);
    expect(isCreatorAssetsStatus('request')).toBe(false);
    expect(isPartnershipActivity('ended')).toBe(true);
    expect(isPartnershipActivity('approved')).toBe(false);
  });

  it('reject an empty string and a label typed in place of a key', () => {
    expect(isCreatorStatus('')).toBe(false);
    expect(isCreatorStatus('Video Delivered')).toBe(false);
    expect(isPartnershipActivity('Not Active')).toBe(false);
  });
});

describe('the entry lookups', () => {
  it('find the entry for a stored value', () => {
    expect(creatorStatusEntry('filming_in_progress')?.label).toBe('Filming In Progress');
    expect(creatorInternalStatusEntry('approved')?.label).toBe('Approved');
    expect(creatorAssetsStatusEntry('revisions_needed')?.label).toBe('Revisions Needed');
    expect(partnershipActivityEntry('active')?.label).toBe('Active');
  });

  it('are undefined for a value this build does not know', () => {
    expect(creatorStatusEntry('shipped_to_moon')).toBeUndefined();
    expect(creatorInternalStatusEntry('')).toBeUndefined();
    expect(creatorAssetsStatusEntry('request')).toBeUndefined();
    expect(partnershipActivityEntry('paused')).toBeUndefined();
  });
});

describe('the labels', () => {
  it('render the PRD wording for every key', () => {
    expect(creatorStatusLabel('pending_for_approval')).toBe('Pending For Approval');
    expect(creatorStatusLabel('due_shipment')).toBe('Due Shipment');
    expect(creatorInternalStatusLabel('pending_for_cs_approval')).toBe('Pending for CS Approval');
    expect(creatorAssetsStatusLabel('approved')).toBe('Approved');
    expect(partnershipActivityLabel('not_active')).toBe('Not Active');
  });

  it('are total: an unknown value renders itself rather than a blank chip', () => {
    expect(creatorStatusLabel('shipped_to_moon')).toBe('shipped_to_moon');
    expect(creatorInternalStatusLabel('escalated')).toBe('escalated');
    expect(creatorAssetsStatusLabel('archived')).toBe('archived');
    expect(partnershipActivityLabel('paused')).toBe('paused');
  });
});

describe('creatorStatusTone', () => {
  it('covers all seven client states', () => {
    expect(creatorStatusTone('pending_for_approval')).toBe('info');
    expect(creatorStatusTone('approved')).toBe('ok');
    expect(creatorStatusTone('revisions_needed')).toBe('warn');
    expect(creatorStatusTone('disapproved')).toBe('bad');
    expect(creatorStatusTone('due_shipment')).toBe('warn');
    expect(creatorStatusTone('filming_in_progress')).toBe('accent');
    expect(creatorStatusTone('video_delivered')).toBe('ok');
  });

  it('agrees with `chipTone` wherever the two share a label', () => {
    expect(creatorStatusTone('approved')).toBe(chipTone('Approved'));
    expect(creatorStatusTone('revisions_needed')).toBe(chipTone('Revisions Needed'));
  });

  it('is mute for a value this build does not know', () => {
    expect(creatorStatusTone('shipped_to_moon')).toBe('mute');
    expect(creatorStatusTone('')).toBe('mute');
  });

  it('gives every key a tone, so no chip can render colourless', () => {
    for (const key of CREATOR_STATUS_KEYS) {
      expect(['ok', 'warn', 'bad', 'info', 'accent', 'mute']).toContain(creatorStatusTone(key));
    }
  });
});

describe('the CS review tones, shared by the internal track and the assets track', () => {
  it('cover every key of both lists', () => {
    expect(creatorInternalStatusTone('request')).toBe('mute');
    expect(creatorInternalStatusTone('pending_for_cs_approval')).toBe('info');
    expect(creatorInternalStatusTone('revisions_needed')).toBe('warn');
    expect(creatorInternalStatusTone('approved')).toBe('ok');
    expect(creatorAssetsStatusTone('pending_for_cs_approval')).toBe('info');
    expect(creatorAssetsStatusTone('revisions_needed')).toBe('warn');
    expect(creatorAssetsStatusTone('approved')).toBe('ok');
  });

  it('agree with each other on the three keys the two lists share', () => {
    for (const key of CREATOR_ASSETS_STATUS_KEYS) {
      expect(creatorAssetsStatusTone(key)).toBe(creatorInternalStatusTone(key));
    }
  });

  it('refuse a key from the other list rather than leaking a tone across tracks', () => {
    expect(creatorAssetsStatusTone('request')).toBe('mute');
    expect(creatorInternalStatusTone('due_shipment')).toBe('mute');
  });

  it('is mute for a value this build does not know', () => {
    expect(creatorInternalStatusTone('escalated')).toBe('mute');
    expect(creatorAssetsStatusTone('')).toBe('mute');
  });
});

describe('partnershipActivityTone', () => {
  it('is ok when permission is in force, mute at rest and bad once the window closed', () => {
    expect(partnershipActivityTone('active')).toBe('ok');
    expect(partnershipActivityTone('not_active')).toBe('mute');
    expect(partnershipActivityTone('ended')).toBe('bad');
  });

  it('is mute for a value this build does not know', () => {
    expect(partnershipActivityTone('paused')).toBe('mute');
    expect(partnershipActivityTone('')).toBe('mute');
  });
});
