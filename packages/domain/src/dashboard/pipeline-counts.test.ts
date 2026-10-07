import { describe, expect, it } from 'vitest';

import { computePipelineSummary } from './pipeline-counts';

describe('computePipelineSummary', () => {
  it('returns zero totals for empty arrays', () => {
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
    expect(result.briefs.byInternalStatus).toEqual({});
    expect(result.briefs.byClientStatus).toEqual({});
  });

  it('counts briefs by internal and client status', () => {
    const result = computePipelineSummary({
      briefs: [
        { internalStatus: 'approved', clientStatus: 'pending_for_approval' },
        { internalStatus: 'approved', clientStatus: 'approved' },
        { internalStatus: 'sent_to_video_editor', clientStatus: null },
      ],
      concepts: [],
      creativeSheet: [],
      copywriting: [],
      creators: [],
    });

    expect(result.briefs.total).toBe(3);
    expect(result.briefs.byInternalStatus).toEqual({
      approved: 2,
      sent_to_video_editor: 1,
    });
    expect(result.briefs.byClientStatus).toEqual({
      pending_for_approval: 1,
      approved: 1,
    });
  });

  it('counts concepts by internal and client status', () => {
    const result = computePipelineSummary({
      briefs: [],
      concepts: [
        { internalStatus: 'draft', clientStatus: null },
        { internalStatus: 'draft', clientStatus: 'approved' },
      ],
      creativeSheet: [],
      copywriting: [],
      creators: [],
    });

    expect(result.concepts.total).toBe(2);
    expect(result.concepts.byInternalStatus).toEqual({ draft: 2 });
    expect(result.concepts.byClientStatus).toEqual({ approved: 1 });
  });

  it('counts creative sheet by internalStatus and status', () => {
    const result = computePipelineSummary({
      briefs: [],
      concepts: [],
      creativeSheet: [
        { internalStatus: 'in_progress', status: 'pending_client_approval' },
        { internalStatus: 'in_progress', status: 'approved' },
        { internalStatus: 'done', status: 'approved' },
      ],
      copywriting: [],
      creators: [],
    });

    expect(result.creativeSheet.total).toBe(3);
    expect(result.creativeSheet.byInternalStatus).toEqual({
      in_progress: 2,
      done: 1,
    });
    expect(result.creativeSheet.byStatus).toEqual({
      pending_client_approval: 1,
      approved: 2,
    });
  });

  it('counts copywriting by status', () => {
    const result = computePipelineSummary({
      briefs: [],
      concepts: [],
      creativeSheet: [],
      copywriting: [
        { status: 'draft' },
        { status: 'draft' },
        { status: 'approved' },
        { status: null },
      ],
      creators: [],
    });

    expect(result.copywriting.total).toBe(4);
    expect(result.copywriting.byStatus).toEqual({ draft: 2, approved: 1 });
  });

  it('counts creators by internalCreatorStatus and clientStatus', () => {
    const result = computePipelineSummary({
      briefs: [],
      concepts: [],
      creativeSheet: [],
      copywriting: [],
      creators: [
        { internalCreatorStatus: 'active', clientStatus: 'approved' },
        { internalCreatorStatus: 'active', clientStatus: 'pending_for_approval' },
        { internalCreatorStatus: 'inactive', clientStatus: null },
      ],
    });

    expect(result.creators.total).toBe(3);
    expect(result.creators.byInternalStatus).toEqual({ active: 2, inactive: 1 });
    expect(result.creators.byClientStatus).toEqual({
      approved: 1,
      pending_for_approval: 1,
    });
  });

  it('skips null statuses in the breakdown counts', () => {
    const result = computePipelineSummary({
      briefs: [
        { internalStatus: null, clientStatus: null },
        { internalStatus: 'approved', clientStatus: null },
      ],
      concepts: [],
      creativeSheet: [],
      copywriting: [],
      creators: [],
    });

    expect(result.briefs.total).toBe(2);
    expect(result.briefs.byInternalStatus).toEqual({ approved: 1 });
    expect(result.briefs.byClientStatus).toEqual({});
  });
});
