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
    expect(clientApprovalLabel('disapproved')).toBe('Disapproved');
    expect(clientApprovalLabel('revision_needed')).toBe('Revision Needed');
    expect(clientApprovalLabel('pending_client_approval')).toBe('Pending Client Approval');
  });

  it('returns dash for null/undefined/unknown', () => {
    expect(clientApprovalLabel(null)).toBe('—');
    expect(clientApprovalLabel(undefined)).toBe('—');
    expect(clientApprovalLabel('nope')).toBe('—');
  });

  it('returns tone for known key', () => {
    expect(clientApprovalTone('approved')).toBe('ok');
    expect(clientApprovalTone('disapproved')).toBe('error');
    expect(clientApprovalTone('pending_client_approval')).toBe('warning');
    expect(clientApprovalTone('revision_needed')).toBe('warning');
  });

  it('returns neutral for null/undefined/unknown', () => {
    expect(clientApprovalTone(null)).toBe('neutral');
    expect(clientApprovalTone(undefined)).toBe('neutral');
  });
});
