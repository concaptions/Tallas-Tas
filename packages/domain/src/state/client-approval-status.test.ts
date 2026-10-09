import { describe, expect, it } from 'vitest';

import {
  CLIENT_APPROVAL_STATUS,
  clientApprovalLabel,
  clientApprovalTone,
  normalizeClientApprovalStatus,
} from './client-approval-status';
import { CLIENT_STATUS, chipTone } from './creative-status';

describe('CLIENT_APPROVAL_STATUS — one client vocabulary (2026-10-10)', () => {
  it('is CLIENT_STATUS, key for key, in the same order', () => {
    expect(CLIENT_APPROVAL_STATUS.map((entry) => entry.key)).toEqual(
      CLIENT_STATUS.map((entry) => entry.key),
    );
    expect(CLIENT_APPROVAL_STATUS).toHaveLength(6);
  });

  it('tones every entry the way chipTone tones the creative chip for the same label', () => {
    for (const entry of CLIENT_APPROVAL_STATUS) {
      expect(entry.tone).toBe(chipTone(entry.label));
    }
    expect(clientApprovalTone('approved')).toBe('ok');
    expect(clientApprovalTone('disapproved')).toBe('bad');
    expect(clientApprovalTone('revisions_needed')).toBe('warn');
  });
});

describe('normalizeClientApprovalStatus', () => {
  it('returns a CLIENT_STATUS key unchanged', () => {
    for (const entry of CLIENT_STATUS) {
      expect(normalizeClientApprovalStatus(entry.key)).toBe(entry.key);
    }
  });

  it('maps the retired four-value spelling onto the client track', () => {
    expect(normalizeClientApprovalStatus('pending_client_approval')).toBe('pending_for_approval');
    expect(normalizeClientApprovalStatus('revision_needed')).toBe('revisions_needed');
  });

  it('returns null for null, undefined and anything outside both spellings', () => {
    expect(normalizeClientApprovalStatus(null)).toBeNull();
    expect(normalizeClientApprovalStatus(undefined)).toBeNull();
    expect(normalizeClientApprovalStatus('nonsense')).toBeNull();
  });
});

describe('clientApprovalLabel / clientApprovalTone', () => {
  it('labels a key, a legacy key, and dashes the rest', () => {
    expect(clientApprovalLabel('approved')).toBe('Approved');
    expect(clientApprovalLabel('launched')).toBe('Launched');
    expect(clientApprovalLabel('revision_needed')).toBe('Revisions Needed');
    expect(clientApprovalLabel('pending_client_approval')).toBe('Pending for Approval');
    expect(clientApprovalLabel(null)).toBe('—');
    expect(clientApprovalLabel(undefined)).toBe('—');
    expect(clientApprovalLabel('nonsense')).toBe('—');
  });

  it('tones a legacy key as its mapped entry and the rest as mute', () => {
    expect(clientApprovalTone('revision_needed')).toBe('warn');
    expect(clientApprovalTone(null)).toBe('mute');
    expect(clientApprovalTone('nonsense')).toBe('mute');
  });
});
