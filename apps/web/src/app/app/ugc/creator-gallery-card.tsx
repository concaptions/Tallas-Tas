'use client';

import { useState } from 'react';
import { StatusChip } from '@tas/ui';

import { creatorInitials, creatorTracks, type CreatorCardRow } from './fields';

/** One asset thumbnail as the gallery card renders it. */
export interface CreatorAssetThumb {
  readonly url: string;
  readonly filename: string;
  readonly category: string;
}

interface CreatorGalleryCardProps {
  readonly creator: CreatorCardRow;
  /** The creator's assets, up to four shown as thumbnails. */
  readonly assets: readonly CreatorAssetThumb[];
  readonly onClick?: () => void;
  readonly selected?: boolean;
}

/**
 * The gallery card for one UGC creator (Task A enhancement): a richer card than the generic
 * `GalleryView` renders, purpose-built for the UGC roster's gallery mode.
 *
 * Sections, top to bottom:
 * 1. Profile: avatar, name, Instagram handle (linked when the value starts with `@` or is a URL).
 * 2. Partnership badge: Active/Expired based on `partnershipActivity` from the row.
 * 3. Media grid: 2x2 thumbnails from the first four assets linked to this creator.
 * 4. Status row: internal + client status via `StatusChip` (CLAUDE.md: no magic strings).
 * 5. Asset count badge.
 *
 * All styling uses token classes (`rounded-card`, `border-line`, `bg-surface`, `text-text`, etc.).
 * All status values come from `creatorTracks` which resolves through `@tas/domain/state`.
 */
