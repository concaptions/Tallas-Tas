import { describe, expect, it } from 'vitest';

import { computePipelineSummary } from './pipeline-counts';

describe('computePipelineSummary', () => {
  it('counts empty inputs as zero', () => {
    const result = computePipelineSummary({
      briefs: [],
      concepts: [],
      creativeSheet: [],
      copywriting: [],
      creators: [],
    });
    expect(result.briefs.total).toBe(0);
    expect(result.concepts.total).toBe(0);
    expect(result.creativeSheet.total).toBe(0);
    expect(result.copywriting.total).toBe(0);
    expect(result.creators.total).toBe(0);
  });

  it('groups by status', () => {
    const result = computePipelineSummary({
      briefs: [
        { internalStatus: 'incoming', clientStatus: null },
        { internalStatus: 'incoming', clientStatus: 'approved' },
        { internalStatus: 'editing', clientStatus: 'approved' },
      ],
      concepts: [],
      creativeSheet: [],
      copywriting: [{ status: 'pending_for_client_review' }, { status: 'approved' }],
      creators: [],
    });
    expect(result.briefs.total).toBe(3);
    expect(result.briefs.byInternalStatus).toEqual({ incoming: 2, editing: 1 });
    expect(result.briefs.byClientStatus).toEqual({ unset: 1, approved: 2 });
    expect(result.copywriting.total).toBe(2);
    expect(result.copywriting.byStatus).toEqual({
      pending_for_client_review: 1,
      approved: 1,
    });
  });

  it('uses "unset" for null statuses', () => {
    const result = computePipelineSummary({
      briefs: [{ internalStatus: null, clientStatus: null }],
      concepts: [],
      creativeSheet: [{ internalStatus: null, status: null }],
      copywriting: [],
      creators: [],
    });
    expect(result.briefs.byInternalStatus).toEqual({ unset: 1 });
    expect(result.creativeSheet.byStatus).toEqual({ unset: 1 });
  });
});
