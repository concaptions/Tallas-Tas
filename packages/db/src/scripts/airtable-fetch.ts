import { writeFileSync } from 'node:fs';

import { serverEnv } from '@tas/env';

import type { AirtableRecord } from '../airtable-import';

/**
 * Fetches the Gratsi base into the export-JSON shape `airtable-import.ts` consumes
 * (Sprint 2026-09-29). Table IDs, not names, so a rename in Airtable cannot silently
 * drop a table from the export. Read-only against Airtable; writes one local file.
 *
 *   pnpm --filter @tas/db airtable-fetch -- --base appllDG4OmkK2Hdnn --out /tmp/gratsi-export.json
 */

/** exportKey → Airtable table id (Gratsi base appllDG4OmkK2Hdnn, fetched 2026-09-29). */
const TABLES: Record<string, string> = {
  Products: 'tblfvfJMYNBz2OYYw',
  Themes: 'tbl1aFLMJXxhdVKiz',
  'Campaigns & Offers': 'tblRNaWCVa1cCIwLL',
  Personas: 'tblyt7X4VjHxtMDVS',
  Angles: 'tblRlcp1ibmS7U7HG',
  Concepts: 'tbl4UFSFcynlS2Pkn',
  Collections: 'tbl6LBNrRqa6Hh4I2',
  'Creative Briefs': 'tblhU5yVNhVDwykUt',
  Copywriting: 'tblZpBYPTcZcmQ1Kf',
  'Youtube Copywriting': 'tblVR1UmkbDoDzJ7z',
  Creators: 'tblRsVqiqUaZRcQYd',
  'Competitive research': 'tbl9W6v78tKWznN9S',
  'Client Assets Organisation': 'tbldFmPU6AWg62Fll',
  '(Internal) Creative Dimensions': 'tblli0Y76yJvG56zK',
};

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

  const data: Record<string, AirtableRecord[]> = {};
  for (const [exportKey, tableId] of Object.entries(TABLES)) {
    data[exportKey] = await fetchTable(pat, baseId, tableId);
    console.log(`  ${exportKey}: ${String(data[exportKey].length)} records`);
  }
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`\nWrote ${out}`);
}

await main();
