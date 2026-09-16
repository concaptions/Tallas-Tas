import { describe, expect, it } from 'vitest';

import { escapeCsvField, toCsv } from './to-csv';

const PRODUCT_COLUMNS = ['name', 'link', 'collection_link'] as const;

describe('escapeCsvField', () => {
  it('leaves an ordinary field alone', () => {
    expect(escapeCsvField('Niagara Deep Sleep Weighted Blanket')).toBe(
      'Niagara Deep Sleep Weighted Blanket',
    );
  });

  it('quotes a field containing a comma', () => {
    expect(escapeCsvField('Blanket, Mask')).toBe('"Blanket, Mask"');
  });

  it('quotes a field containing a quote and doubles the inner quote', () => {
    expect(escapeCsvField('The "Night Reset" Bundle')).toBe('"The ""Night Reset"" Bundle"');
  });

  it('quotes a field containing a newline', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
  });

  it('quotes a field containing a carriage return', () => {
    expect(escapeCsvField('line one\r\nline two')).toBe('"line one\r\nline two"');
  });

  it('renders null and undefined as an empty field', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('renders a number without quoting it', () => {
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(12)).toBe('12');
  });
});

describe('toCsv', () => {
  it('emits the header row first', () => {
    expect(toCsv(PRODUCT_COLUMNS, [])).toBe('name,link,collection_link');
  });

  it('separates records with CRLF and emits no trailing separator', () => {
    const csv = toCsv(
      ['name', 'link'],
      [
        ['Blanket', 'https://niagarasleep.com/blanket'],
        ['Mask', 'https://niagarasleep.com/mask'],
      ],
    );
    expect(csv).toBe(
      'name,link\r\nBlanket,https://niagarasleep.com/blanket\r\nMask,https://niagarasleep.com/mask',
    );
    expect(csv.endsWith('\r\n')).toBe(false);
  });

  it('reads keyed rows through the headers, so the column order is the header order', () => {
    const csv = toCsv(PRODUCT_COLUMNS, [
      {
        collection_link: 'https://niagarasleep.com/collections/sleep',
        link: 'https://niagarasleep.com/blanket',
        name: 'Blanket',
      },
    ]);
    expect(csv.split('\r\n')[1]).toBe(
      'Blanket,https://niagarasleep.com/blanket,https://niagarasleep.com/collections/sleep',
    );
  });

  it('writes an empty field for a missing key and for a null value', () => {
    expect(toCsv(PRODUCT_COLUMNS, [{ name: 'Mask', collection_link: null }])).toBe(
      'name,link,collection_link\r\nMask,,',
    );
  });

  it('pads and truncates a positional row to the header count', () => {
    expect(toCsv(['a', 'b', 'c'], [['1'], ['1', '2', '3', '4']])).toBe('a,b,c\r\n1,,\r\n1,2,3');
  });

  it('quotes a cell with a comma, a quote and a newline in the same document', () => {
    const csv = toCsv(
      ['name', 'notes'],
      [
        ['Bundle, boxed', 'He said "hello"'],
        ['Mask', 'first\nsecond'],
      ],
    );
    expect(csv).toBe('name,notes\r\n"Bundle, boxed","He said ""hello"""\r\nMask,"first\nsecond"');
  });

  it('quotes a header that needs quoting', () => {
    expect(toCsv(['product, name'], [])).toBe('"product, name"');
  });

  it('emits an empty document for no headers and no rows', () => {
    expect(toCsv([], [])).toBe('');
  });
});
