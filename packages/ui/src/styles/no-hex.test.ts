import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The token layer is non-negotiable: a hex colour literal in a component is a defect (design handoff,
 * and CLAUDE.md "UI governance"). `tokens.css` is the one file allowed to hold one, because it is
 * where the palette is defined.
 */
const packageRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const repoRoot = resolve(packageRoot, '../..');

const SCANNED_ROOTS = [join(packageRoot, 'src'), join(repoRoot, 'apps/web/src')];
const SCANNED_EXTENSIONS = ['.tsx', '.css'];
const ALLOWED = new Set([relative(repoRoot, join(packageRoot, 'src/styles/tokens.css'))]);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);

/** `#fff`, `#ffffff`, `#ffffffff` — but not `#id-selector` or a `#` in prose. */
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

function filesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        found.push(...filesUnder(join(directory, entry.name)));
      }
      continue;
    }
    if (SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      found.push(join(directory, entry.name));
    }
  }
  return found;
}

describe('the token layer', () => {
  const files = SCANNED_ROOTS.flatMap(filesUnder);

  it('finds files to scan in both trees', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const root of SCANNED_ROOTS) {
      expect(files.some((file) => file.startsWith(root))).toBe(true);
    }
  });

  it('holds every colour literal: no hex outside tokens.css', () => {
    const offences: string[] = [];
    for (const file of files) {
      const name = relative(repoRoot, file);
      if (ALLOWED.has(name)) {
        continue;
      }
      const matches = readFileSync(file, 'utf8').match(HEX);
      if (matches !== null) {
        offences.push(`${name}: ${matches.join(', ')}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('keeps the palette in tokens.css, where the hexes are expected', () => {
    const tokens = readFileSync(join(packageRoot, 'src/styles/tokens.css'), 'utf8');
    expect(tokens.match(HEX)?.length ?? 0).toBeGreaterThan(20);
  });
});
