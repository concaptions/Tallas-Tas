import type { AirtableRecord } from '../airtable-import';

/**
 * The OTHER client Airtable bases the creator-registry scripts may read (Oct 8 Talal ask).
 * Configured through `AIRTABLE_SOURCE_BASES`, a JSON array; a base is never read unless it is
 * listed there, because these bases belong to Talal's clients, not to TAS.
 *
 *   AIRTABLE_SOURCE_BASES='[{"baseId":"appXXX","creatorsTableId":"tblYYY","brandLabel":"FIXD"}]'
 *
 * `fields` overrides the column names when a base does not use the Gratsi names.
 */
export interface AirtableSourceBase {
  readonly baseId: string;
  readonly creatorsTableId: string;
  readonly brandLabel: string;
  readonly fields: {
    readonly name: string;
    readonly instagram: string;
    readonly profilePic: string;
  };
}

/** The Gratsi UGC table's names, the shape every other TAS client base was cloned from. */
export const DEFAULT_CREATOR_FIELDS = {
  name: 'Name',
  instagram: 'Instagram Username',
  profilePic: "Creator's Profile Pic",
} as const;

export interface AirtableCreatorRow {
  readonly airtableId: string;
  readonly baseId: string;
  readonly brandLabel: string;
  readonly name: string;
  readonly instagramUsername: string | null;
  readonly profilePicUrl: string | null;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`AIRTABLE_SOURCE_BASES: ${path} must be a non-empty string`);
  }
  return value.trim();
}

export function parseAirtableSourceBases(raw: string | undefined): AirtableSourceBase[] {
  if (raw === undefined || raw.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AIRTABLE_SOURCE_BASES is not valid JSON');
  }
  if (!Array.isArray(parsed)) throw new Error('AIRTABLE_SOURCE_BASES must be a JSON array');
  return parsed.map((entry: unknown, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`AIRTABLE_SOURCE_BASES: entry ${String(index)} must be an object`);
    }
    const record = entry as Record<string, unknown>;
    const fields =
      typeof record['fields'] === 'object' && record['fields'] !== null
        ? (record['fields'] as Record<string, unknown>)
        : {};
    const field = (key: keyof typeof DEFAULT_CREATOR_FIELDS): string =>
      typeof fields[key] === 'string' && fields[key].trim() !== ''
        ? fields[key].trim()
        : DEFAULT_CREATOR_FIELDS[key];
    return {
      baseId: nonEmptyString(record['baseId'], `entry ${String(index)}.baseId`),
      creatorsTableId: nonEmptyString(
        record['creatorsTableId'],
        `entry ${String(index)}.creatorsTableId`,
      ),
      brandLabel: nonEmptyString(record['brandLabel'], `entry ${String(index)}.brandLabel`),
      fields: {
        name: field('name'),
        instagram: field('instagram'),
        profilePic: field('profilePic'),
      },
    };
  });
}

function firstAttachmentUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first: unknown = value[0];
  if (typeof first !== 'object' || first === null) return null;
  const url = (first as Record<string, unknown>)['url'];
  return typeof url === 'string' && url !== '' ? url : null;
}

/** One Airtable record as the registry scripts see it; null when the row has no usable name. */
export function toCreatorRow(
  record: AirtableRecord,
  base: AirtableSourceBase,
): AirtableCreatorRow | null {
  const name = record.fields[base.fields.name];
  if (typeof name !== 'string' || name.trim() === '') return null;
  const instagram = record.fields[base.fields.instagram];
  return {
    airtableId: record.id,
    baseId: base.baseId,
    brandLabel: base.brandLabel,
    name: name.trim(),
    instagramUsername:
      typeof instagram === 'string' && instagram.trim() !== '' ? instagram.trim() : null,
    profilePicUrl: firstAttachmentUrl(record.fields[base.fields.profilePic]),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Read-only page walk over one base's creators table; stops early once `limit` rows are in hand. */
export async function listAirtableCreatorRows(
  pat: string,
  base: AirtableSourceBase,
  options: { readonly limit?: number } = {},
): Promise<AirtableCreatorRow[]> {
  const rows: AirtableCreatorRow[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base.baseId}/${base.creatorsTableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) {
      throw new Error(
        `${base.brandLabel} (${base.baseId}): HTTP ${String(res.status)} ${await res.text()}`,
      );
    }
    const body = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const record of body.records) {
      const row = toCreatorRow(record, base);
      if (row !== null) rows.push(row);
      if (options.limit !== undefined && rows.length >= options.limit) return rows;
    }
    offset = body.offset;
    // Airtable caps at 5 req/s per base; a fixed gap keeps a long walk well inside it.
    await sleep(250);
  } while (offset);
  return rows;
}
