import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FROZEN_PROPAGATION_TABLES, PROPAGATION_TABLES } from './propagation';

/**
 * `creative_sheet_items` is FROZEN (single-source cutover, 2026-10-09): the Creative Sheet is a
 * view over `creative_briefs`, and nothing may read or write the old table again until Talal
 * decides its drop. This test reads the import statements of every non-test source file in the
 * repo and fails on any that pulls in the Drizzle table — so a reader or writer cannot come back
 * by accident. The allowlist is the schema itself, the importer (whose sheet block is kept but
 * disabled behind `IMPORT_FROZEN_TABLES`) and the import-mapping inventory script.
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
  'packages/db/src/schema/index.ts',
  'packages/db/src/schema/creative-sheet-items.ts',
  // The sheet import block stays, disabled: `IMPORT_FROZEN_TABLES` in airtable-import.ts.
  'packages/db/src/airtable-import.ts',
  // The Airtable → Drizzle mapping inventory, documentation for the importer.
  'packages/db/src/scripts/import-mappings.ts',
  // The propagation registry, which Column Admin keys its known tables off; the engine's write
  // paths skip FROZEN_PROPAGATION_TABLES.
  'packages/db/src/propagation.ts',
]);

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

/** Every `import … from '…'` statement of a file, with its specifier list and module path. */
function imports(source: string): readonly { readonly names: string; readonly from: string }[] {
  const found: { names: string; from: string }[] = [];
  const pattern = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    found.push({ names: match[2] ?? '', from: match[3] ?? '' });
  }
  return found;
}

function importsFrozenTable(source: string): boolean {
  return imports(source).some(
    ({ names, from }) =>
      /\bcreativeSheetItems\b/.test(names) || /(^|\/)schema\/creative-sheet-items$/.test(from),
  );
}

describe('creative_sheet_items is frozen', () => {
  it('is imported by nothing but the schema, the disabled importer block and the mapping inventory', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of sourceFiles(join(REPO_ROOT, root))) {
        const rel = relative(REPO_ROOT, file).split('\\').join('/');
        if (ALLOWED.has(rel)) continue;
        if (importsFrozenTable(readFileSync(file, 'utf8'))) offenders.push(rel);
      }
    }
    expect(offenders, 'files importing the frozen creative_sheet_items table').toEqual([]);
  });

  it('keeps the importer’s sheet block switched off', () => {
    const importer = readFileSync(join(REPO_ROOT, 'packages/db/src/airtable-import.ts'), 'utf8');
    expect(importer).toMatch(/const IMPORT_FROZEN_TABLES = false as boolean;/);
  });

  it('keeps the frozen tables in the registry but off every propagation write', () => {
    // The registry is also Column Admin's list of known tables, so the entries stay; the engine's
    // three write paths skip FROZEN_PROPAGATION_TABLES.
    expect([...FROZEN_PROPAGATION_TABLES].sort()).toEqual([
      'creative_dimensions',
      'creative_sheet_items',
    ]);
    for (const key of FROZEN_PROPAGATION_TABLES) {
      expect(PROPAGATION_TABLES[key]).toBeDefined();
    }
  });
});
