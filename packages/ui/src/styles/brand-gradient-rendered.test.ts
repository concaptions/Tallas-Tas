import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The third companion to `no-hex.test.ts`: a token with no call site.
 *
 * `--accent-gradient` is the brand itself (client feedback Sep 28: "purple gradient + white"). P2D
 * declared it in all four theme blocks and added the `.bg-brand-gradient` utility — and then nothing
 * used it, so for the whole of the following week the signature gradient rendered on exactly zero
 * pixels while every test and every review passed. Nothing in the suite could notice, because a
 * token is only wrong once you look at the screen.
 *
 * This is the check that would have noticed: the utility must exist, must reference the token rather
 * than a literal, and must be used by a component. It is a guard against the whole class of defect,
 * not against one page — move the gradient from the top bar to the sidebar and this still passes.
 */
const packageRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const repoRoot = resolve(packageRoot, '../..');

const SCANNED_ROOTS = [join(packageRoot, 'src'), join(repoRoot, 'apps/web/src')];
const SCANNED_EXTENSIONS = ['.tsx'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);

const TOKEN = '--accent-gradient';
const UTILITY = 'bg-brand-gradient';
const utilityFile = join(repoRoot, 'apps/web/src/app/globals.css');
const tokensFile = join(packageRoot, 'src/styles/tokens.css');

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

/** Every `className` string that carries the utility, so a bare mention in prose does not count. */
function callSites(): string[] {
  const used: string[] = [];
  for (const file of SCANNED_ROOTS.flatMap(filesUnder)) {
    const source = readFileSync(file, 'utf8');
    for (const className of source.matchAll(/className="([^"]*)"/g)) {
      if (className[1]?.split(/\s+/).includes(UTILITY) === true) {
        used.push(relative(repoRoot, file));
        break;
      }
    }
  }
  return used;
}

describe('the brand gradient', () => {
  /**
   * Four: the dark `:root`, the explicit light theme, the nested dark container the /design-system
   * page uses to show both palettes at once, and the OS light preference. A theme block that
   * forgets it inherits the other theme's purples.
   */
  it('is defined in every theme block', () => {
    const declarations = readFileSync(tokensFile, 'utf8').match(
      new RegExp(`${TOKEN}:\\s*linear-gradient`, 'g'),
    );

    expect(declarations).toHaveLength(4);
  });

  it('is reachable as a utility that references the token, not a literal', () => {
    const utility = readFileSync(utilityFile, 'utf8');

    expect(utility).toContain(`.${UTILITY} {`);
    expect(utility).toContain(`background-image: var(${TOKEN});`);
  });

  it('is rendered by at least one component', () => {
    expect(callSites()).not.toEqual([]);
  });
});
