'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AssetCategory, AssetListRow } from '@tas/db';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DisabledWrite,
} from '@tas/ui';

import { AssetUploadModal } from '@/components/assets/upload-modal';
import { assetPath } from '@/lib/routes';

import { deleteAssetAction } from './actions';

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
  showcase_video: 'Showcase video',
};

export function AssetLibrary({
  items,
  demo,
  categories,
  brandId,
  canDelete = false,
}: {
  items: readonly AssetItem[];
  demo: boolean;
  categories: readonly AssetCategory[];
  brandId: string | null;
  canDelete?: boolean;
}) {
  const [filter, setFilter] = useState<AssetCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

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

  const uploadDisabled = demo || brandId === null;

  const confirmDelete = () => {
    if (deleteTarget === null) return;
    const id = deleteTarget.asset.id;
    const data = new FormData();
    data.append('id', id);
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteAssetAction(null, data);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">Asset Library</h1>
        <DisabledWrite active={uploadDisabled}>
          <Button
            size="sm"
            data-slot="asset-upload-button"
            onClick={() => {
              if (!uploadDisabled) setUploadOpen(true);
            }}
            disabled={uploadDisabled}
          >
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
        className="rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text4"
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">
          {items.length === 0 ? 'No assets uploaded yet.' : 'No assets match the current filter.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const { asset, updatedLabel, updatedTitle, sizeLabel } = item;
            const downloadHref = `/api/assets/${encodeURIComponent(asset.id)}`;
            const isImage = asset.contentType.startsWith('image/');
            return (
              <article
                key={asset.id}
                data-slot="asset-card"
                className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3 transition-colors hover:border-line2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xl leading-none" aria-hidden="true">
                    {asset.contentType.startsWith('video/')
                      ? '▶'
                      : asset.contentType === 'application/pdf'
                        ? '📄'
                        : '▣'}
                  </span>
                  <span className="rounded-input bg-surface-alt px-2 py-0.5 text-[10px] uppercase text-text3">
                    {L[asset.category]}
                  </span>
                </div>
                {isImage ? (
                  <Image
                    src={downloadHref}
                    alt={asset.filename}
                    width={320}
                    height={180}
                    unoptimized
                    className="h-32 w-full rounded-input object-cover"
                  />
                ) : null}
                <Link
                  href={assetPath(asset.id)}
                  className="truncate font-mono text-sm text-text hover:underline"
                >
                  {asset.filename}
                </Link>
                {asset.caption !== null && (
                  <p className="line-clamp-2 text-xs text-text2">{asset.caption}</p>
                )}
                <div className="mt-auto flex items-center justify-between text-[11px] text-text3">
                  <span>{sizeLabel}</span>
                  <time title={updatedTitle}>{updatedLabel}</time>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={downloadHref}
                      data-slot="asset-download"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  </Button>
                  {canDelete ? (
                    <DisabledWrite active={demo}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-slot="asset-delete"
                        disabled={demo || pending}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(item);
                        }}
                      >
                        Delete
                      </Button>
                    </DisabledWrite>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Upload modal: never rendered when the brand is unresolved (new workspaces with no brand). */}
      {brandId !== null && (
        <AssetUploadModal
          brandId={brandId}
          categories={categories}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
        />
      )}

      {/* Delete confirmation. Lives in this component to keep the row's data close to the action. */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent data-slot="asset-delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete this asset?</DialogTitle>
            <DialogDescription>
              {deleteTarget === null
                ? ''
                : `${deleteTarget.asset.filename} will be removed from the library.`}
            </DialogDescription>
          </DialogHeader>
          {deleteError !== null && (
            <p
              data-slot="asset-delete-error"
              className="rounded-input bg-surface3 px-3 py-2 text-sm text-text2"
            >
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              data-slot="asset-delete-confirm"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
