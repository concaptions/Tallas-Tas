'use client';

import { useMemo, useState } from 'react';
import type { AdPlatform, CompetitorAdListRow } from '@tas/db';
import { Button, DisabledWrite } from '@tas/ui';

export interface AdSpyItem {
  readonly ad: CompetitorAdListRow;
  readonly daysLabel: string;
}

const PL: Record<AdPlatform, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  google: 'Google',
};

export function AdSpyBoard({
  items,
  demo,
  platforms,
}: {
  items: readonly AdSpyItem[];
  demo: boolean;
  platforms: readonly AdPlatform[];
}) {
  const [filter, setFilter] = useState<AdPlatform | 'all'>('all');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    let r = [...items];
    if (filter !== 'all') r = r.filter((i) => i.ad.platform === filter);
    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter(
        (i) =>
          i.ad.advertiserName.toLowerCase().includes(q) ||
          (i.ad.headline?.toLowerCase().includes(q) ?? false),
      );
    return r;
  }, [items, filter, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text1">Ad Spy</h1>
        <DisabledWrite active={demo}>
          <Button size="sm" disabled={demo}>
            Add Competitor
          </Button>
        </DisabledWrite>
      </div>
      <div className="flex flex-wrap gap-2">
        {['all' as const, ...platforms].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setFilter(k);
            }}
            className={`rounded-input px-3 py-1 text-xs ${filter === k ? 'bg-accent text-white' : 'bg-surface-alt text-text2'}`}
          >
            {k === 'all' ? 'All' : PL[k]} (
            {k === 'all' ? items.length : items.filter((i) => i.ad.platform === k).length})
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search advertisers..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
        className="rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-text1 placeholder:text-text4"
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">No competitor ads tracked yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ ad, daysLabel }) => (
            <div
              key={ad.id}
              className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-text1">{ad.advertiserName}</span>
                <span className="rounded-input bg-surface-alt px-2 py-0.5 text-[10px] text-text3 uppercase">
                  {PL[ad.platform as AdPlatform]}
                </span>
              </div>
              {ad.headline !== null && <p className="text-sm text-text2">{ad.headline}</p>}
              {ad.bodyText !== null && (
                <p className="line-clamp-2 text-xs text-text3">{ad.bodyText}</p>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-text3">
                <span className="rounded-input bg-surface-alt px-1.5 py-0.5">{ad.format}</span>
                {ad.estimatedSpend !== null && <span>{ad.estimatedSpend}</span>}
                <span>{daysLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
