/**
 * Airtable table resolution by NAME (Prompt 3, 2026-10-01).
 *
 * Table IDs are NOT stable across bases: the template base `appnaSGAgOUbJ0f9m` and the Gratsi base
 * `appllDG4OmkK2Hdnn` share several ids under DIFFERENT names (the template's "Themes" is Gratsi's
 * "(Internal) Creative Modules"; template "Angles" ↔ Gratsi "Concepts" are swapped; template
 * "Creative Sheet (Internal & Interface)" is Gratsi's "Creative Design (Internal & Interface)";
 * template "DONT USE Creative Sheet" is Gratsi's live "Creative Sheet"). Resolving by id against the
 * wrong base silently imports the wrong table. So the fetcher asks the base for its metadata and
 * resolves every table by its NAME in THAT base; `resolveTableIds` is the pure core, unit-tested
 * against both bases' real name/id pairs.
 */

/**
 * Which of the two name maps a fetch resolved. Stamped on the export as `sourceBase` so the engine
 * can read a per-base label: a few LABELS mean different things in the two bases (airtable-import.ts).
 */
export type AirtableBaseKind = 'gratsi' | 'template';

export interface AirtableTableMeta {
  readonly id: string;
  readonly name: string;
}

/** exportKey → the table's NAME in the Gratsi base. Nothing here is an id. */
export const GRATSI_TABLES: Readonly<Record<string, string>> = {
  Products: '(Internal) Product',
  Themes: 'Themes',
  'Campaigns & Offers': 'Campaigns & Offers',
  Personas: 'Personas',
  Angles: 'Angles',
  Concepts: 'Concepts',
  Collections: '(Internal) Collections',
  'Creative Briefs': 'Creative Design (Internal & Interface)',
  Copywriting: 'Meta Copywriting',
  'Youtube Copywriting': 'Youtube Copywriting',
  Creators: 'UGC Management',
  'Competitive research': 'Competitive research',
  'Client Assets Organisation': 'Client Assets Organisation',
  '(Internal) Creative Dimensions': '(Internal) Creative Dimensions',
  'Creative Sheet': 'Creative Sheet',
  '(Internal) Creative Modules': '(Internal) Creative Modules',
  'SM Campaign Management Feed': 'SM Campaign Management Feed',
  'Email Campaigns Management': 'Email Campaigns Management',
  'Email Flows Management': 'Email Flows Management',
  '(Internal) Copy Type': '(Internal) Copy Type',
  'Creative Reporting': 'Creative Reporting',
};

/**
 * exportKey → the table's NAME in the TEMPLATE base `appnaSGAgOUbJ0f9m` (2026-10-02). Names, not
 * ids, for the reason the header gives. Two of the base's fifteen tables are deliberately absent
 * and registered as exclusions in docs/decisions.md (2026-10-02): `Themes`, which has no field to
 * source the NOT NULL `themes.category` and is shaped like our `creative_modules` (a product
 * decision, escalated rather than guessed), and `DONT USE Creative Sheet`, deprecated by the base's
 * own name and holding `Creative Name` as text where we have a uuid FK.
 */
export const TEMPLATE_TABLES: Readonly<Record<string, string>> = {
  Products: '(Internal) Product',
  'Campaigns & Offers': 'Campaigns & Offers',
  Personas: 'Personas',
  'AI Characters / Personas': 'AI Characters / Personas',
  Angles: 'Angles',
  Concepts: 'Concepts',
  Collections: '(Internal) Collections',
  'Creative Briefs': 'Creative Sheet (Internal & Interface)',
  Copywriting: 'Copywriting',
  Creators: 'UGC Management',
  'Competitive research': 'Competitive research',
  'Client Assets Organisation': 'Client Assets Organisation',
  '(Internal) Creative Dimensions': '(Internal) Creative Dimensions',
};

/**
 * Ids the GRATSI base binds to a table the TEMPLATE base does not carry at all: Gratsi's 7-field
 * `Personas` (the template's is `tblRXknfgKsROI961`, 15 fields) and Gratsi's generic `Themes`.
 * Either one on the template path means a remembered Gratsi id was pasted in — the exact bug the
 * 2026-10-02 audit found in `TABLE_MAPPINGS.personas` — so `airtable-tables.test.ts` fails on it.
 */
export const GRATSI_ONLY_TABLE_IDS: readonly string[] = ['tblyt7X4VjHxtMDVS', 'tbl1aFLMJXxhdVKiz'];

/**
 * The template base's table ids whose NAME differs in the Gratsi base. A resolver that hands one of
 * these back for a Gratsi table name is reading the wrong base; the test pins that it never does.
 */
export const TEMPLATE_IDS_WITH_DIFFERENT_GRATSI_NAME: Readonly<Record<string, string>> = {
  tblZpBYPTcZcmQ1Kf: 'Copywriting',
  tblhU5yVNhVDwykUt: 'Creative Sheet (Internal & Interface)',
  tbl4UFSFcynlS2Pkn: 'Angles',
  tblRlcp1ibmS7U7HG: 'Concepts',
  tblGC0TxnHI7lKaNQ: 'DONT USE Creative Sheet',
  tblzS73a9JrJGiV2J: 'Themes',
};

export class UnknownAirtableTableError extends Error {
  constructor(name: string, baseId: string) {
    super(`Airtable table "${name}" is not in base ${baseId}`);
  }
}

/**
 * exportKey → table id, resolved by name against the given base's metadata. Throws on a name the
 * base does not carry rather than falling back to any remembered id.
 */
export function resolveTableIds(
  meta: readonly AirtableTableMeta[],
  tables: Readonly<Record<string, string>>,
  baseId: string,
): Record<string, string> {
  const byName = new Map(meta.map((table) => [table.name, table.id]));
  const resolved: Record<string, string> = {};
  for (const [exportKey, name] of Object.entries(tables)) {
    const id = byName.get(name);
    if (id === undefined) throw new UnknownAirtableTableError(name, baseId);
    resolved[exportKey] = id;
  }
  return resolved;
}
