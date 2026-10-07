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

function countApproved(
  rows: readonly { clientStatus: string | null }[],
  approvedValue: string,
): { approved: number; total: number } {
  let approved = 0;
  for (const row of rows) {
    if (row.clientStatus === approvedValue) approved++;
  }
  return { approved, total: rows.length };
}

function countApprovedByStatus(
  rows: readonly { status: string | null }[],
  approvedValue: string,
): { approved: number; total: number } {
  let approved = 0;
  for (const row of rows) {
    if (row.status === approvedValue) approved++;
  }
  return { approved, total: rows.length };
}

export function computeClientProgress(data: {
  concepts: readonly { clientStatus: string | null }[];
  briefs: readonly { clientStatus: string | null }[];
  creativeSheet: readonly { status: string | null }[];
}): ClientProgress {
  const concepts = countApproved(data.concepts, 'approved');
  const briefs = countApproved(data.briefs, 'approved');
  const creativeSheet = countApprovedByStatus(data.creativeSheet, 'approved');

  const approved = concepts.approved + briefs.approved + creativeSheet.approved;
  const total = concepts.total + briefs.total + creativeSheet.total;
  const percentage = total === 0 ? 0 : Math.round((approved / total) * 100);

  return {
    percentage,
    approved,
    total,
    breakdown: { concepts, briefs, creativeSheet },
  };
}
