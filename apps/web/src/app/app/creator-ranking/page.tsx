import { isDemoMode } from '@/lib/demo-mode';
import { loadCreatorRankings } from '@/lib/creator-ranking-source';

import { CreatorLeaderboard, type RankingItem } from './creator-leaderboard';

function currency(v: string): string {
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function CreatorRankingPage() {
  const { rows } = await loadCreatorRankings();
  const demo = isDemoMode();
  const items: RankingItem[] = rows.map((row) => ({
    ranking: row,
    spendLabel: currency(row.totalSpend),
    roasLabel: row.avgRoas !== null ? `${Number(row.avgRoas).toFixed(1)}x` : '—',
    cpaLabel: row.avgCpa !== null ? currency(row.avgCpa) : '—',
  }));
  return <CreatorLeaderboard items={items} demo={demo} />;
}
