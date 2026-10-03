import { firstField, normalizeFieldName } from './airtable-import';
import { describe, expect, it } from 'vitest';

import {
  isCreativeModulesShape,
  GRATSI_TABLES,
  TEMPLATE_IDS_WITH_DIFFERENT_GRATSI_NAME,
  UnknownAirtableTableError,
  resolveTableIds,
} from './airtable-tables';

/** The two bases' real name/id pairs for the tables whose ids collide (metadata, 2026-10-01). */
const GRATSI_META = [
  { id: 'tblZpBYPTcZcmQ1Kf', name: 'Meta Copywriting' },
  { id: 'tblhU5yVNhVDwykUt', name: 'Creative Design (Internal & Interface)' },
  { id: 'tbl4UFSFcynlS2Pkn', name: 'Concepts' },
  { id: 'tblRlcp1ibmS7U7HG', name: 'Angles' },
  { id: 'tblGC0TxnHI7lKaNQ', name: 'Creative Sheet' },
  { id: 'tblzS73a9JrJGiV2J', name: '(Internal) Creative Modules' },
  { id: 'tbl1aFLMJXxhdVKiz', name: 'Themes' },
  { id: 'tblfvfJMYNBz2OYYw', name: '(Internal) Product' },
];
const TEMPLATE_META = [
  { id: 'tblZpBYPTcZcmQ1Kf', name: 'Copywriting' },
  { id: 'tblhU5yVNhVDwykUt', name: 'Creative Sheet (Internal & Interface)' },
  { id: 'tbl4UFSFcynlS2Pkn', name: 'Angles' },
  { id: 'tblRlcp1ibmS7U7HG', name: 'Concepts' },
  { id: 'tblGC0TxnHI7lKaNQ', name: 'DONT USE Creative Sheet' },
  { id: 'tblzS73a9JrJGiV2J', name: 'Themes' },
];

describe('resolveTableIds', () => {
  it('resolves every Gratsi export key by NAME, so swapped ids land on the right table', () => {
    const subset = {
      Concepts: GRATSI_TABLES.Concepts ?? '',
      Angles: GRATSI_TABLES.Angles ?? '',
      Themes: GRATSI_TABLES.Themes ?? '',
      'Creative Sheet': GRATSI_TABLES['Creative Sheet'] ?? '',
      '(Internal) Creative Modules': GRATSI_TABLES['(Internal) Creative Modules'] ?? '',
      Copywriting: GRATSI_TABLES.Copywriting ?? '',
    };
    const ids = resolveTableIds(GRATSI_META, subset, 'appllDG4OmkK2Hdnn');
    expect(ids.Concepts).toBe('tbl4UFSFcynlS2Pkn');
    expect(ids.Angles).toBe('tblRlcp1ibmS7U7HG');
    expect(ids.Themes).toBe('tbl1aFLMJXxhdVKiz');
    expect(ids['Creative Sheet']).toBe('tblGC0TxnHI7lKaNQ');
    expect(ids['(Internal) Creative Modules']).toBe('tblzS73a9JrJGiV2J');
    expect(ids.Copywriting).toBe('tblZpBYPTcZcmQ1Kf');
  });

  it('FAILS if a template table id were used to resolve a Gratsi table of a different name', () => {
    // Resolving against the TEMPLATE metadata must not quietly succeed for Gratsi names: the
    // template has no "Meta Copywriting", "(Internal) Creative Modules" or "Creative Sheet" (its
    // "Creative Sheet" is the DONT USE one), so the resolver throws instead of returning the
    // colliding id.
    for (const key of ['Copywriting', '(Internal) Creative Modules', 'Creative Sheet'] as const) {
      const name = GRATSI_TABLES[key] ?? '';
      expect(() => resolveTableIds(TEMPLATE_META, { [key]: name }, 'appnaSGAgOUbJ0f9m')).toThrow(
        UnknownAirtableTableError,
      );
    }
    // And where the NAME exists in both bases but the id is swapped (Concepts/Angles), the Gratsi
    // resolution never hands back the template's id for that name.
    const gratsi = resolveTableIds(
      GRATSI_META,
      { Concepts: 'Concepts', Angles: 'Angles' },
      'appllDG4OmkK2Hdnn',
    );
    expect(TEMPLATE_IDS_WITH_DIFFERENT_GRATSI_NAME[gratsi.Concepts ?? '']).toBe('Angles');
    expect(gratsi.Concepts).not.toBe(
      resolveTableIds(TEMPLATE_META, { Concepts: 'Concepts' }, 'appnaSGAgOUbJ0f9m').Concepts,
    );
  });

  it('throws on a name the base does not carry, never a remembered id', () => {
    expect(() => resolveTableIds(GRATSI_META, { X: 'No Such Table' }, 'appllDG4OmkK2Hdnn')).toThrow(
      'Airtable table "No Such Table" is not in base appllDG4OmkK2Hdnn',
    );
  });
});

