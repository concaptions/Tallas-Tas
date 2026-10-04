'use client';

import { useState, type ReactNode } from 'react';
import type { ChipTone } from '@tas/domain/state';
import { Card, CardContent, cn } from '@tas/ui';

/** One labelled line under a gallery card's name; the Fields popover shows or hides it by key. */
export interface GalleryField {
  readonly key: string;
  readonly label: string;
  readonly value: ReactNode;
}

export interface GalleryItem {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly mediaType: 'image' | 'video';
  readonly subtitle?: string;
  readonly href?: string;
  /** The tile a record with no picture shows: its initial on a coloured ground (never a broken image). */
  readonly initial?: string;
  readonly initialTone?: ChipTone;
  /** The card's labelled lines, in the table's column order. */
  readonly fields?: readonly GalleryField[];
}

interface GalleryViewProps {
  readonly items: readonly GalleryItem[];
  /** The field keys to show under each name; `null` or absent shows every field the item carries. */
  readonly visibleFields?: readonly string[] | null;
  readonly onItemClick?: (item: GalleryItem) => void;
  readonly selectedId?: string | null;
  readonly empty?: ReactNode;
  /** `data-slot` for each card (default `gallery-card`), so a page keeps its own test hooks. */
  readonly cardSlot?: string;
}

/** The initial tile's ground per tone, through the token layer only. */
const INITIAL_TILE: Record<ChipTone, string> = {
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  info: 'bg-info/15 text-info',
  accent: 'bg-accent-soft text-accent',
  mute: 'bg-surface3 text-text3',
};

/** A stable tone for a name, so the same record is the same colour on every visit. */
export function initialTone(name: string): ChipTone {
  const tones: readonly ChipTone[] = ['accent', 'info', 'ok', 'warn', 'mute'];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2_147_483_647;
  return tones[hash % tones.length] ?? 'mute';
}

interface GalleryCardProps {
  readonly item: GalleryItem;
  readonly visibleFields: readonly string[] | null;
  readonly onClick?: () => void;
  readonly selected: boolean;
  readonly slot: string;
}

function GalleryCard({ item, visibleFields, onClick, selected, slot }: GalleryCardProps) {
  /**
   * WHICH url failed, not WHETHER one failed. The cover is a choice now (action item 16), so one
   * card renders different URLs over its life: pick the Video Intro, watch it fail to decode, pick
   * "Page default" back — and a boolean set by that failure would still be true, leaving the card
   * on its initials while holding a profile picture that loads fine. Keying the error by the URL it
   * belongs to gives every newly chosen cover its own chance and still never retries the one that
   * actually failed.
   */
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imgError = item.imageUrl !== null && failedUrl === item.imageUrl;
  const fields = (item.fields ?? []).filter(
    (field) => visibleFields === null || visibleFields.includes(field.key),
  );
  const clickable = onClick !== undefined;

  return (
    <Card
      data-slot={slot}
      data-gallery-id={item.id}
      data-state={selected ? 'selected' : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? item.name : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'overflow-hidden border-line bg-surface hover:shadow-md',
        clickable && 'cursor-pointer',
        selected && 'ring-2 ring-accent',
      )}
    >
      <div className="relative aspect-square bg-surface2">
        {item.imageUrl && !imgError ? (
          item.mediaType === 'video' ? (
            <div className="relative h-full w-full">
              <video
                src={item.imageUrl}
                className="h-full w-full object-cover"
                muted
                preload="metadata"
                onError={() => {
                  setFailedUrl(item.imageUrl);
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg/70 text-text">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="ml-1 h-6 w-6"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
              onError={() => {
                setFailedUrl(item.imageUrl);
              }}
            />
          )
        ) : item.initial !== undefined ? (
          <div
            data-slot="gallery-initial"
            aria-hidden="true"
            className={cn(
              'flex h-full w-full items-center justify-center font-mono text-4xl font-semibold',
              INITIAL_TILE[item.initialTone ?? 'mute'],
            )}
          >
            {item.initial}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-10 w-10"
              aria-hidden="true"
            >
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <CardContent className="flex flex-col gap-1 p-3">
        <p className="truncate text-sm font-medium text-text" data-slot="gallery-name">
          {item.name}
        </p>
        {item.subtitle && <p className="truncate text-xs text-text3">{item.subtitle}</p>}
        {fields.length === 0 ? null : (
          <dl className="flex flex-col gap-1 border-t border-line pt-2" data-slot="gallery-fields">
            {fields.map((field) => (
              <div
                key={field.key}
                className="flex min-w-0 flex-col"
                data-slot="gallery-field"
                data-field={field.key}
              >
                <dt className="font-mono text-[10px] tracking-wide text-text3 uppercase">
                  {field.label}
                </dt>
                <dd className="min-w-0 truncate text-xs text-text2">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export function GalleryView({
  items,
  visibleFields = null,
  onItemClick,
  selectedId = null,
  empty,
  cardSlot = 'gallery-card',
}: GalleryViewProps) {
  if (items.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12 text-sm text-text3"
        data-slot="gallery-empty"
      >
        {empty ?? 'Nothing to show yet.'}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      data-slot="gallery-view"
    >
      {items.map((item) => (
        <GalleryCard
          key={item.id}
          item={item}
          visibleFields={visibleFields}
          selected={item.id === selectedId}
          slot={cardSlot}
          onClick={
            onItemClick === undefined
              ? undefined
              : () => {
                  onItemClick(item);
                }
          }
        />
      ))}
    </div>
  );
}
