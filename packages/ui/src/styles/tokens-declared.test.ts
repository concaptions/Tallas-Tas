import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The fourth companion to `no-hex.test.ts`: a token declared in SOME theme blocks.
 *
 * Ticket 0 (`docs/sprint-oct12-ui-gap.md`, "Token gap") added four tokens the boards need and the
 * palette did not have: `--on-accent`, `--on-ok`, `--shadow-float`, `--shadow-sheet`. A token that is
 * declared on `:root` but forgotten in a light block inherits the DARK value inside a light
 * container — a white-on-white shadow, or a smear of `--bg-deep` on a white surface — and nothing in
 * the suite can notice, because the class compiles either way. This pins the four blocks, the
 * `@theme inline` registration that makes the Tailwind class exist at all, and the shadcn alias
 * that the vendored primitives read.
 */
const packageRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const tokensFile = join(packageRoot, 'src/styles/tokens.css');
// Comments stripped first: a `}` quoted in prose must not end a block early.
const tokens = readFileSync(tokensFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const NEW_TOKENS = ['--on-accent', '--on-ok', '--shadow-float', '--shadow-sheet'] as const;

/**
 * The four theme blocks, each found by its selector line. `:root {` appears twice (the palette and
 * the shadcn aliases), so the palette block is the FIRST match. A body runs to its first `}`;
 * nothing inside a block nests braces.
 */
const THEME_BLOCKS = {
  'dark (:root)': /^:root \{/m,
  "explicit light ([data-theme='light'])": /^\[data-theme='light'\] \{/m,
  "nested dark ([data-theme='dark'])": /^\[data-theme='dark'\] \{/m,
  'OS light (prefers-color-scheme)': /^ {2}:root:not\(\[data-theme='dark'\]\) \{/m,
} as const;

function blockBody(selector: RegExp): string {
  const match = selector.exec(tokens);
  if (match === null) {
    throw new Error(`tokens.css has no block matching ${String(selector)}`);
  }
  const start = match.index + match[0].length;
  const end = tokens.indexOf('}', start);
  return tokens.slice(start, end);
}

function declaredValue(body: string, token: string): string | null {
  const declaration = new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm').exec(body);
  return declaration?.[1]?.trim() ?? null;
}

describe('the Ticket 0 tokens', () => {
  const bodies = Object.entries(THEME_BLOCKS).map(
    ([name, selector]) => [name, blockBody(selector)] as const,
  );

  for (const token of NEW_TOKENS) {
    it(`declares ${token} in every theme block`, () => {
      for (const [name, body] of bodies) {
        expect(declaredValue(body, token), `${token} in the ${name} block`).not.toBeNull();
      }
    });
  }

  it('gives both ink tokens one value in every block: neither is re-themed', () => {
    for (const token of ['--on-accent', '--on-ok'] as const) {
      const values = new Set(bodies.map(([, body]) => declaredValue(body, token)));
      expect([...values], token).toHaveLength(1);
    }
  });

  it('keeps each shadow geometry across themes and swaps only the cast colour', () => {
    for (const [name, body] of bodies) {
      const light = name.includes('light');
      const float = declaredValue(body, '--shadow-float');
      const sheet = declaredValue(body, '--shadow-sheet');

      expect(float, `--shadow-float in ${name}`).toMatch(/^0 16px 40px color-mix\(/);
      expect(sheet, `--shadow-sheet in ${name}`).toMatch(/^-18px 0 44px color-mix\(/);
      // Light casts the palette's darkest ink (`--text`), dark casts `--bg-deep`; no literal either way.
      const cast = light ? 'var(--text)' : 'var(--bg-deep)';
      expect(float).toContain(cast);
      expect(sheet).toContain(cast);
    }
  });

  it('registers each under @theme inline so the Tailwind class compiles', () => {
    const theme = blockBody(/^@theme inline \{/m);

    expect(declaredValue(theme, '--color-on-accent')).toBe('var(--on-accent)');
    expect(declaredValue(theme, '--color-on-ok')).toBe('var(--on-ok)');
    expect(declaredValue(theme, '--shadow-float')).toBe('var(--shadow-float)');
    expect(declaredValue(theme, '--shadow-sheet')).toBe('var(--shadow-sheet)');
  });

  it('points the shadcn --primary-foreground alias at --on-accent, so a vendored primitive agrees', () => {
    expect(tokens).toMatch(/^\s*--primary-foreground:\s*var\(--on-accent\);/m);
  });
});
