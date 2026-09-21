import { isDemoMode } from '@/lib/demo-mode';
import { loadPerformance } from '@/lib/performance-source';

import { PerformanceTracker, type MetricItem } from './performance-tracker';

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function currency(v: string): string {
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function PerformancePage() {
  const { rows } = await loadPerformance();
  const demo = isDemoMode();
  const items: MetricItem[] = rows.map((row) => ({
    metric: row,
    spendLabel: currency(row.spend),
    impressionsLabel: fmt(row.impressions),
    clicksLabel: fmt(row.clicks),
    conversionsLabel: fmt(row.conversions),
    ctrLabel: row.ctr !== null ? `${(Number(row.ctr) * 100).toFixed(1)}%` : '—',
    cpcLabel: row.cpc !== null ? currency(row.cpc) : '—',
    cpaLabel: row.cpa !== null ? currency(row.cpa) : '—',
    roasLabel: row.roas !== null ? `${Number(row.roas).toFixed(1)}x` : '—',
  }));
  return <PerformanceTracker items={items} demo={demo} />;
}
