import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FROZEN_PROPAGATION_TABLES, PROPAGATION_TABLES } from './propagation';

/**
 * `creative_sheet_items` and `creative_dimensions` are FROZEN (single-source cutover, 2026-10-09), and
 * `collections` since the Oct 12 client sync (Ticket 1; scanned over APP code only, because the
 * query layer, the junction reads and the importer still join it inside `packages/db`):
 * the Creative Sheet is a view over `creative_briefs`, a creative's ratios live in
 * `creative_briefs.dimensions` (a jsonb string[] the UI reads straight off the brief, no join),
 * and nothing may read or write either old table again until Talal decides their drop. This
 * test reads the import statements of every non-test source file in the repo and fails on any
 * that pulls in one of the Drizzle tables — so a reader or writer cannot come back by accident.
 * The allowlist is the schema itself, the importer (whose blocks are kept but disabled behind
 * `IMPORT_FROZEN_TABLES`), the import-mapping inventory script, the propagation registry and
 * the retired dimensions query layer, which only the redirected `/app/creative-dimensions`
 * workspace ever reached.
 */
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const ALL_ROOTS = [
  'apps/web/src',
  'packages/db/src',
  'packages/domain/src',
  'packages/ui/src',
  'packages/integrations/src',
  'packages/env/src',
].filter((dir) => existsSync(join(REPO_ROOT, dir)));

/** The roots outside the query layer: where a retired table must never be imported again. */
const APP_ROOTS = ALL_ROOTS.filter((dir) => dir !== 'packages/db/src');

/** Each frozen table: the Drizzle symbol a file would import, its schema module's path, and where to look. */
const FROZEN_TABLES = {
  creative_sheet_items: {
    symbol: 'creativeSheetItems',
    module: 'schema/creative-sheet-items',
    roots: ALL_ROOTS,
  },
  creative_dimensions: {
    symbol: 'creativeDimensions',
    module: 'schema/creative-dimensions',
    roots: ALL_ROOTS,
  },
  collections: { symbol: 'collections', module: 'schema/collections', roots: APP_ROOTS },
} as const;

type FrozenTable = keyof typeof FROZEN_TABLES;

const ALLOWED_EVERYWHERE = new Set([
  'packages/db/src/schema/index.ts',
  // The sheet and dimensions import blocks stay, disabled: `IMPORT_FROZEN_TABLES` in airtable-import.ts.
  'packages/db/src/airtable-import.ts',
  // The Airtable → Drizzle mapping inventory, documentation for the importer.
  'packages/db/src/scripts/import-mappings.ts',
  // The propagation registry, which Column Admin keys its known tables off; the engine's write
  // paths skip FROZEN_PROPAGATION_TABLES.
  'packages/db/src/propagation.ts',
]);

const ALLOWED: Readonly<Record<FrozenTable, ReadonlySet<string>>> = {
  creative_sheet_items: new Set(['packages/db/src/schema/creative-sheet-items.ts']),
  creative_dimensions: new Set([
    'packages/db/src/schema/creative-dimensions.ts',
    // The retired query layer. Its only caller is the `/app/creative-dimensions` workspace,
    // which `REMOVED_WORKSPACES` redirects and whose actions refuse via `assertWorkspaceLive`;
    // it leaves with the table.
    'packages/db/src/creative-dimensions.ts',
  ]),
  collections: new Set(),
};

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
  // A real import clause only — `{ … }`, `* as x`, or a default (with an optional `{ … }`) — so a
  // doc comment that says "imports nothing from `apps/web`" can never span to a later statement.
  const pattern =
    /import\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    found.push({ names: match[2] ?? '', from: match[3] ?? '' });
  }
  return found;
}

/**
 * The frozen tables a source file imports: by the Drizzle symbol (from any module, `@tas/db`,
 * `@tas/db/schema` or a relative path alike) or by the schema module's own path.
 */
function frozenTablesImportedBy(source: string): readonly FrozenTable[] {
  const found = imports(source);
  return (Object.keys(FROZEN_TABLES) as FrozenTable[]).filter((table) => {
    const { symbol, module } = FROZEN_TABLES[table];
    const symbolPattern = new RegExp(`\\b${symbol}\\b`);
    const modulePattern = new RegExp(`(^|/)${module}$`);
    return found.some(({ names, from }) => symbolPattern.test(names) || modulePattern.test(from));
  });
}

