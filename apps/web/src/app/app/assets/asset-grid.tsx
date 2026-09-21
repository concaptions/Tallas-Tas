'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AssetCategory, AssetListRow } from '@tas/db';
import { Button, DisabledWrite } from '@tas/ui';

import { assetPath } from '@/lib/routes';

export interface AssetItem {
  readonly asset: AssetListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
  readonly sizeLabel: string;
}

const L: Record<AssetCategory, string> = {
  reference: 'Reference',
  broll: 'B-Roll',
  raw_asset: 'Raw Assets',
  mood_board: 'Mood Board',
};

export function AssetLibrary({
  items,
  demo,
  categories,
}: {
  items: readonly AssetItem[];
  demo: boolean;
  categories: readonly AssetCategory[];
}) {
  const [filter, setFilter] = useState<AssetCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    let r = items;
    if (filter !== 'all') r = r.filter((i) => i.asset.category === filter);
    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter(
        (i) =>
          i.asset.filename.toLowerCase().includes(q) ||
          (i.asset.caption?.toLowerCase().includes(q) ?? false),
      );
    return r;
  }, [items, filter, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text1">Asset Library</h1>
        <DisabledWrite active={demo}>
          <Button size="sm" disabled={demo}>
            Upload
          </Button>
        </DisabledWrite>
      </div>
      <div className="flex flex-wrap gap-2">
        {['all' as const, ...categories].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setFilter(k);
            }}
            className={`rounded-input px-3 py-1 text-xs ${filter === k ? 'bg-accent text-white' : 'bg-surface-alt text-text2'}`}
          >
            {k === 'all' ? 'All' : L[k]} (
            {k === 'all' ? items.length : items.filter((i) => i.asset.category === k).length})
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search files..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
        className="rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-text1 placeholder:text-text4"
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">
          {items.length === 0 ? 'No assets uploaded yet.' : 'No assets match the current filter.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ asset, updatedLabel, updatedTitle, sizeLabel }) => (
            <Link
              key={asset.id}
              href={assetPath(asset.id)}
              className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3 transition-colors hover:border-line2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xl leading-none">
                  {asset.contentType.startsWith('video/') ? '▶' : '▣'}
                </span>
                <span className="rounded-input bg-surface-alt px-2 py-0.5 text-[10px] text-text3 uppercase">
                  {L[asset.category]}
                </span>
              </div>
              <p className="truncate font-mono text-sm text-text1">{asset.filename}</p>
              {asset.caption !== null && (
                <p className="line-clamp-2 text-xs text-text2">{asset.caption}</p>
              )}
              <div className="mt-auto flex items-center justify-between text-[11px] text-text3">
                <span>{sizeLabel}</span>
                <time title={updatedTitle}>{updatedLabel}</time>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
