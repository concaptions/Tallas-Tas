import { describe, expect, it } from 'vitest';

import { computeClientProgress } from './index';

describe('computeClientProgress', () => {
  it('returns 0% for empty data', () => {
    const result = computeClientProgress({ concepts: [], briefs: [], creativeSheet: [] });
    expect(result.percentage).toBe(0);
    expect(result.approved).toBe(0);
    expect(result.total).toBe(0);
  });

  it('computes percentage across tables', () => {
    const result = computeClientProgress({
      concepts: [{ clientStatus: 'approved' }, { clientStatus: 'pending_client' }],
      briefs: [{ clientStatus: 'approved' }, { clientStatus: 'approved' }, { clientStatus: null }],
      creativeSheet: [{ status: 'approved' }, { status: 'pending_for_approval' }],
    });
    expect(result.approved).toBe(4);
    expect(result.total).toBe(7);
    expect(result.percentage).toBe(57);
  });

  it('returns 100% when everything is approved', () => {
    const result = computeClientProgress({
      concepts: [{ clientStatus: 'approved' }],
      briefs: [{ clientStatus: 'approved' }],
      creativeSheet: [{ status: 'approved' }],
    });
    expect(result.percentage).toBe(100);
  });

  it('breaks down counts per table', () => {
    const result = computeClientProgress({
      concepts: [{ clientStatus: 'approved' }, { clientStatus: 'rejected' }],
      briefs: [],
      creativeSheet: [{ status: 'approved' }],
    });
    expect(result.breakdown.concepts).toEqual({ approved: 1, total: 2 });
    expect(result.breakdown.briefs).toEqual({ approved: 0, total: 0 });
    expect(result.breakdown.creativeSheet).toEqual({ approved: 1, total: 1 });
  });
});
