import { describe, expect, it } from 'vitest';

import {
  GRATSI_ONLY_TABLE_IDS,
  GRATSI_TABLES,
  TEMPLATE_IDS_WITH_DIFFERENT_GRATSI_NAME,
  TEMPLATE_TABLES,
  UnknownAirtableTableError,
  resolveTableIds,
} from './airtable-tables';
import { TABLE_MAPPINGS } from './scripts/import-mappings';

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

/**
 * The TEMPLATE base's real name/id pairs for all fifteen of its tables (metadata, 2026-10-02,
 * `GET /v0/meta/bases/appnaSGAgOUbJ0f9m/tables`). Six of these ids are bound to a DIFFERENTLY NAMED
 * table in Gratsi, which is the whole reason the resolver takes metadata rather than remembering.
 */
const TEMPLATE_META_FULL = [
  { id: 'tblZpBYPTcZcmQ1Kf', name: 'Copywriting' },
  { id: 'tblhU5yVNhVDwykUt', name: 'Creative Sheet (Internal & Interface)' },
  { id: 'tblRlcp1ibmS7U7HG', name: 'Concepts' },
  { id: 'tbl4UFSFcynlS2Pkn', name: 'Angles' },
  { id: 'tblzS73a9JrJGiV2J', name: 'Themes' },
  { id: 'tblRXknfgKsROI961', name: 'Personas' },
  { id: 'tblRsVqiqUaZRcQYd', name: 'UGC Management' },
  { id: 'tblgfe8A7nmce6lzn', name: 'AI Characters / Personas' },
  { id: 'tbl6LBNrRqa6Hh4I2', name: '(Internal) Collections' },
  { id: 'tblfvfJMYNBz2OYYw', name: '(Internal) Product' },
  { id: 'tblRNaWCVa1cCIwLL', name: 'Campaigns & Offers' },
  { id: 'tblli0Y76yJvG56zK', name: '(Internal) Creative Dimensions' },
  { id: 'tbl9W6v78tKWznN9S', name: 'Competitive research' },
  { id: 'tbldFmPU6AWg62Fll', name: 'Client Assets Organisation' },
  { id: 'tblGC0TxnHI7lKaNQ', name: 'DONT USE Creative Sheet' },
];

const TEMPLATE_ID_BY_NAME = new Map(TEMPLATE_META_FULL.map((t) => [t.name, t.id]));

describe('the template base path never carries a remembered Gratsi id', () => {
  it('TEMPLATE_TABLES holds table NAMES only, never an id', () => {
    for (const [exportKey, name] of Object.entries(TEMPLATE_TABLES)) {
      expect(name, exportKey).not.toMatch(/^tbl[A-Za-z0-9]{14}$/);
      expect(GRATSI_ONLY_TABLE_IDS, exportKey).not.toContain(name);
    }
  });

  it('resolves every TEMPLATE_TABLES entry against the template base metadata', () => {
    const ids = resolveTableIds(TEMPLATE_META_FULL, TEMPLATE_TABLES, 'appnaSGAgOUbJ0f9m');
    expect(Object.keys(ids)).toHaveLength(Object.keys(TEMPLATE_TABLES).length);
    // The Personas trap: the template's table is tblRXknfgKsROI961, NOT Gratsi's
    // tblyt7X4VjHxtMDVS, and the two are different tables with different field sets.
    expect(ids.Personas).toBe('tblRXknfgKsROI961');
    expect(ids.Personas).not.toBe('tblyt7X4VjHxtMDVS');
    // The swap: the same two NAMES resolve to opposite ids in the two bases.
    expect(ids.Angles).toBe('tbl4UFSFcynlS2Pkn');
    expect(ids.Concepts).toBe('tblRlcp1ibmS7U7HG');
    expect(resolveTableIds(GRATSI_META, { Angles: 'Angles' }, 'appllDG4OmkK2Hdnn').Angles).toBe(
      ids.Concepts,
    );
    // And no resolved template id is one the template base does not carry.
    for (const id of Object.values(ids)) expect(GRATSI_ONLY_TABLE_IDS).not.toContain(id);
  });

  it('FAILS if a TABLE_MAPPINGS templateTableId is not the id the TEMPLATE base binds to that name', () => {
    const declared = Object.entries(TABLE_MAPPINGS).filter(
      ([, mapping]) => mapping.templateTableId !== undefined,
    );
    // Guard the guard: if nobody declares a template pair, this test proves nothing.
    expect(declared.length).toBeGreaterThan(0);
    for (const [key, mapping] of declared) {
      expect(GRATSI_ONLY_TABLE_IDS, key).not.toContain(mapping.templateTableId);
      expect(mapping.templateTable, key).toBeDefined();
      expect(mapping.templateTableId, key).toBe(
        TEMPLATE_ID_BY_NAME.get(mapping.templateTable ?? ''),
      );
    }
  });

  it('leaves out the two tables whose import is a product decision, not a mapping', () => {
    // docs/decisions.md (2026-10-02): the template's `Themes` is shaped like `creative_modules` and
    // has no field to source the NOT NULL `themes.category`; `DONT USE Creative Sheet` is the base's
    // own name for a deprecated table whose `Creative Name` is text, not a link. Importing either
    // means inventing data, so neither is in TEMPLATE_TABLES — pinned here so a later pass has to
    // make the decision rather than quietly add them.
    const names = Object.values(TEMPLATE_TABLES);
    expect(names).not.toContain('Themes');
    expect(names).not.toContain('DONT USE Creative Sheet');
  });
});
