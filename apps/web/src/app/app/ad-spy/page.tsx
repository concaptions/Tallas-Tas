import { adPlatforms } from '@tas/db';

import { isDemoMode } from '@/lib/demo-mode';
import { loadCompetitorAds } from '@/lib/ad-spy-source';

import { AdSpyBoard, type AdSpyItem } from './ad-spy-board';

export default async function AdSpyPage() {
  const { rows } = await loadCompetitorAds();
  const demo = isDemoMode();
  const items: AdSpyItem[] = rows.map((row) => ({
    ad: row,
    daysLabel: row.daysActive !== null ? `${String(row.daysActive)}d active` : '—',
  }));
  return <AdSpyBoard items={items} demo={demo} platforms={adPlatforms} />;
}
