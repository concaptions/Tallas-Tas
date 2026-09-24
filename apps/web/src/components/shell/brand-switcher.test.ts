import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A source-level guard, in the idiom of `org-switcher.test.ts`: the switcher is a hook-driven Radix
 * menu, so a unit test cannot click it without a renderer — and this app carries none on purpose.
 * What CAN be pinned is the shape that broke it.
 *
 * Brand switching shipped as a `<form action={selectBrandAction.bind(...)}>` wrapping each Radix
 * `DropdownMenuItem`. Selecting an item closes the menu, and closing it unmounts the content before
 * the browser runs the submit button's default action — so the form never submitted. Reproduced
 * against a production Next build: the browser logs "Form submission canceled because the form is
 * not connected", the server logs no action call, and the page stays on the old brand. The same
 * build with the switch in `onSelect` + `startTransition` re-renders on the new brand, repeatedly.
 */
const source = readFileSync(
  resolve(fileURLToPath(import.meta.url), '../brand-switcher.tsx'),
  'utf8',
);
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('brand-switcher.tsx', () => {
  it('renders no <form> inside the menu: a Radix item unmounts it before it can submit', () => {
    expect(code).not.toMatch(/<form[\s>]/);
  });

  it('switches from the item onSelect, inside a transition, calling the server action', () => {
    expect(code).toMatch(/onSelect=\{/);
    expect(code).toMatch(/startTransition\(/);
    expect(code).toMatch(/selectBrandAction\(brand\.id\)/);
  });
});
