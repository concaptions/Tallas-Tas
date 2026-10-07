export interface PipelineSummary {
  briefs: {
    total: number;
    byInternalStatus: Record<string, number>;
    byClientStatus: Record<string, number>;
  };
  concepts: {
    total: number;
    byInternalStatus: Record<string, number>;
    byClientStatus: Record<string, number>;
  };
  creativeSheet: {
    total: number;
    byInternalStatus: Record<string, number>;
    byStatus: Record<string, number>;
  };
  copywriting: { total: number; byStatus: Record<string, number> };
  creators: {
    total: number;
    byInternalStatus: Record<string, number>;
    byClientStatus: Record<string, number>;
  };
}

function countBy<T>(
  rows: readonly T[],
  accessor: (row: T) => string | null,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = accessor(row) ?? 'unset';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function computePipelineSummary(data: {
  briefs: readonly { internalStatus: string | null; clientStatus: string | null }[];
  concepts: readonly { internalStatus: string | null; clientStatus: string | null }[];
  creativeSheet: readonly { internalStatus: string | null; status: string | null }[];
  copywriting: readonly { status: string | null }[];
  creators: readonly { internalCreatorStatus: string | null; clientStatus: string | null }[];
}): PipelineSummary {
  return {
    briefs: {
      total: data.briefs.length,
      byInternalStatus: countBy(data.briefs, (r) => r.internalStatus),
      byClientStatus: countBy(data.briefs, (r) => r.clientStatus),
    },
    concepts: {
      total: data.concepts.length,
      byInternalStatus: countBy(data.concepts, (r) => r.internalStatus),
      byClientStatus: countBy(data.concepts, (r) => r.clientStatus),
    },
    creativeSheet: {
      total: data.creativeSheet.length,
      byInternalStatus: countBy(data.creativeSheet, (r) => r.internalStatus),
      byStatus: countBy(data.creativeSheet, (r) => r.status),
    },
    copywriting: {
      total: data.copywriting.length,
      byStatus: countBy(data.copywriting, (r) => r.status),
    },
    creators: {
      total: data.creators.length,
      byInternalStatus: countBy(data.creators, (r) => r.internalCreatorStatus),
      byClientStatus: countBy(data.creators, (r) => r.clientStatus),
    },
  };
}
