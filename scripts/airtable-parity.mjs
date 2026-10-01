/**
 * Schema parity gate: compares the live Gratsi Airtable base against the platform's table and
 * field mappings and fails on anything unmapped that docs/decisions.md does not explicitly exclude.
 *
 * Usage: node scripts/airtable-parity.mjs [--base <baseId>]
 * Needs AIRTABLE_PAT in .env.local. Delegates to the @tas/db script so the mapping tables are
 * read from source, never duplicated here.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'pnpm',
  ['--filter', '@tas/db', 'airtable-parity', '--', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
