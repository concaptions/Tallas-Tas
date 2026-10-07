import { describe, expect, it } from 'vitest';

import { computeClientProgress } from './index';

describe('computeClientProgress', () => {
  it('returns zero percentage when all arrays are empty', () => {
    const result = computeClientProgress({
      concepts: [],
      briefs: [],
      creativeSheet: [],
    });

    expect(result.percentage).toBe(0);
    expect(result.approved).toBe(0);
    expect(result.total).toBe(0);
    expect(result.breakdown.concepts).toEqual({ approved: 0, total: 0 });
    expect(result.breakdown.briefs).toEqual({ approved: 0, total: 0 });
    expect(result.breakdown.creativeSheet).toEqual({ approved: 0, total: 0 });
  });

  it('counts approved concepts by clientStatus', () => {
    const result = computeClientProgress({
      concepts: [
        { clientStatus: 'approved' },
        { clientStatus: 'pending_for_approval' },
        { clientStatus: 'approved' },
      ],
      briefs: [],
      creativeSheet: [],
    });

    expect(result.breakdown.concepts).toEqual({ approved: 2, total: 3 });
    expect(result.approved).toBe(2);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(67);
  });

  it('counts approved briefs by clientStatus', () => {
    const result = computeClientProgress({
      concepts: [],
      briefs: [
        { clientStatus: 'approved' },
        { clientStatus: null },
        { clientStatus: 'revisions_needed' },
      ],
      creativeSheet: [],
    });

    expect(result.breakdown.briefs).toEqual({ approved: 1, total: 3 });
    expect(result.percentage).toBe(33);
  });

  it('counts approved creative sheet items by status', () => {
    const result = computeClientProgress({
      concepts: [],
      briefs: [],
      creativeSheet: [
        { status: 'approved' },
        { status: 'approved' },
        { status: 'pending_client_approval' },
        { status: 'disapproved' },
      ],
    });

    expect(result.breakdown.creativeSheet).toEqual({ approved: 2, total: 4 });
    expect(result.percentage).toBe(50);
  });

  it('aggregates across all three tables', () => {
    const result = computeClientProgress({
      concepts: [{ clientStatus: 'approved' }],
      briefs: [{ clientStatus: 'approved' }, { clientStatus: 'pending_for_approval' }],
      creativeSheet: [{ status: 'approved' }, { status: 'disapproved' }],
    });

    // 1 + 1 + 1 = 3 approved out of 1 + 2 + 2 = 5 total
    expect(result.approved).toBe(3);
    expect(result.total).toBe(5);
    expect(result.percentage).toBe(60);
  });

  it('handles all approved', () => {
    const result = computeClientProgress({
      concepts: [{ clientStatus: 'approved' }],
      briefs: [{ clientStatus: 'approved' }],
      creativeSheet: [{ status: 'approved' }],
    });

    expect(result.percentage).toBe(100);
    expect(result.approved).toBe(3);
    expect(result.total).toBe(3);
  });

  it('handles none approved', () => {
    const result = computeClientProgress({
      concepts: [{ clientStatus: 'pending_for_approval' }],
      briefs: [{ clientStatus: null }],
      creativeSheet: [{ status: 'pending_client_approval' }],
    });

    expect(result.percentage).toBe(0);
    expect(result.approved).toBe(0);
    expect(result.total).toBe(3);
  });

  it('treats null statuses as not approved', () => {
    const result = computeClientProgress({
      concepts: [{ clientStatus: null }],
      briefs: [{ clientStatus: null }],
      creativeSheet: [{ status: null }],
    });

    expect(result.approved).toBe(0);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(0);
  });
});