export function CreatorGalleryCard({
  creator,
  assets,
  onClick,
  selected,
}: CreatorGalleryCardProps) {
  const tracks = creatorTracks(creator);
  const internalTrack = tracks.find((t) => t.key === 'internal');
  const clientTrack = tracks.find((t) => t.key === 'client');
  const thumbs = assets.slice(0, 4);
  const partnershipActive = creator.partnershipActivity === 'active';
  const partnershipEnded = creator.partnershipActivity === 'ended';

  const instagramHandle = creator.instagramUsername ?? null;
  const instagramHref =
    instagramHandle !== null && instagramHandle.trim() !== ''
      ? `https://instagram.com/${instagramHandle.replace(/^@/, '')}`
      : null;

  return (
    <article
      data-slot="creator-gallery-card"
      data-creator-id={creator.id}
      data-state={selected === true ? 'selected' : undefined}
      role={onClick !== undefined ? 'button' : undefined}
      tabIndex={onClick !== undefined ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick !== undefined
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4${onClick !== undefined ? ' cursor-pointer hover:border-line2 hover:shadow-md' : ''}${selected === true ? ' ring-2 ring-accent' : ''}`}
    >
      {/* 1. Profile section */}
      <div className="flex min-w-0 items-center gap-3">
        <CreatorGalleryAvatar creator={creator} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-sm font-semibold text-text" data-slot="creator-gallery-name">
            {creator.name}
          </h3>
          {instagramHandle !== null && instagramHandle.trim() !== '' ? (
            instagramHref !== null ? (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-xs text-text2 underline decoration-line hover:text-text"
                data-slot="creator-gallery-ig"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                {instagramHandle.startsWith('@') ? instagramHandle : `@${instagramHandle}`}
              </a>
            ) : (
              <span
                className="truncate font-mono text-xs text-text2"
                data-slot="creator-gallery-ig"
              >
                {instagramHandle.startsWith('@') ? instagramHandle : `@${instagramHandle}`}
              </span>
            )
          ) : null}
        </div>
      </div>

      {/* 2. Partnership status badge */}
      {partnershipActive || partnershipEnded ? (
        <div data-slot="creator-gallery-partnership">
          <StatusChip
            tone={partnershipActive ? 'ok' : 'bad'}
            label={partnershipActive ? 'Active' : 'Expired'}
          />
        </div>
      ) : null}

      {/* 3. Media grid: 2x2 thumbnails */}
      {thumbs.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-1 overflow-hidden rounded-input"
          data-slot="creator-gallery-media"
        >
          {thumbs.map((asset) => (
            <AssetThumb key={asset.url} asset={asset} />
          ))}
          {/* Fill remaining cells when fewer than 4 */}
          {thumbs.length < 4
            ? Array.from({ length: 4 - thumbs.length }).map((_, index) => (
                <div
                  key={`empty-${String(index)}`}
                  className="aspect-square bg-surface2"
                  aria-hidden="true"
                />
              ))
            : null}
        </div>
      ) : (
        <div
          className="flex aspect-[2/1] items-center justify-center rounded-input bg-surface2 text-xs text-text4"
          data-slot="creator-gallery-media-empty"
        >
          No assets
        </div>
      )}

      {/* 4. Status row: internal + client */}
      <div
        className="flex flex-wrap items-center gap-2 border-t border-line pt-2"
        data-slot="creator-gallery-statuses"
      >
        {internalTrack !== undefined ? (
          <span className="flex items-center gap-1">
            <span className="font-mono text-[10px] tracking-wide text-text3 uppercase">
              {internalTrack.label}
            </span>
            <StatusChip tone={internalTrack.tone} label={internalTrack.statusLabel} />
          </span>
        ) : null}
        {clientTrack !== undefined ? (
          <span className="flex items-center gap-1">
            <span className="font-mono text-[10px] tracking-wide text-text3 uppercase">
              {clientTrack.label}
            </span>
            <StatusChip tone={clientTrack.tone} label={clientTrack.statusLabel} />
          </span>
        ) : null}
      </div>

      {/* 5. Asset count badge */}
      {assets.length > 0 ? (
        <span
          className="self-start rounded-input bg-surface2 px-2 py-0.5 font-mono text-[11px] text-text3"
          data-slot="creator-gallery-asset-count"
        >
          {String(assets.length)} {assets.length === 1 ? 'asset' : 'assets'}
        </span>
      ) : null}
    </article>
  );
}

/** The avatar for the gallery card, falling back to initials when the picture is missing or dead. */
function CreatorGalleryAvatar({ creator }: { readonly creator: CreatorCardRow }) {
  const [failed, setFailed] = useState(false);
  if (creator.profilePicUrl === null || failed) {
    return (
      <span
        data-slot="creator-gallery-avatar"
        data-fallback="initials"
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-card border border-line bg-surface3 font-mono text-xs text-text3"
      >
        {creatorInitials(creator.name)}
      </span>
    );
  }
  return (
    <img
      data-slot="creator-gallery-avatar"
      src={creator.profilePicUrl}
      alt=""
      width={40}
      height={40}
      className="size-10 shrink-0 rounded-card border border-line bg-surface3 object-cover"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}

/** One thumbnail in the 2x2 grid: images render inline, videos show a play overlay. */
function AssetThumb({ asset }: { readonly asset: CreatorAssetThumb }) {
  const [failed, setFailed] = useState(false);
  const isVideo =
    asset.filename.endsWith('.mp4') ||
    asset.filename.endsWith('.mov') ||
    asset.filename.endsWith('.webm') ||
    asset.category === 'showcase_video' ||
    asset.category === 'raw_asset';

  if (failed) {
    return (
      <div className="flex aspect-square items-center justify-center bg-surface2 text-[10px] text-text4">
        {asset.filename.split('.').pop()?.toUpperCase() ?? '?'}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="relative aspect-square bg-surface2">
        <video
          src={asset.url}
          className="h-full w-full object-cover"
          muted
          preload="metadata"
          onError={() => {
            setFailed(true);
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg/60 text-text">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-0.5 h-3 w-3"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={asset.url}
      alt={asset.filename}
      className="aspect-square w-full object-cover"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
