import { notFound } from 'next/navigation';

import { loadCreatorRankingById } from '@/lib/creator-ranking-source';
import { isDemoMode } from '@/lib/demo-mode';

import { RankingDetail, type RankingValues } from './ranking-detail';

interface RankingPageProps {
  readonly params: Promise<{ rankingId: string }>;
}

export default async function RankingPage({ params }: RankingPageProps) {
  const { rankingId } = await params;
  const demo = isDemoMode();
  const creating = rankingId === 'new';

  const { ranking } = creating ? { ranking: null } : await loadCreatorRankingById(rankingId);
  if (!creating && ranking === null) notFound();

  const values: RankingValues | null =
    ranking === null
      ? null
      : {
          id: ranking.id,
          creatorId: ranking.creatorId,
          creatorName: ranking.creatorName,
          totalAds: ranking.totalAds,
          totalSpend: ranking.totalSpend,
          totalConversions: ranking.totalConversions,
          avgRoas: ranking.avgRoas,
          avgCpa: ranking.avgCpa,
          rank: ranking.rank,
          periodLabel: ranking.periodLabel,
        };

  return <RankingDetail ranking={values} demo={demo} />;
}
