'use client';

import { useState } from 'react';
import { Card, CardContent } from '@tas/ui';

export interface GalleryItem {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly mediaType: 'image' | 'video';
  readonly subtitle?: string;
  readonly href?: string;
}

interface GalleryViewProps {
  readonly items: readonly GalleryItem[];
}

function GalleryCard({ item }: { item: GalleryItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Card className="overflow-hidden border-line bg-surface hover:shadow-md">
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
                  setImgError(true);
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
                setImgError(true);
              }}
            />
          )
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
      <CardContent className="p-3">
        <p className="truncate text-sm font-medium text-text">{item.name}</p>
        {item.subtitle && <p className="truncate text-xs text-text3">{item.subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export function GalleryView({ items }: GalleryViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text3">
        No items with attachments to display.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <GalleryCard key={item.id} item={item} />
      ))}
    </div>
  );
}
