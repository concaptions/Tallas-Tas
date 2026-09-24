import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A companion to `no-hex.test.ts`: the same scan, guarding against Tailwind classes that name a
 * token the palette does not define. `text-text1` and the `-fail` colours (`text-fail`, `border-fail`,
 * `bg-fail`) render with NO colour at all — Tailwind emits nothing for an undefined token — so an
 * error message written in `text-fail` is invisible and a heading in `text-text1` inherits whatever
 * sits above it. The palette is `text`, `text2`–`text4`, and `ok`/`warn`/`bad`/`info`; there is no
 * `text1` (it is just `text`) and no `fail` (it is `bad`). These slipped in repeatedly, so the guard
 * is a test rather than a review note.
 */
const packageRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const repoRoot = resolve(packageRoot, '../..');

const SCANNED_ROOTS = [join(packageRoot, 'src'), join(repoRoot, 'apps/web/src')];
const SCANNED_EXTENSIONS = ['.tsx', '.ts'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);

/**
 * The undefined tokens, as they appear in a `className`. `text-text1` with a boundary so it never
 * matches `text-text2`; the three `-fail` colours with the same care. This file names them in
 * strings, so it excludes itself.
 */
const FORBIDDEN = /\b(?:text-text1(?![0-9])|(?:text|border|bg|ring)-fail)\b/g;
const SELF = relative(repoRoot, fileURLToPath(import.meta.url));

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

describe('undefined design tokens', () => {
  const files = SCANNED_ROOTS.flatMap(filesUnder);

  it('names no token the palette does not define', () => {
    const offences: string[] = [];
    for (const file of files) {
      const name = relative(repoRoot, file);
      if (name === SELF) {
        continue;
      }
      const matches = readFileSync(file, 'utf8').match(FORBIDDEN);
      if (matches !== null) {
        offences.push(`${name}: ${[...new Set(matches)].join(', ')}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
