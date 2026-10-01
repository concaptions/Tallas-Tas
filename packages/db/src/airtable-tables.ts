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
