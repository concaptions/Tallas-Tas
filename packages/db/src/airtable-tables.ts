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
  /** Present on a metadata response; optional so a caller may pass a name/id pair only. */
  readonly fields?: readonly { readonly name: string }[];
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

/**
 * Tables that MUST resolve by id, not by name, because the name is ambiguous ACROSS BASES.
 *
 * Verified against both live bases on 2026-10-03. `Themes` is the whole reason this exists:
 *   - Gratsi `Themes` = tbl1aFLMJXxhdVKiz — the real library: Name, Notes, Assignee, Status,
 *     Attachments, Attachment Summary.
 *   - The TEMPLATE base also has a table called `Themes`, tblzS73a9JrJGiV2J — but its three fields
 *     are Module Name, Reference Link, Concepts, i.e. the shape Gratsi calls
 *     "(Internal) Creative Modules".
 *
 * So a name resolver pointed at the template does not fail loudly: it resolves `Themes` to the
 * module-shaped table and feeds it to the `themes` mapping, whose six field names match none of
 * those three, and writes EMPTY rows. A name collision defeating the resolver built for id
 * collisions. `tbl1aFLMJXxhdVKiz` does not exist in the template base at all, which is consistent
 * with themes being a GLOBAL library (CLAUDE.md non-negotiable 3) with no per-brand parent set.
 */
export const ID_ANCHORED_TABLES: Readonly<Record<string, string>> = {
  Themes: 'tbl1aFLMJXxhdVKiz',
};

/** The field shape of the template's decoy `Themes`; resolving to this is always a bug. */
export const CREATIVE_MODULES_SHAPE: readonly string[] = [
  'Concepts',
  'Module Name',
  'Reference Link',
];

/**
 * True when a table carries the decoy shape — the guard the Themes test asserts against, exported
 * so the importer and the test agree on one definition rather than two copies.
 */
export function isCreativeModulesShape(fieldNames: readonly string[]): boolean {
  const sorted = [...fieldNames].sort((left, right) => left.localeCompare(right));
  return (
    sorted.length === CREATIVE_MODULES_SHAPE.length &&
    sorted.every((name, index) => name === CREATIVE_MODULES_SHAPE[index])
  );
}

/** Raised when a table resolves to a table whose shape proves it is the wrong one. */
export class AmbiguousAirtableTableError extends Error {
  constructor(exportKey: string, resolvedId: string, baseId: string) {
    super(
      `Airtable table "${exportKey}" resolved to ${resolvedId} in base ${baseId}, whose fields are the Creative Modules shape (Module Name / Reference Link / Concepts). "Themes" names two different tables across the bases; resolve it by id (ID_ANCHORED_TABLES), never by name.`,
    );
  }
}

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
  const byId = new Map(meta.map((table) => [table.id, table]));
  const resolved: Record<string, string> = {};
  for (const [exportKey, name] of Object.entries(tables)) {
    // An id-anchored table ignores the name entirely: see ID_ANCHORED_TABLES for why.
    const anchored = ID_ANCHORED_TABLES[exportKey];
    const id =
      anchored !== undefined ? (byId.has(anchored) ? anchored : undefined) : byName.get(name);
    if (id === undefined) {
      // The anchored table is absent. If this base nonetheless HAS a table of that name and it
      // carries the decoy shape, say so — "not in base" would send the operator looking for a
      // missing table when the real problem is that the name means something else here.
      const sameName = byName.get(name);
      const decoyFields = sameName === undefined ? undefined : byId.get(sameName)?.fields;
      if (
        sameName !== undefined &&
        decoyFields !== undefined &&
        isCreativeModulesShape(decoyFields.map((field) => field.name))
      ) {
        throw new AmbiguousAirtableTableError(exportKey, sameName, baseId);
      }
      throw new UnknownAirtableTableError(name, baseId);
    }
    const table = byId.get(id);
    const fieldNames = table?.fields?.map((field) => field.name);
    if (fieldNames !== undefined && isCreativeModulesShape(fieldNames)) {
      throw new AmbiguousAirtableTableError(exportKey, id, baseId);
    }
    resolved[exportKey] = id;
  }
  return resolved;
}
