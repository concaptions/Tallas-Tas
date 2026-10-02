import { readFileSync } from 'node:fs';
import path from 'node:path';

import { serverEnv } from '@tas/env';

import { GRATSI_TABLES, TEMPLATE_TABLES } from '../airtable-tables';
import { TABLE_MAPPINGS, type FieldMapping, type TableMapping } from './import-mappings';

/**
 * Schema parity gate (Prompt 4, 2026-10-01): the LIVE Gratsi base against this platform's mappings.
 *
 * Exits 1 on any table of the base that `GRATSI_TABLES` does not import, on any imported table
 * without a `TABLE_MAPPINGS` entry, on any mapped table the base no longer carries, and on any
 * STORED field of an imported table that is neither (a) mapped to a column or junction, nor (b) a
 * record link whose inverse field on the other table is mapped (the base's own
 * `inverseLinkFieldId` says which field that is, so the junction is written from that side), nor
 * (c) excluded by name in the register in docs/decisions.md ("<Table> › <Field>"). Computed field
 * types (formula, lookup, rollup, count, created/modified time and by, autonumber, button) are
 * not stored by design and are counted, never failed.
 *
 *   node scripts/airtable-parity.mjs                      (repo root; needs AIRTABLE_PAT)
 *   pnpm --filter @tas/db airtable-parity -- --base <id> --verbose
 *   pnpm --filter @tas/db airtable-parity -- --template --base appnaSGAgOUbJ0f9m
 *
 * `--template` (2026-10-02) gates the TEMPLATE base instead: `TEMPLATE_TABLES` says which of its
 * tables are imported and a mapping is matched on its `templateTable` name. Matching on
 * `airtableTable` would be wrong there, because the two bases swap the names Angles and Concepts —
 * so the Gratsi `angles` mapping (which describes the template's Concepts fields) would be judged
 * against the template's Angles table and pass on nothing.
 */

const COMPUTED_TYPES = new Set([
  'formula',
  'multipleLookupValues',
  'rollup',
  'count',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
  'autoNumber',
  'button',
]);

interface MetaField {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly options?: { readonly linkedTableId?: string; readonly inverseLinkFieldId?: string };
}
interface MetaTable {
  readonly id: string;
  readonly name: string;
  readonly fields: readonly MetaField[];
}

type Verdict =
  | { readonly kind: 'mapped' }
  | { readonly kind: 'reverse'; readonly of: string }
  | { readonly kind: 'excluded' }
  | { readonly kind: 'computed' }
  | { readonly kind: 'failure'; readonly reason: string };

function flag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

async function fetchMeta(pat: string, baseId: string): Promise<MetaTable[]> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!res.ok) throw new Error(`metadata: HTTP ${String(res.status)} ${await res.text()}`);
  return ((await res.json()) as { tables: MetaTable[] }).tables;
}

/** The exclusion register: docs/decisions.md names "<Table> › <Field>" for every excluded field. */
function loadExclusionRegister(): string {
  return readFileSync(path.join(process.cwd(), '..', '..', 'docs', 'decisions.md'), 'utf-8');
}

function mappingFor(tableName: string, template: boolean): TableMapping | undefined {
  const mappings = Object.values(TABLE_MAPPINGS);
  if (template) return mappings.find((mapping) => mapping.templateTable === tableName);
  return mappings.find((mapping) => mapping.airtableTable === tableName);
}

function isMapped(entry: FieldMapping | undefined): boolean {
  return entry !== undefined && (entry.drizzleColumn !== null || entry.junctionTable !== undefined);
}

