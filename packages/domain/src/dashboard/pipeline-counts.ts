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

function countBy(
  rows: readonly { [k: string]: string | null }[],
  key: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = (row as Record<string, string | null>)[key];
    if (value !== null && value !== undefined) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
}

export function computePipelineSummary(data: {
  briefs: readonly { internalStatus: string | null; clientStatus: string | null }[];
  concepts: readonly { internalStatus: string | null; clientStatus: string | null }[];
  creativeSheet: readonly { internalStatus: string | null; status: string | null }[];
  copywriting: readonly { status: string | null }[];
  creators: readonly {
    internalCreatorStatus: string | null;
    clientStatus: string | null;
  }[];
}): PipelineSummary {
  return {
    briefs: {
      total: data.briefs.length,
      byInternalStatus: countBy(data.briefs, 'internalStatus'),
      byClientStatus: countBy(data.briefs, 'clientStatus'),
    },
    concepts: {
      total: data.concepts.length,
      byInternalStatus: countBy(data.concepts, 'internalStatus'),
      byClientStatus: countBy(data.concepts, 'clientStatus'),
    },
    creativeSheet: {
      total: data.creativeSheet.length,
      byInternalStatus: countBy(data.creativeSheet, 'internalStatus'),
      byStatus: countBy(data.creativeSheet, 'status'),
    },
    copywriting: {
      total: data.copywriting.length,
      byStatus: countBy(data.copywriting, 'status'),
    },
    creators: {
      total: data.creators.length,
      byInternalStatus: countBy(data.creators, 'internalCreatorStatus'),
      byClientStatus: countBy(data.creators, 'clientStatus'),
    },
  };
}
