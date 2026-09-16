import { describe, expect, it } from 'vitest';

import { parseCsv } from './parse-csv';
import { toCsv } from './to-csv';

describe('parseCsv', () => {
  it('splits the header row from the data rows', () => {
    expect(parseCsv('name,link\nBlanket,https://niagarasleep.com/blanket')).toEqual({
      headers: ['name', 'link'],
      rows: [['Blanket', 'https://niagarasleep.com/blanket']],
    });
  });

  it('returns empty headers and rows for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });

  it('returns empty headers and rows for input that is only line breaks', () => {
    expect(parseCsv('\r\n\n\r')).toEqual({ headers: [], rows: [] });
  });

  it('returns the header row and no rows for a header-only template', () => {
    expect(parseCsv('name,link,collection_link')).toEqual({
      headers: ['name', 'link', 'collection_link'],
      rows: [],
    });
  });

  it('tolerates CRLF line endings', () => {
    expect(parseCsv('name,link\r\nBlanket,/blanket\r\nMask,/mask')).toEqual({
      headers: ['name', 'link'],
      rows: [
        ['Blanket', '/blanket'],
        ['Mask', '/mask'],
      ],
    });
  });

  it('tolerates a lone CR as a record separator', () => {
    expect(parseCsv('name\rBlanket\rMask')).toEqual({
      headers: ['name'],
      rows: [['Blanket'], ['Mask']],
    });
  });

  it('strips a leading UTF-8 BOM', () => {
    expect(parseCsv('﻿name,link\nBlanket,/blanket').headers).toEqual(['name', 'link']);
  });

  it('reads a quoted field containing a comma', () => {
    expect(parseCsv('name,link\n"Bundle, boxed",/bundle').rows).toEqual([
      ['Bundle, boxed', '/bundle'],
    ]);
  });

  it('reads a doubled quote inside a quoted field as one quote', () => {
    expect(parseCsv('name\n"He said ""hello"""').rows).toEqual([['He said "hello"']]);
  });

  it('reads a newline inside a quoted field without ending the record', () => {
    const parsed = parseCsv('name,notes\nMask,"first\nsecond"\nBlanket,warm');
    expect(parsed.rows).toEqual([
      ['Mask', 'first\nsecond'],
      ['Blanket', 'warm'],
    ]);
  });

  it('keeps a CRLF inside a quoted field verbatim', () => {
    expect(parseCsv('name\r\n"first\r\nsecond"').rows).toEqual([['first\r\nsecond']]);
  });

  it('keeps an empty quoted field and an empty trailing field', () => {
    expect(parseCsv('a,b,c\n"",x,').rows).toEqual([['', 'x', '']]);
  });

  it('keeps a row whose only field is a quoted empty string', () => {
    expect(parseCsv('name\n""').rows).toEqual([['']]);
  });

  it('skips blank lines between records and a trailing newline', () => {
    expect(parseCsv('name,link\n\nBlanket,/blanket\n\r\nMask,/mask\n').rows).toEqual([
      ['Blanket', '/blanket'],
      ['Mask', '/mask'],
    ]);
  });

  it('returns a ragged record with the field count it actually had', () => {
    expect(parseCsv('a,b,c\n1,2\n1,2,3,4').rows).toEqual([
      ['1', '2'],
      ['1', '2', '3', '4'],
    ]);
  });

  it('does not trim whitespace around a field', () => {
    expect(parseCsv(' name , link \n Blanket , /blanket ')).toEqual({
      headers: [' name ', ' link '],
      rows: [[' Blanket ', ' /blanket ']],
    });
  });

  it('round-trips everything toCsv escapes', () => {
    const headers = ['name', 'notes'];
    const rows = [
      ['Bundle, boxed', 'He said "hello"'],
      ['Mask', 'first\nsecond'],
      ['Blanket', ''],
    ];
    expect(parseCsv(toCsv(headers, rows))).toEqual({ headers, rows });
  });
});
