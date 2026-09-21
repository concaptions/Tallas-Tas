'use client';

import { useRouter } from 'next/navigation';
import type { CreatorRankingListRow } from '@tas/db';
import { DisabledWrite, Button } from '@tas/ui';

import { creatorRankingDetailPath } from '@/lib/routes';

export interface RankingItem {
  readonly ranking: CreatorRankingListRow;
  readonly spendLabel: string;
  readonly roasLabel: string;
  readonly cpaLabel: string;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function CreatorLeaderboard({
  items,
  demo,
}: {
  items: readonly RankingItem[];
  demo: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text1">Creator Ranking</h1>
        <DisabledWrite active={demo}>
          <Button size="sm" disabled={demo}>
            Refresh Rankings
          </Button>
        </DisabledWrite>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">No creator rankings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-text3">
                <th className="px-2 py-2">Rank</th>
                <th className="px-2 py-2">Creator</th>
                <th className="px-2 py-2">Ads</th>
                <th className="px-2 py-2">Spend</th>
                <th className="px-2 py-2">Conv.</th>
                <th className="px-2 py-2">Avg ROAS</th>
                <th className="px-2 py-2">Avg CPA</th>
                <th className="px-2 py-2">Period</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ ranking, spendLabel, roasLabel, cpaLabel }) => (
                <tr
                  key={ranking.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    router.push(creatorRankingDetailPath(ranking.id));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(creatorRankingDetailPath(ranking.id));
                    }
                  }}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface2"
                >
                  <td className="px-2 py-2 text-center">
                    {MEDAL[ranking.rank] ?? `#${String(ranking.rank)}`}
                  </td>
                  <td className="px-2 py-2 font-semibold text-text1">{ranking.creatorName}</td>
                  <td className="px-2 py-2">{ranking.totalAds}</td>
                  <td className="px-2 py-2">{spendLabel}</td>
                  <td className="px-2 py-2">{ranking.totalConversions}</td>
                  <td className="px-2 py-2 font-semibold">{roasLabel}</td>
                  <td className="px-2 py-2">{cpaLabel}</td>
                  <td className="px-2 py-2 text-text3">{ranking.periodLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
