import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the Oct 9 Vercel build failure: `/design-system` is prerendered as a server
 * component tree, and a story passed `onChange` to `RatingStars` (a 'use client' primitive), which
 * React refuses to serialise across the boundary — "Event handlers cannot be passed to Client
 * Component props". The rule this test enforces: in a server module of the design-system page, a
 * function-valued JSX prop (`onX`, `renderX`) may only be handed to a component that is itself a
 * server component. State and callbacks for client primitives live in a small 'use client' demo
 * wrapper (see rating-stars-demo.tsx).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = resolve(HERE, '../../..');
const UI_SRC = resolve(WEB_SRC, '../../../packages/ui/src');

const isClientModule = (source: string): boolean => /^\s*['"]use client['"]/u.test(source);

/** Named exports → source file, for the two places a story can import a component from. */
function componentSourceFile(name: string, importPath: string, from: string): string | null {
  const candidates: string[] = [];
  if (importPath === '@tas/ui') {
    candidates.push(...walk(UI_SRC).filter((file) => /\.tsx$/u.test(file)));
  } else if (importPath.startsWith('@/')) {
    candidates.push(resolve(WEB_SRC, importPath.slice(2)));
  } else if (importPath.startsWith('.')) {
    candidates.push(resolve(dirname(from), importPath));
  } else {
    return null;
  }
  for (const base of candidates) {
    for (const file of [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      join(base, 'index.tsx'),
      join(base, 'index.ts'),
    ]) {
      if (!existsSync(file) || readdirSafe(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (new RegExp(`export (?:function|const) ${name}\\b`, 'u').test(source)) return file;
    }
  }
  return null;
}

function readdirSafe(path: string): boolean {
  try {
    readdirSync(path);
    return true;
  } catch {
    return false;
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** `import { A, B as C } from 'x'` → [{ local: 'A', path: 'x' }, { local: 'C', path: 'x' }]. */
function namedImports(source: string): { local: string; path: string }[] {
  const out: { local: string; path: string }[] = [];
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/gu)) {
    for (const spec of (match[1] ?? '').split(',')) {
      const parts = spec.trim().split(/\s+as\s+/u);
      const local = (parts[1] ?? parts[0] ?? '').trim();
      if (local !== '' && !local.startsWith('type ')) out.push({ local, path: match[2] ?? '' });
    }
  }
  return out;
}

/** Every `<Component … onX={` / `renderX={` occurrence: the component name and the prop. */
function functionPropsOnComponents(source: string): { component: string; prop: string }[] {
  const out: { component: string; prop: string }[] = [];
  for (const match of source.matchAll(/<([A-Z][A-Za-z0-9.]*)\b([^>]*?)(?:\/?>)/gsu)) {
    const attrs = match[2] ?? '';
    for (const prop of attrs.matchAll(/\b((?:on|render)[A-Z][A-Za-z0-9]*)=\{/gu)) {
      out.push({ component: match[1] ?? '', prop: prop[1] ?? '' });
    }
  }
  return out;
}

describe('design-system server modules never hand a function to a client component', () => {
  const files = readdirSync(HERE)
    .filter((name) => /\.(stories\.tsx|tsx)$/u.test(name) && name !== 'layout.tsx')
    .map((name) => join(HERE, name));

  it.each(files.map((file) => [file.slice(HERE.length + 1), file]))('%s', (_, file) => {
    const source = readFileSync(file, 'utf8');
    if (isClientModule(source)) return;
    const imports = new Map(namedImports(source).map((entry) => [entry.local, entry.path]));
    const offenders = functionPropsOnComponents(source).filter(({ component }) => {
      const importPath = imports.get(component);
      if (importPath === undefined) return false;
      const target = componentSourceFile(component, importPath, file);
      return target !== null && isClientModule(readFileSync(target, 'utf8'));
    });
    expect(
      offenders.map((o) => `${o.component} ${o.prop}`),
      'wrap the component in a "use client" demo that owns the state (see rating-stars-demo.tsx)',
    ).toEqual([]);
  });

  it('would have caught the Oct 9 regression', () => {
    const offenders = functionPropsOnComponents(
      '<RatingStars value={4} onChange={() => undefined} label="Editable" />',
    );
    expect(offenders).toEqual([{ component: 'RatingStars', prop: 'onChange' }]);
    const target = componentSourceFile('RatingStars', '@tas/ui', join(HERE, 'ugc.stories.tsx'));
    expect(target).not.toBeNull();
    expect(isClientModule(readFileSync(target ?? '', 'utf8'))).toBe(true);
  });
});
