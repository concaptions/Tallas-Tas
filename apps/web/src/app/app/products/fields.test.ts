import { describe, expect, it } from 'vitest';

import { conceptCountLabel, conceptCountTone, hostLabel, PRODUCT_FIELDS } from './fields';

describe('PRODUCT_FIELDS', () => {
  it('is the three PRD §5.1 columns, in panel order', () => {
    expect(PRODUCT_FIELDS.map((field) => field.name)).toEqual(['name', 'link', 'collectionLink']);
  });

  it('marks the name and the landing page link required, the collection link optional', () => {
    expect(PRODUCT_FIELDS.map((field) => field.required)).toEqual([true, true, false]);
  });
});

describe('hostLabel', () => {
  it('shortens a long landing page URL to its host', () => {
    expect(hostLabel('https://niagarasleep.example/products/deep-sleep-weighted-blanket')).toBe(
      'niagarasleep.example',
    );
  });

  it('drops a www prefix so two links of one brand read the same', () => {
    expect(hostLabel('https://www.niagarasleep.example/collections/sleep-essentials')).toBe(
      'niagarasleep.example',
    );
  });

  it('keeps a port, which is part of the host', () => {
    expect(hostLabel('http://localhost:3000/products/one')).toBe('localhost:3000');
  });

  it('returns null for an absent collection link, so the cell renders the em dash', () => {
    expect(hostLabel(null)).toBeNull();
  });

  it('returns null for a whitespace-only value rather than an empty chip', () => {
    expect(hostLabel('   ')).toBeNull();
  });

  it('returns an unparseable value untouched instead of hiding it', () => {
    expect(hostLabel('niagarasleep.example')).toBe('niagarasleep.example');
  });
});

describe('conceptCountLabel', () => {
  it('renders zero as a number, never a blank or a dash', () => {
    expect(conceptCountLabel(0)).toBe('0 concepts');
  });

  it('is singular at one', () => {
    expect(conceptCountLabel(1)).toBe('1 concept');
  });

  it('is plural above one', () => {
    expect(conceptCountLabel(4)).toBe('4 concepts');
  });
});

describe('conceptCountTone', () => {
  it('is muted at zero and info above it', () => {
    expect(conceptCountTone(0)).toBe('mute');
    expect(conceptCountTone(1)).toBe('info');
  });
});
