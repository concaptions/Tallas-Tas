import { writeFileSync } from 'node:fs';

import { serverEnv } from '@tas/env';

import type { AirtableRecord } from '../airtable-import';

/**
 * Fetches the Gratsi base into the export-JSON shape `airtable-import.ts` consumes
 * (Sprint 2026-09-29; by-name resolution 2026-10-01). Every table is resolved by its NAME in the
 * base's own metadata — ids collide across the template and Gratsi bases (see airtable-tables.ts). Read-only against Airtable; writes one local file.
 *
 *   pnpm --filter @tas/db airtable-fetch -- --base appllDG4OmkK2Hdnn --out /tmp/gratsi-export.json
 */

import { GRATSI_TABLES, resolveTableIds, type AirtableTableMeta } from '../airtable-tables';

/** The base's own table list, so every table resolves by NAME in that base (never a baked-in id). */
async function fetchTableMeta(pat: string, baseId: string): Promise<AirtableTableMeta[]> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!res.ok) throw new Error(`metadata: HTTP ${String(res.status)} ${await res.text()}`);
  const body = (await res.json()) as { tables: { id: string; name: string }[] };
  return body.tables.map((table) => ({ id: table.id, name: table.name }));
}

function flag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTable(pat: string, baseId: string, tableId: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) throw new Error(`${tableId}: HTTP ${String(res.status)} ${await res.text()}`);
    const body = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...body.records);
    offset = body.offset;
    // Airtable caps at 5 req/s per base; a fixed gap keeps a long fetch well inside it.
    await sleep(250);
  } while (offset);
  return records;
}

async function main(): Promise<void> {
  const baseId = flag('--base');
  const out = flag('--out');
  if (!baseId || !out) {
    console.error('Usage: pnpm --filter @tas/db airtable-fetch -- --base <baseId> --out <path>');
    process.exit(1);
  }
  const pat = serverEnv().AIRTABLE_PAT;
  if (!pat) throw new Error('AIRTABLE_PAT is required (in .env.local)');

  const tableIds = resolveTableIds(await fetchTableMeta(pat, baseId), GRATSI_TABLES, baseId);
  const data: Record<string, AirtableRecord[]> = {};
  for (const [exportKey, tableId] of Object.entries(tableIds)) {
    data[exportKey] = await fetchTable(pat, baseId, tableId);
    console.log(`  ${exportKey}: ${String(data[exportKey].length)} records`);
  }
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`\nWrote ${out}`);
}

await main();
