import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The commit-3 cardinal rule (docs/design/bold-redesign-spec.md, "Rollout constraints"): the Bold
 * primitive skins restyle DOM that child brands render too, so every selector in `bold.css` must
 * sit under the `[data-ui='bold']` scope the app shell stamps for the template brand alone. One
 * unscoped selector would repaint a child brand. This is the same proof-by-construction the token
 * blocks rely on, made mechanical: strip comments, take every selector line, and require the
 * scope attribute at its head. (`no-hex.test.ts` already scans this file for colour literals.)
 */
const packageRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const boldCss = readFileSync(join(packageRoot, 'src/styles/bold.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Selector headers: everything before a `{` that is not inside a block body. */
function selectors(css: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let buffer = '';
  for (const char of css) {
    if (char === '{') {
      if (depth === 0) {
        found.push(buffer.trim());
      }
      depth += 1;
      buffer = '';
      continue;
    }
    if (char === '}') {
      depth -= 1;
      buffer = '';
      continue;
    }
    if (depth === 0) {
      buffer += char;
    }
  }
  return found;
}

describe('bold.css scoping', () => {
  const headers = selectors(boldCss);

  it('has rules to check', () => {
    expect(headers.length).toBeGreaterThan(5);
  });

  it("scopes every selector under [data-ui='bold'], so child brands are untouched", () => {
    const offences = headers.flatMap((header) =>
      header
        .split(',')
        .map((selector) => selector.trim())
        .filter((selector) => !selector.startsWith("[data-ui='bold']")),
    );
    expect(offences).toEqual([]);
  });

  it('declares no @media or @supports block that could hide an unscoped rule from the scan', () => {
    expect(boldCss).not.toMatch(/@media|@supports|@layer/);
  });
});
