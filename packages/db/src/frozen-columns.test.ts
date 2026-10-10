import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * `concepts.approval_status` is FROZEN (SMOKE-18, Talal's Option B, 2026-10-11): migration 0064
 * copied its values into `client_approval_status`, the one client vocabulary, and every reader and
 * writer moved — the detail page, the importer, the dashboard count, the client portal and the
 * grid. The column stays in the table (data kept, never dropped) but NO source may name it again:
 * a writer would re-diverge the two columns and silently undo the backfill, a reader would show
 * stale import-era values. This test reads every non-test source file in the repo, strips its
 * comments, and fails on any mention of the column outside the three places that must name it —
 * the Drizzle schema, the vocabulary it is typed with, and the column seed that keeps it hidden.
 */
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const SCAN_ROOTS = [
  'apps/web/src',
  'packages/db/src',
  'packages/domain/src',
  'packages/ui/src',
  'packages/integrations/src',
  'packages/env/src',
].filter((dir) => existsSync(join(REPO_ROOT, dir)));

const ALLOWED = new Set([
  // The column itself: kept, never dropped.
  'packages/db/src/schema/concepts.ts',
  // The legacy vocabulary the column is typed with (its labels, for the data that stays).
  'packages/db/src/schema/enums.ts',
  // The hidden column-definition rows (template + Gratsi) that keep it out of every grid.
  'packages/db/src/column-seed.ts',
  // The demo fixtures are FULL-ROW literals (`ConceptListRow[]`), compared row for row with the
  // seeded database, so they must spell every column — this one as `null`, never a value.
  'packages/db/src/demo-data.ts',
]);

const LEGACY_COLUMN = /\bapprovalStatus\b|\bapproval_status\b/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules') continue;
      out.push(...sourceFiles(path));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.(test|spec|stories)\.(ts|tsx)$/.test(entry)) continue;
    out.push(path);
  }
  return out;
}

/** The file without its comments, so a decision note that names the column is not a mention. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

describe('concepts.approval_status is frozen', () => {
  it('is named by no non-test source outside the schema, its vocabulary and the hidden seed rows', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of sourceFiles(join(REPO_ROOT, root))) {
        const path = relative(REPO_ROOT, file);
        if (ALLOWED.has(path)) continue;
        if (LEGACY_COLUMN.test(withoutComments(readFileSync(file, 'utf8')))) offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is only ever NULL in the demo fixtures (a full-row literal, not a value written)', () => {
    const fixtures = withoutComments(
      readFileSync(join(REPO_ROOT, 'packages/db/src/demo-data.ts'), 'utf8'),
    );
    const mentions = fixtures.match(/approvalStatus:\s*[^,\n]+/g) ?? [];
    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions.every((mention) => /approvalStatus:\s*null$/.test(mention))).toBe(true);
  });

  it('still exists in the schema, so the data 0064 read is not dropped', () => {
    const schema = readFileSync(join(REPO_ROOT, 'packages/db/src/schema/concepts.ts'), 'utf8');
    expect(schema).toContain("text('approval_status')");
  });
});
