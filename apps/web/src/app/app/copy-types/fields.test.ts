import { describe, expect, it } from 'vitest';

import {
  COPY_TYPE_FIELDS,
  DESCRIPTION_PREVIEW_LENGTH,
  descriptionPreview,
  linkCountTone,
  linkedCopyLabel,
  metaCopyCountLabel,
  youtubeCopyCountLabel,
} from './fields';

describe('COPY_TYPE_FIELDS', () => {
  it('is the two Airtable columns, in panel order', () => {
    expect(COPY_TYPE_FIELDS.map((field) => field.name)).toEqual(['name', 'description']);
  });

  it('marks the name required and the description optional', () => {
    expect(COPY_TYPE_FIELDS.map((field) => field.required)).toEqual([true, false]);
  });

  it('gives the multiline description a textarea and the name a single-line input', () => {
    expect(COPY_TYPE_FIELDS.map((field) => field.kind)).toEqual(['input', 'textarea']);
  });
});

describe('linkedCopyLabel', () => {
  it('names a copy by its headline when it has one', () => {
    expect(
      linkedCopyLabel({
        id: 'copy-1',
        copyNumber: 1,
        headline: 'Your Rota Is Broken. You Are Not.',
      }),
    ).toEqual({ id: 'copy-1', label: 'Your Rota Is Broken. You Are Not.', generated: false });
  });

  it('falls back to the auto-generated Copy # title, flagged as generated, when there is no headline', () => {
    expect(linkedCopyLabel({ id: 'copy-4', copyNumber: 4, headline: null })).toEqual({
      id: 'copy-4',
      label: 'Copy #4',
      generated: true,
    });
  });

  it('treats a whitespace-only headline as absent rather than listing a blank', () => {
    expect(linkedCopyLabel({ id: 'copy-2', copyNumber: 2, headline: '   ' })).toEqual({
      id: 'copy-2',
      label: 'Copy #2',
      generated: true,
    });
  });

  it('trims a headline so the list never shows stray whitespace', () => {
    expect(linkedCopyLabel({ id: 'c', copyNumber: 3, headline: '  Blocks 186 lux.  ' }).label).toBe(
      'Blocks 186 lux.',
    );
  });
});

describe('descriptionPreview', () => {
  it('returns a short description untouched', () => {
    expect(descriptionPreview('Price, bundle and deadline up front.')).toBe(
      'Price, bundle and deadline up front.',
    );
  });

  it('keeps only the first line of a multiline description', () => {
    expect(descriptionPreview('First line.\nSecond line.')).toBe('First line.');
    expect(descriptionPreview('First line.\r\nSecond line.')).toBe('First line.');
  });

  it('shortens a long first line to the preview length with an ellipsis', () => {
    const long = 'a'.repeat(DESCRIPTION_PREVIEW_LENGTH + 20);
    const preview = descriptionPreview(long);
    expect(preview).toHaveLength(DESCRIPTION_PREVIEW_LENGTH);
    expect(preview?.endsWith('…')).toBe(true);
  });

  it('does not shorten a line exactly at the preview length', () => {
    const exact = 'b'.repeat(DESCRIPTION_PREVIEW_LENGTH);
    expect(descriptionPreview(exact)).toBe(exact);
  });

  it('returns null for an absent, empty or whitespace-only description, so the cell renders the dash', () => {
    expect(descriptionPreview(null)).toBeNull();
    expect(descriptionPreview('')).toBeNull();
    expect(descriptionPreview('   \n  ')).toBeNull();
  });
});

describe('count labels', () => {
  it('render zero as a number, never a blank or a dash', () => {
    expect(metaCopyCountLabel(0)).toBe('0 Meta copies');
    expect(youtubeCopyCountLabel(0)).toBe('0 YouTube copies');
  });

  it('are singular at one', () => {
    expect(metaCopyCountLabel(1)).toBe('1 Meta copy');
    expect(youtubeCopyCountLabel(1)).toBe('1 YouTube copy');
  });

  it('are plural above one', () => {
    expect(metaCopyCountLabel(3)).toBe('3 Meta copies');
    expect(youtubeCopyCountLabel(2)).toBe('2 YouTube copies');
  });
});

describe('linkCountTone', () => {
  it('is muted at zero and info above it', () => {
    expect(linkCountTone(0)).toBe('mute');
    expect(linkCountTone(1)).toBe('info');
  });
});
