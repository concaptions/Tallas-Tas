import { describe, expect, it } from 'vitest';
import type { GalleryFieldOption } from '@tas/domain';

import type { GridColumn } from './airtable-grid';
import { coverFieldOptions, galleryItemsFrom } from './gallery-items';
import type { ResolvedColumnView } from './resolved-columns';

interface Creator {
  readonly id: string;
  readonly name: string;
  readonly pic: string | null;
  readonly video: string | null;
}

const COLUMNS: readonly GridColumn<Creator>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'gender', header: 'Gender', render: () => 'Female' },
];

const ROWS: readonly Creator[] = [
  { id: 'c1', name: 'Danielle', pic: 'https://cdn/pic.jpg', video: 'https://cdn/intro.mp4' },
  { id: 'c2', name: 'Marcus', pic: 'https://cdn/marcus.jpg', video: null },
];

const identity = (row: Creator) => ({
  id: row.id,
  name: row.name,
  imageUrl: row.pic,
  covers: {
    profile_pic_url: { url: row.pic, mediaType: 'image' as const },
    video_intro_url: { url: row.video, mediaType: 'video' as const },
  },
});

const GALLERY_FIELDS: readonly GalleryFieldOption[] = [
  { field: 'profile_pic_url', label: "Creator's Profile Pic", mediaType: 'image' },
  { field: 'video_intro_url', label: "Creator's Video Intro", mediaType: 'video' },
];

const resolved = (...entries: [string, string, number][]): ResolvedColumnView[] =>
  entries.map(([columnKey, displayLabel, displayOrder]) => ({
    columnKey,
    displayLabel,
    displayOrder,
  }));

describe('coverFieldOptions', () => {
  it('offers the media columns the brand resolves, under the brand’s own labels', () => {
    // The relabel is the point: a brand that calls the column something else must see its own word,
    // which is why the LABEL comes from the resolver and the registry's label is only a fallback.
    expect(
      coverFieldOptions(
        resolved(
          ['name', 'Name', 1],
          ['video_intro_url', "Creator's video Intro", 11],
          ['profile_pic_url', 'Headshot', 16],
        ),
        GALLERY_FIELDS,
      ),
    ).toEqual([
      { key: 'video_intro_url', label: "Creator's video Intro" },
      { key: 'profile_pic_url', label: 'Headshot' },
    ]);
  });

  it('leaves out a media column this brand does not resolve', () => {
    expect(
      coverFieldOptions(resolved(['profile_pic_url', 'Profile Pic', 16]), GALLERY_FIELDS),
    ).toEqual([{ key: 'profile_pic_url', label: 'Profile Pic' }]);
  });

  it('is empty for a table that declares no media column, so no picker renders', () => {
    expect(coverFieldOptions(resolved(['name', 'Name', 1]), [])).toEqual([]);
  });

  it('never offers a non-media column, however it is ordered', () => {
    const options = coverFieldOptions(
      resolved(['name', 'Name', 1], ['gender', 'Gender', 2]),
      GALLERY_FIELDS,
    );
    expect(options).toEqual([]);
  });
});

describe('galleryItemsFrom cover selection', () => {
  it('covers with the page default when no choice is recorded', () => {
    const items = galleryItemsFrom(ROWS, COLUMNS, identity);
    expect(items.map((item) => item.imageUrl)).toEqual([
      'https://cdn/pic.jpg',
      'https://cdn/marcus.jpg',
    ]);
    expect(items[0]?.mediaType).toBe('image');
  });

  it('covers with the chosen column, carrying its media type', () => {
    const items = galleryItemsFrom(ROWS, COLUMNS, identity, { coverField: 'video_intro_url' });
    expect(items[0]?.imageUrl).toBe('https://cdn/intro.mp4');
    expect(items[0]?.mediaType).toBe('video');
  });

  it('falls back to the page default for a row with no value in the chosen column', () => {
    // Marcus has no video intro. A table-wide setting must not cost him the cover he has — the
    // alternative is a card that goes blank because of a choice made about a different record.
    const items = galleryItemsFrom(ROWS, COLUMNS, identity, { coverField: 'video_intro_url' });
    expect(items[1]?.imageUrl).toBe('https://cdn/marcus.jpg');
    expect(items[1]?.mediaType).toBe('image');
  });

  it('ignores a chosen column the row does not carry rather than blanking the card', () => {
    const items = galleryItemsFrom(ROWS, COLUMNS, identity, { coverField: 'gone' });
    expect(items[0]?.imageUrl).toBe('https://cdn/pic.jpg');
  });

  it('still falls through to the initial tile when nothing has a picture', () => {
    const items = galleryItemsFrom(
      [{ id: 'c3', name: 'ada', pic: null, video: null }],
      COLUMNS,
      identity,
      { coverField: 'profile_pic_url' },
    );
    expect(items[0]?.imageUrl).toBeNull();
    expect(items[0]?.initial).toBe('A');
  });

  it('keeps the card lines as the columns minus the name, whatever the cover is', () => {
    const items = galleryItemsFrom(ROWS, COLUMNS, identity, { coverField: 'video_intro_url' });
    expect(items[0]?.fields?.map((field) => field.key)).toEqual(['gender']);
  });
});