function judge(
  table: MetaTable,
  field: MetaField,
  mapping: TableMapping,
  tablesById: ReadonlyMap<string, MetaTable>,
  register: string,
  template: boolean,
): Verdict {
  if (COMPUTED_TYPES.has(field.type)) return { kind: 'computed' };
  const entry = mapping.fields[field.name];
  if (isMapped(entry)) return { kind: 'mapped' };

  if (field.type === 'multipleRecordLinks' && field.options?.inverseLinkFieldId !== undefined) {
    const other = tablesById.get(field.options.linkedTableId ?? '');
    const inverse = other?.fields.find((f) => f.id === field.options?.inverseLinkFieldId);
    if (other !== undefined && inverse !== undefined) {
      const otherMapping = mappingFor(other.name, template);
      if (otherMapping !== undefined && isMapped(otherMapping.fields[inverse.name])) {
        return { kind: 'reverse', of: `${other.name} › ${inverse.name}` };
      }
    }
  }

  const key = `${table.name} › ${field.name}`;
  if (register.includes(key)) return { kind: 'excluded' };
  const detail =
    entry === undefined ? 'not in TABLE_MAPPINGS' : `skipped: ${entry.note ?? 'no note'}`;
  return {
    kind: 'failure',
    reason: `FIELD WITHOUT MAPPING: ${key} (${field.type}) — ${detail}; map it, or exclude "${key}" in docs/decisions.md`,
  };
}

async function main(): Promise<void> {
  const template = process.argv.includes('--template');
  const baseId = flag('--base') ?? (template ? 'appnaSGAgOUbJ0f9m' : 'appllDG4OmkK2Hdnn');
  const verbose = process.argv.includes('--verbose');
  const pat = serverEnv().AIRTABLE_PAT;
  if (!pat) throw new Error('AIRTABLE_PAT is required (in .env.local)');

  const meta = await fetchMeta(pat, baseId);
  const tablesById = new Map(meta.map((table) => [table.id, table]));
  const register = loadExclusionRegister();
  const importedNames = new Set(Object.values(template ? TEMPLATE_TABLES : GRATSI_TABLES));
  const failures: string[] = [];
  const counts = { mapped: 0, reverse: 0, excluded: 0, computed: 0 };

  for (const table of meta) {
    if (!importedNames.has(table.name)) {
      const key = `${table.name} (table)`;
      if (register.includes(key)) counts.excluded++;
      else
        failures.push(
          `TABLE NOT IMPORTED: ${table.name} (${table.id}) — add it to ${template ? 'TEMPLATE_TABLES' : 'GRATSI_TABLES'}, or exclude "${key}" in docs/decisions.md`,
        );
      continue;
    }
    const mapping = mappingFor(table.name, template);
    if (mapping === undefined) {
      failures.push(
        `TABLE WITHOUT MAPPING: ${table.name} — no TABLE_MAPPINGS entry with ${template ? 'templateTable' : 'airtableTable'} "${table.name}"`,
      );
      continue;
    }
    for (const field of table.fields) {
      const verdict = judge(table, field, mapping, tablesById, register, template);
      if (verdict.kind === 'failure') {
        failures.push(verdict.reason);
        continue;
      }
      counts[verdict.kind]++;
      if (verbose) {
        const how = verdict.kind === 'reverse' ? `reverse of ${verdict.of}` : verdict.kind;
        console.log(`  ${table.name} › ${field.name} (${field.type}): ${how}`);
      }
    }
  }
  for (const name of importedNames) {
    if (!meta.some((table) => table.name === name)) {
      failures.push(`MAPPED TABLE MISSING FROM BASE: ${name}`);
    }
  }

  console.log(
    `Base ${baseId}: ${String(meta.length)} tables — ${String(counts.mapped)} stored fields mapped, ${String(counts.reverse)} record links written from their inverse field, ${String(counts.excluded)} excluded by the docs/decisions.md register, ${String(counts.computed)} computed (not stored by design).`,
  );
  if (failures.length > 0) {
    console.log(`\n${String(failures.length)} parity failure(s):`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    '\n✓ Schema parity holds: every live table and stored field is mapped, written from its inverse link, or explicitly excluded.',
  );
}

await main();