describe('Themes is id-anchored, because the name collides across bases', () => {
  // The decoy: the TEMPLATE base has a table called `Themes` whose fields are the Creative Modules
  // shape. Verified against both live bases on 2026-10-03.
  const DECOY = {
    id: 'tblzS73a9JrJGiV2J',
    name: 'Themes',
    fields: [{ name: 'Module Name' }, { name: 'Reference Link' }, { name: 'Concepts' }],
  };
  const REAL = {
    id: 'tbl1aFLMJXxhdVKiz',
    name: 'Themes',
    fields: [
      { name: 'Name' },
      { name: 'Notes' },
      { name: 'Assignee' },
      { name: 'Status' },
      { name: 'Attachments' },
      { name: 'Attachment Summary' },
    ],
  };

  it('resolves Themes to the real library by id, not by the name it shares with the decoy', () => {
    const resolved = resolveTableIds([REAL, DECOY], { Themes: 'Themes' }, 'appllDG4OmkK2Hdnn');
    expect(resolved['Themes']).toBe('tbl1aFLMJXxhdVKiz');
  });

  it('never resolves to the Creative Modules shape, even when that is the only table named Themes', () => {
    // This is the failure the owner asked to be made impossible: a base where the ONLY `Themes` is
    // the module-shaped decoy must raise, not silently feed six unmatched field names and write
    // empty rows.
    expect(() => resolveTableIds([DECOY], { Themes: 'Themes' }, 'appnaSGAgOUbJ0f9m')).toThrow(
      /Creative Modules shape/,
    );
  });

  it('still raises the unknown-table error when the anchored id is absent from the base', () => {
    expect(() =>
      resolveTableIds([{ id: 'tblSomethingElse', name: 'Themes' }], { Themes: 'Themes' }, 'appX'),
    ).toThrow(UnknownAirtableTableError);
  });

  it('recognises the decoy shape regardless of field order', () => {
    expect(isCreativeModulesShape(['Reference Link', 'Concepts', 'Module Name'])).toBe(true);
    expect(isCreativeModulesShape(['Name', 'Notes', 'Assignee'])).toBe(false);
    expect(isCreativeModulesShape(['Module Name', 'Reference Link'])).toBe(false);
  });
});

describe('field names match case-insensitively and whitespace-normalised', () => {
  it('matches the parent\'s "Creator\'s Video Intro" against Gratsi\'s "Creator\'s video Intro"', () => {
    // One capital letter apart in the two live bases. An exact-string resolver drops it silently.
    expect(
      firstField({ "Creator's video Intro": 'https://cdn/intro.mp4' }, ["Creator's Video Intro"]),
    ).toBe('https://cdn/intro.mp4');
  });

  it('matches Gratsi\'s double space in "Description  [Age Status Salary]"', () => {
    expect(
      firstField({ 'Description  [Age Status Salary]': '25-34' }, [
        'Description [Age Status Salary]',
      ]),
    ).toBe('25-34');
  });

  it('prefers an exact match over a normalised near-duplicate', () => {
    expect(firstField({ Passion: 'exact', passion: 'other' }, ['Passion'])).toBe('exact');
  });

  it('still returns undefined when no name matches at all', () => {
    expect(firstField({ Name: 'x' }, ['Nothing Like It'])).toBeUndefined();
  });

  it('normalises the way the matcher claims to', () => {
    expect(normalizeFieldName("  Creator's   VIDEO  Intro ")).toBe("creator's video intro");
  });
});
