'use client';

import { useState } from 'react';

import { CoverMenu, GalleryView, galleryItemsFrom } from '@/components/views';
import type { GridColumn } from '@/components/views/airtable-grid';

/**
 * The Cover popover (action item 16, "customise the card"), and what choosing a cover does. UI
 * governance rule 4.
 *
 * Only a table with more than one media column has a real choice to make — on the platform today
 * that is UGC Management, whose creators declare a Profile Pic and a Video Intro. The story stands
 * in for it with two covers and one record that has only the first, because the interesting case is
 * the fallback: a table-wide choice must not blank the card of a record that has no value for the
 * column chosen.
 */
const COVER_FIELDS = [
  { key: 'profile_pic_url', label: "Creator's Profile Pic" },
  { key: 'video_intro_url', label: "Creator's Video Intro" },
];

interface CoverRow {
  readonly id: string;
  readonly name: string;
  readonly pic: string | null;
  readonly video: string | null;
}

/**
 * Two stand-in covers as inline SVG, so the story renders what it claims to without reaching the
 * network from `/design-system`. Both are declared `image` even though the real second column is a
 * video: a data URI cannot play, and a cover that silently fails would make the story lie about the
 * control. The colours are token values, not invented hexes.
 */
const tile = (label: string, fill: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${fill}"/><text x="160" y="108" font-family="monospace" font-size="20" fill="white" text-anchor="middle">${label}</text></svg>`,
  )}`;

const COVER_ROWS: readonly CoverRow[] = [
  {
    id: 'c1',
    name: 'Danielle Okonkwo',
    pic: tile('profile pic', 'oklch(0.45 0.12 250)'),
    video: tile('video intro', 'oklch(0.45 0.14 10)'),
  },
  // No video intro: the record that proves the fallback. Choosing "Video Intro" must leave this
  // card on its profile picture rather than blanking it.
  { id: 'c2', name: 'Marcus Webb', pic: tile('profile pic', 'oklch(0.45 0.10 150)'), video: null },
];

const COVER_COLUMNS: readonly GridColumn<CoverRow>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'platform', header: 'Platform', render: () => 'Insense' },
];

export function CoverMenuStory() {
  const [coverField, setCoverField] = useState<string | null>(null);
  const items = galleryItemsFrom(
    COVER_ROWS,
    COVER_COLUMNS,
    (row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.pic,
      subtitle: 'Female · 25–34',
      covers: {
        profile_pic_url: { url: row.pic, mediaType: 'image' },
        video_intro_url: { url: row.video, mediaType: 'image' },
      },
    }),
    { coverField },
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <CoverMenu fields={COVER_FIELDS} coverField={coverField} onCoverChange={setCoverField} />
        <p className="text-sm text-text2">
          Cover:{' '}
          <span className="font-mono text-text3">
            {coverField ?? 'page default (profile picture)'}
          </span>
        </p>
      </div>
      <GalleryView items={items} visibleFields={null} />
    </div>
  );
}
