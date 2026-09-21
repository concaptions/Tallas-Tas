import { notFound } from 'next/navigation';

import { isDemoMode } from '@/lib/demo-mode';
import { loadAdMetricById } from '@/lib/performance-source';

import { MetricDetail, type MetricValues } from './metric-detail';

interface MetricPageProps {
  readonly params: Promise<{ metricId: string }>;
}

export default async function MetricPage({ params }: MetricPageProps) {
  const { metricId } = await params;
  const demo = isDemoMode();
  const creating = metricId === 'new';

  const { metric } = creating ? { metric: null } : await loadAdMetricById(metricId);
  if (!creating && metric === null) notFound();

  const values: MetricValues | null =
    metric === null
      ? null
      : {
          id: metric.id,
          adName: metric.adName,
          metaAdId: metric.metaAdId,
          briefId: metric.briefId,
          conceptId: metric.conceptId,
          spend: metric.spend,
          impressions: metric.impressions,
          clicks: metric.clicks,
          conversions: metric.conversions,
          ctr: metric.ctr,
          cpc: metric.cpc,
          cpa: metric.cpa,
          roas: metric.roas,
          dateRange: metric.dateRange,
        };

  return <MetricDetail metric={values} demo={demo} />;
}
