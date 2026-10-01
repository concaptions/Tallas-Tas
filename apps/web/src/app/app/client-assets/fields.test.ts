import { describe, expect, it } from 'vitest';

import { CLIENT_ASSET_FOLDER_FIELDS, designCountLabel, hostLabel, linkCountTone } from './fields';

describe('CLIENT_ASSET_FOLDER_FIELDS', () => {
  it('is the three typed Airtable columns, in panel order', () => {
    expect(CLIENT_ASSET_FOLDER_FIELDS.map((field) => field.name)).toEqual([
      'name',
      'description',
      'locationUrl',
    ]);
  });

  it('marks the folder name required and the description and location optional', () => {
    expect(CLIENT_ASSET_FOLDER_FIELDS.map((field) => field.required)).toEqual([true, false, false]);
  });

  it('renders the description as a text area and the other two as inputs', () => {
    expect(CLIENT_ASSET_FOLDER_FIELDS.map((field) => field.control)).toEqual([
      'input',
      'textarea',
      'input',
    ]);
  });
});

describe('hostLabel', () => {
  it('shortens a Drive share URL to its host', () => {
    expect(hostLabel('https://drive.google.com/drive/folders/1NiagaraSleepBrandKit2026')).toBe(
      'drive.google.com',
    );
  });

  it('drops a www prefix so two links of one brand read the same', () => {
    expect(hostLabel('https://www.dropbox.com/sh/niagara-blanket-photography-2026')).toBe(
      'dropbox.com',
    );
  });

  it('returns null for an absent location, so the cell renders the em dash', () => {
    expect(hostLabel(null)).toBeNull();
    expect(hostLabel('   ')).toBeNull();
  });

  it('returns an unparseable value untouched instead of hiding it', () => {
    expect(hostLabel('shared drive, ask Marguerite')).toBe('shared drive, ask Marguerite');
  });
});

describe('designCountLabel', () => {
  it('renders zero as a number, never a blank or a dash', () => {
    expect(designCountLabel(0)).toBe('0 designs');
  });

  it('is singular at one and plural above', () => {
    expect(designCountLabel(1)).toBe('1 design');
    expect(designCountLabel(2)).toBe('2 designs');
  });
});

describe('linkCountTone', () => {
  it('is muted at zero and info above it', () => {
    expect(linkCountTone(0)).toBe('mute');
    expect(linkCountTone(1)).toBe('info');
  });
});
