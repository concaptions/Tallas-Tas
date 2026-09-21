import { notFound } from 'next/navigation';
import { adPlatforms } from '@tas/db';

import { loadCompetitorAdById } from '@/lib/ad-spy-source';
import { isDemoMode } from '@/lib/demo-mode';

import { CompetitorAdDetail, type CompetitorAdValues } from './competitor-ad-detail';

interface AdPageProps {
  readonly params: Promise<{ adId: string }>;
}

export default async function AdPage({ params }: AdPageProps) {
  const { adId } = await params;
  const demo = isDemoMode();
  const creating = adId === 'new';

  const { ad } = creating ? { ad: null } : await loadCompetitorAdById(adId);
  if (!creating && ad === null) notFound();

  const values: CompetitorAdValues | null =
    ad === null
      ? null
      : {
          id: ad.id,
          platform: ad.platform,
          advertiserName: ad.advertiserName,
          adUrl: ad.adUrl,
          headline: ad.headline,
          bodyText: ad.bodyText,
          format: ad.format,
          estimatedSpend: ad.estimatedSpend,
          daysActive: ad.daysActive,
          firstSeen: ad.firstSeen,
          lastSeen: ad.lastSeen,
          notes: ad.notes,
        };

  return <CompetitorAdDetail ad={values} demo={demo} platforms={[...adPlatforms]} />;
}
