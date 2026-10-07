import { describe, expect, it } from 'vitest';
import {
  CLIENT_APPROVAL_STATUS,
  clientApprovalLabel,
  clientApprovalTone,
} from './client-approval-status';

describe('CLIENT_APPROVAL_STATUS', () => {
  it('has 4 statuses', () => {
    expect(CLIENT_APPROVAL_STATUS).toHaveLength(4);
  });

  it('returns label for known key', () => {
    expect(clientApprovalLabel('approved')).toBe('Approved');
  });

  it('returns dash for null', () => {
    expect(clientApprovalLabel(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(clientApprovalLabel(undefined)).toBe('—');
  });

  it('returns dash for unknown key', () => {
    expect(clientApprovalLabel('nonsense')).toBe('—');
  });

  it('returns tone for known key', () => {
    expect(clientApprovalTone('approved')).toBe('ok');
    expect(clientApprovalTone('disapproved')).toBe('error');
    expect(clientApprovalTone('pending_client_approval')).toBe('warning');
    expect(clientApprovalTone('revision_needed')).toBe('warning');
  });

  it('returns neutral tone for null', () => {
    expect(clientApprovalTone(null)).toBe('neutral');
  });

  it('returns neutral tone for unknown key', () => {
    expect(clientApprovalTone('nonsense')).toBe('neutral');
  });
});
