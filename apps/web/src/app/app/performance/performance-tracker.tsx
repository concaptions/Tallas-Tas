'use client';

import { useMemo, useState } from 'react';
import type { AdMetricListRow } from '@tas/db';
import { DisabledWrite, Button } from '@tas/ui';

export interface MetricItem {
  readonly metric: AdMetricListRow;
  readonly spendLabel: string;
  readonly impressionsLabel: string;
  readonly clicksLabel: string;
  readonly conversionsLabel: string;
  readonly ctrLabel: string;
  readonly cpcLabel: string;
  readonly cpaLabel: string;
  readonly roasLabel: string;
}

type SortKey = 'spend' | 'impressions' | 'clicks' | 'conversions' | 'roas';

export function PerformanceTracker({
  items,
  demo,
}: {
  items: readonly MetricItem[];
  demo: boolean;
}) {
  const [sort, setSort] = useState<SortKey>('spend');
  const [search, setSearch] = useState('');
  const sorted = useMemo(() => {
    let r = [...items];
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((i) => i.metric.adName.toLowerCase().includes(q));
    r.sort((a, b) => Number(b.metric[sort] ?? 0) - Number(a.metric[sort] ?? 0));
    return r;
  }, [items, sort, search]);

  const totalSpend = items.reduce((s, i) => s + Number(i.metric.spend), 0);
  const totalConversions = items.reduce((s, i) => s + i.metric.conversions, 0);
  const avgRoas =
    items.length > 0 ? items.reduce((s, i) => s + Number(i.metric.roas ?? 0), 0) / items.length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text1">Performance Tracker</h1>
        <DisabledWrite active={demo}>
          <Button size="sm" disabled={demo}>
            Sync Meta
          </Button>
        </DisabledWrite>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Total Spend',
            value: `$${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          },
          { label: 'Total Conversions', value: totalConversions.toLocaleString('en-US') },
          { label: 'Avg ROAS', value: `${avgRoas.toFixed(1)}x` },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-card border border-line bg-surface p-3 text-center"
          >
            <p className="text-xs text-text3">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-text1">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(['spend', 'impressions', 'clicks', 'conversions', 'roas'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setSort(k);
            }}
            className={`rounded-input px-3 py-1 text-xs capitalize ${sort === k ? 'bg-accent text-white' : 'bg-surface-alt text-text2'}`}
          >
            {k}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search ads..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
        className="rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-text1 placeholder:text-text4"
      />
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">No performance data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-text3">
                <th className="px-2 py-2">Ad</th>
                <th className="px-2 py-2">Spend</th>
                <th className="px-2 py-2">Impr.</th>
                <th className="px-2 py-2">Clicks</th>
                <th className="px-2 py-2">Conv.</th>
                <th className="px-2 py-2">CTR</th>
                <th className="px-2 py-2">CPC</th>
                <th className="px-2 py-2">CPA</th>
                <th className="px-2 py-2">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(
                ({
                  metric,
                  spendLabel,
                  impressionsLabel,
                  clicksLabel,
                  conversionsLabel,
                  ctrLabel,
                  cpcLabel,
                  cpaLabel,
                  roasLabel,
                }) => (
                  <tr key={metric.id} className="border-b border-line last:border-0">
                    <td className="truncate px-2 py-2 font-mono text-text1">{metric.adName}</td>
                    <td className="px-2 py-2">{spendLabel}</td>
                    <td className="px-2 py-2">{impressionsLabel}</td>
                    <td className="px-2 py-2">{clicksLabel}</td>
                    <td className="px-2 py-2">{conversionsLabel}</td>
                    <td className="px-2 py-2">{ctrLabel}</td>
                    <td className="px-2 py-2">{cpcLabel}</td>
                    <td className="px-2 py-2">{cpaLabel}</td>
                    <td className="px-2 py-2 font-semibold">{roasLabel}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