/** Every non-test source file that imports the table, outside its allowlist. */
function offenders(table: FrozenTable): string[] {
  const out: string[] = [];
  for (const root of FROZEN_TABLES[table].roots) {
    for (const file of sourceFiles(join(REPO_ROOT, root))) {
      const rel = relative(REPO_ROOT, file).split('\\').join('/');
      if (ALLOWED_EVERYWHERE.has(rel) || ALLOWED[table].has(rel)) continue;
      if (frozenTablesImportedBy(readFileSync(file, 'utf8')).includes(table)) out.push(rel);
    }
  }
  return out;
}

describe('the frozen-table import scanner', () => {
  it('catches a fresh import of creative_dimensions by symbol, whichever module it comes from', () => {
    expect(
      frozenTablesImportedBy(`import { creativeDimensions } from '@tas/db/schema';\n`),
    ).toEqual(['creative_dimensions']);
    expect(
      frozenTablesImportedBy(
        `import { and, eq } from 'drizzle-orm';\nimport {\n  creativeBriefs,\n  creativeDimensions,\n} from './schema';\n`,
      ),
    ).toEqual(['creative_dimensions']);
    expect(frozenTablesImportedBy(`import type { creativeDimensions } from '@tas/db';\n`)).toEqual([
      'creative_dimensions',
    ]);
  });

  it('catches a fresh import of the schema module by path', () => {
    expect(
      frozenTablesImportedBy(
        `import { creativeDimensions as dims } from './schema/creative-dimensions';\n`,
      ),
    ).toEqual(['creative_dimensions']);
    expect(
      frozenTablesImportedBy(`import * as sheet from '../schema/creative-sheet-items';\n`),
    ).toEqual(['creative_sheet_items']);
  });

  it('lets the brief’s own dimensions column through: the live read is a column, not a table', () => {
    expect(
      frozenTablesImportedBy(
        `import { creativeBriefs, type CreativeBrief } from '@tas/db/schema';\nconst ratios = (brief: CreativeBrief): string[] => brief.dimensions;\n`,
      ),
    ).toEqual([]);
    // A mention outside an import statement is not an import.
    expect(frozenTablesImportedBy(`// creativeDimensions used to hold these\n`)).toEqual([]);
  });

  it('catches the collections table by its bare symbol but not the demo fixtures or the query helpers', () => {
    expect(frozenTablesImportedBy(`import { collections } from '@tas/db/schema';\n`)).toEqual([
      'collections',
    ]);
    expect(
      frozenTablesImportedBy(`import { collections as rows, products } from '@tas/db';\n`),
    ).toEqual(['collections']);
    expect(
      frozenTablesImportedBy(
        `import { demoCollections, listCollections, type CollectionListRow } from '@tas/db';\n`,
      ),
    ).toEqual([]);
  });
});

describe('collections is frozen: the workspace is retired (Oct 12 client sync, Ticket 1)', () => {
  it('is imported by no app code — the web app, the domain, the UI and the integrations', () => {
    expect(offenders('collections'), 'app files importing the frozen collections table').toEqual(
      [],
    );
  });
});

describe('creative_sheet_items is frozen', () => {
  it('is imported by nothing but the schema, the disabled importer block and the mapping inventory', () => {
    expect(
      offenders('creative_sheet_items'),
      'files importing the frozen creative_sheet_items table',
    ).toEqual([]);
  });

  it('keeps the importer’s sheet block switched off', () => {
    const importer = readFileSync(join(REPO_ROOT, 'packages/db/src/airtable-import.ts'), 'utf8');
    expect(importer).toMatch(/const IMPORT_FROZEN_TABLES = false as boolean;/);
  });
});

describe('creative_dimensions is frozen: dimensions is a COLUMN on the brief, not a table', () => {
  it('is imported by nothing but the schema, the disabled importer block, the inventory and the retired query layer', () => {
    expect(
      offenders('creative_dimensions'),
      'files importing the frozen creative_dimensions table',
    ).toEqual([]);
  });

  it('keeps the frozen tables in the registry but off every propagation write', () => {
    // The registry is also Column Admin's list of known tables, so the entries stay; the engine's
    // three write paths skip FROZEN_PROPAGATION_TABLES.
    expect([...FROZEN_PROPAGATION_TABLES].sort()).toEqual([
      'collections',
      'creative_dimensions',
      'creative_sheet_items',
    ]);
    for (const key of FROZEN_PROPAGATION_TABLES) {
      expect(PROPAGATION_TABLES[key]).toBeDefined();
    }
  });
});
