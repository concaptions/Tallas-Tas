import { describe, expect, it } from 'vitest';

import {
  angleCountLabel,
  CREATIVE_MODULE_FIELDS,
  designCountLabel,
  hostLabel,
  linkCountTone,
} from './fields';

describe('CREATIVE_MODULE_FIELDS', () => {
  it('is the two typed Airtable columns, in panel order', () => {
    expect(CREATIVE_MODULE_FIELDS.map((field) => field.name)).toEqual([
      'moduleName',
      'foreplayLink',
    ]);
  });

  it('marks the module name required and the Foreplay link optional', () => {
    expect(CREATIVE_MODULE_FIELDS.map((field) => field.required)).toEqual([true, false]);
  });
});

describe('hostLabel', () => {
  it('shortens a Foreplay board URL to its host', () => {
    expect(hostLabel('https://app.foreplay.co/board/niagara-problem-solution-hooks')).toBe(
      'app.foreplay.co',
    );
  });

  it('drops a www prefix so two links of one brand read the same', () => {
    expect(hostLabel('https://www.foreplay.co/board/x')).toBe('foreplay.co');
  });

  it('returns null for an absent link, so the cell renders the em dash', () => {
    expect(hostLabel(null)).toBeNull();
    expect(hostLabel('   ')).toBeNull();
  });

  it('returns an unparseable value untouched instead of hiding it', () => {
    expect(hostLabel('foreplay board')).toBe('foreplay board');
  });
});

describe('link count labels', () => {
  it('render zero as a number, never a blank or a dash', () => {
    expect(angleCountLabel(0)).toBe('0 angles');
    expect(designCountLabel(0)).toBe('0 designs');
  });

  it('are singular at one and plural above', () => {
    expect(angleCountLabel(1)).toBe('1 angle');
    expect(angleCountLabel(2)).toBe('2 angles');
    expect(designCountLabel(1)).toBe('1 design');
    expect(designCountLabel(3)).toBe('3 designs');
  });
});

describe('linkCountTone', () => {
  it('is muted at zero and info above it', () => {
    expect(linkCountTone(0)).toBe('mute');
    expect(linkCountTone(1)).toBe('info');
  });
});
