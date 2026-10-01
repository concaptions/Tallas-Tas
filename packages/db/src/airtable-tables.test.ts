import { describe, expect, it } from 'vitest';

import {
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
