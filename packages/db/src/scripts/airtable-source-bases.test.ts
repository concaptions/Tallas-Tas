import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CREATOR_FIELDS,
  parseAirtableSourceBases,
  toCreatorRow,
} from './airtable-source-bases';

const BASE = {
  baseId: 'appFIXD000000001',
  creatorsTableId: 'tblUGC0000000001',
  brandLabel: 'FIXD',
  fields: DEFAULT_CREATOR_FIELDS,
};

describe('parseAirtableSourceBases', () => {
  it('is empty when the variable is unset or blank, so no base is ever read by accident', () => {
    expect(parseAirtableSourceBases(undefined)).toEqual([]);
    expect(parseAirtableSourceBases('   ')).toEqual([]);
  });

  it('parses the documented shape and fills the Gratsi field names in', () => {
    const [base] = parseAirtableSourceBases(
      '[{"baseId":"appX","creatorsTableId":"tblY","brandLabel":"FIXD"}]',
    );
    expect(base).toEqual({
      baseId: 'appX',
      creatorsTableId: 'tblY',
      brandLabel: 'FIXD',
      fields: DEFAULT_CREATOR_FIELDS,
    });
  });

  it('lets a base override a field name without losing the other defaults', () => {
    const [base] = parseAirtableSourceBases(
      '[{"baseId":"appX","creatorsTableId":"tblY","brandLabel":"FIXD","fields":{"name":"Creator"}}]',
    );
    expect(base?.fields).toEqual({ ...DEFAULT_CREATOR_FIELDS, name: 'Creator' });
  });

  it('names the broken entry instead of silently skipping it', () => {
    expect(() => parseAirtableSourceBases('[{"baseId":"appX"}]')).toThrow(
      /entry 0\.creatorsTableId/u,
    );
    expect(() => parseAirtableSourceBases('{"baseId":"appX"}')).toThrow(/JSON array/u);
    expect(() => parseAirtableSourceBases('nope')).toThrow(/valid JSON/u);
  });
});

describe('toCreatorRow', () => {
  it('reads the name, handle and first attachment url', () => {
    const row = toCreatorRow(
      {
        id: 'recA',
        fields: {
          Name: '  Ada Lovelace ',
          'Instagram Username': '@ada',
          "Creator's Profile Pic": [{ url: 'https://dl.airtable.com/ada.jpg' }, { url: 'x' }],
        },
      },
      BASE,
    );
    expect(row).toEqual({
      airtableId: 'recA',
      baseId: BASE.baseId,
      brandLabel: 'FIXD',
      name: 'Ada Lovelace',
      instagramUsername: '@ada',
      profilePicUrl: 'https://dl.airtable.com/ada.jpg',
    });
  });

  it('is null without a name and null-fields without a handle or picture', () => {
    expect(toCreatorRow({ id: 'r', fields: {} }, BASE)).toBeNull();
    expect(toCreatorRow({ id: 'r', fields: { Name: 'Solo' } }, BASE)).toMatchObject({
      instagramUsername: null,
      profilePicUrl: null,
    });
  });
});
