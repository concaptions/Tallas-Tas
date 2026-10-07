export interface ClientProgress {
  percentage: number;
  approved: number;
  total: number;
  breakdown: {
    concepts: { approved: number; total: number };
    briefs: { approved: number; total: number };
    creativeSheet: { approved: number; total: number };
  };
}

export function computeClientProgress(data: {
  concepts: readonly { clientStatus: string | null }[];
  briefs: readonly { clientStatus: string | null }[];
  creativeSheet: readonly { status: string | null }[];
}): ClientProgress {
  const conceptApproved = data.concepts.filter((c) => c.clientStatus === 'approved').length;
  const briefApproved = data.briefs.filter((b) => b.clientStatus === 'approved').length;
  const sheetApproved = data.creativeSheet.filter((s) => s.status === 'approved').length;

  const approved = conceptApproved + briefApproved + sheetApproved;
  const total = data.concepts.length + data.briefs.length + data.creativeSheet.length;
  const percentage = total === 0 ? 0 : Math.round((approved / total) * 100);

  return {
    percentage,
    approved,
    total,
    breakdown: {
      concepts: { approved: conceptApproved, total: data.concepts.length },
      briefs: { approved: briefApproved, total: data.briefs.length },
      creativeSheet: { approved: sheetApproved, total: data.creativeSheet.length },
    },
  };
}
