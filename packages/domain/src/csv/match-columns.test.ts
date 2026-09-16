import { describe, expect, it } from 'vitest';

import { matchColumns } from './match-columns';
import { parseCsv } from './parse-csv';

const PRODUCT_COLUMNS = ['name', 'link', 'collection_link'] as const;

describe('matchColumns', () => {
  it('matches an exact header row', () => {
    expect(matchColumns([...PRODUCT_COLUMNS], PRODUCT_COLUMNS)).toEqual({
      present: ['name', 'link', 'collection_link'],
      missing: [],
      unknown: [],
      indexes: { name: 0, link: 1, collection_link: 2 },
    });
  });

  it('ignores case and surrounding whitespace', () => {
    expect(matchColumns(['  Name', 'LINK ', ' Collection_Link '], PRODUCT_COLUMNS)).toEqual({
      present: ['name', 'link', 'collection_link'],
      missing: [],
      unknown: [],
      indexes: { name: 0, link: 1, collection_link: 2 },
    });
  });

  it('reports a missing column', () => {
    const match = matchColumns(['name', 'collection_link'], PRODUCT_COLUMNS);
    expect(match.missing).toEqual(['link']);
    expect(match.present).toEqual(['name', 'collection_link']);
    expect(match.indexes).toEqual({ name: 0, collection_link: 1 });
  });

  it('reports an unexpected column with the spelling the file used', () => {
    const match = matchColumns(['name', 'link', 'collection_link', ' Owner '], PRODUCT_COLUMNS);
    expect(match.unknown).toEqual([' Owner ']);
    expect(match.missing).toEqual([]);
  });

  it('reports a near-miss header as unknown rather than guessing', () => {
    const match = matchColumns(['name', 'link', 'collection link'], PRODUCT_COLUMNS);
    expect(match.missing).toEqual(['collection_link']);
    expect(match.unknown).toEqual(['collection link']);
  });

  it('keeps the first position when a column is duplicated', () => {
    const match = matchColumns(['name', 'link', 'Name'], PRODUCT_COLUMNS);
    expect(match.indexes).toEqual({ name: 0, link: 1 });
    expect(match.present).toEqual(['name', 'link']);
    expect(match.unknown).toEqual([]);
    expect(match.missing).toEqual(['collection_link']);
  });

  it('preserves the expected order, not the header order', () => {
    const match = matchColumns(['collection_link', 'name'], PRODUCT_COLUMNS);
    expect(match.present).toEqual(['name', 'collection_link']);
    expect(match.indexes).toEqual({ name: 1, collection_link: 0 });
  });

  it('reports every expected column missing for an empty header row', () => {
    expect(matchColumns([], PRODUCT_COLUMNS)).toEqual({
      present: [],
      missing: ['name', 'link', 'collection_link'],
      unknown: [],
      indexes: {},
    });
  });

  it('reports every header unknown when nothing is expected', () => {
    expect(matchColumns(['name'], [])).toEqual({
      present: [],
      missing: [],
      unknown: ['name'],
      indexes: {},
    });
  });

  it('reports a blank header as unknown', () => {
    expect(matchColumns(['name', '', 'link'], PRODUCT_COLUMNS).unknown).toEqual(['']);
  });

  it('reads a parsed row through the indexes it returns', () => {
    const parsed = parseCsv('Link,Name\r\nhttps://niagarasleep.com/mask,Mask');
    const match = matchColumns(parsed.headers, PRODUCT_COLUMNS);

    expect(match.missing).toEqual(['collection_link']);
    const row = parsed.rows[0] ?? [];
    expect(row[match.indexes.name ?? -1]).toBe('Mask');
    expect(row[match.indexes.link ?? -1]).toBe('https://niagarasleep.com/mask');
  });
});
