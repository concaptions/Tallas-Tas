import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverEnv } from '@tas/env';

import {
  type AirtableCreatorRow,
  listAirtableCreatorRows,
  parseAirtableSourceBases,
} from './airtable-source-bases';

/**
 * READ-ONLY inventory of the creators in every OTHER client Airtable base listed in
 * `AIRTABLE_SOURCE_BASES` (Oct 8 Talal ask). Touches no Postgres; writes one JSON file that is the
 * input of `import-creators-from-airtable`.
 *
 *   pnpm --filter @tas/db airtable-enumerate-creators -- [--limit N] [--out <path>]
 *
 * A base that fails is logged and the walk continues with the next one; the process still exits 1
 * at the end so a partial inventory is never mistaken for a complete one.
 */
export interface CreatorInventory {
  readonly generatedAt: string;
  readonly bases: readonly {
    readonly baseId: string;
    readonly brandLabel: string;
    readonly count: number;
  }[];
  readonly creators: readonly AirtableCreatorRow[];
}

/** The monorepo root, resolved from this file (packages/db/src/scripts), never from the cwd. */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

export function defaultInventoryPath(date: Date, root: string = REPO_ROOT): string {
  const day = date.toISOString().slice(0, 10);
  return join(root, '.audit-oct8', `airtable-creators-inventory-${day}.json`);
}

export interface EnumerateArgs {
  readonly limit: number | undefined;
  readonly out: string | undefined;
}

export function parseEnumerateArgs(argv: readonly string[]): EnumerateArgs {
  const valueAfter = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const rawLimit = valueAfter('--limit');
  const limit = rawLimit === undefined ? undefined : Number.parseInt(rawLimit, 10);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error(`--limit must be a positive integer, got "${rawLimit ?? ''}"`);
  }
  return { limit, out: valueAfter('--out') };
}

async function main(): Promise<void> {
  const env = serverEnv();
  const bases = parseAirtableSourceBases(env.AIRTABLE_SOURCE_BASES);
  if (bases.length === 0 || env.AIRTABLE_PAT === undefined) {
    console.error(
      'Usage: AIRTABLE_PAT=... AIRTABLE_SOURCE_BASES=\'[{"baseId":"app…","creatorsTableId":"tbl…","brandLabel":"…"}]\' ' +
        'pnpm --filter @tas/db airtable-enumerate-creators -- [--limit N] [--out <path>]\n' +
        'Both variables are required; a base is only read when it is listed in AIRTABLE_SOURCE_BASES.',
    );
    process.exitCode = 1;
    return;
  }
  const args = parseEnumerateArgs(process.argv.slice(2));
  const outPath = args.out ?? defaultInventoryPath(new Date());

  const creators: AirtableCreatorRow[] = [];
  const summary: { baseId: string; brandLabel: string; count: number }[] = [];
  let failed = 0;
  for (const base of bases) {
    try {
      const rows = await listAirtableCreatorRows(env.AIRTABLE_PAT, base, { limit: args.limit });
      creators.push(...rows);
      summary.push({ baseId: base.baseId, brandLabel: base.brandLabel, count: rows.length });
      console.log(
        `${base.brandLabel.padEnd(24)} ${base.baseId}  ${String(rows.length)} creator(s)`,
      );
    } catch (error) {
      failed += 1;
      console.error(
        `${base.brandLabel} (${base.baseId}) FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const inventory: CreatorInventory = {
    generatedAt: new Date().toISOString(),
    bases: summary,
    creators,
  };
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(inventory, null, 2));
  console.log(
    `\n${String(creators.length)} creator(s) from ${String(summary.length)}/${String(bases.length)} base(s) -> ${outPath}`,
  );
  if (failed > 0) {
    console.error(`${String(failed)} base(s) failed; the inventory is incomplete.`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('airtable-enumerate-creators.ts')) await main();
