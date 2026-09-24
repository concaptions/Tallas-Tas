import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A source-level guard, in the idiom of `packages/ui/src/styles/no-hex.test.ts`: the components in
 * `org-switcher.tsx` are Clerk widgets driven by hooks, so a unit test cannot call them outside a
 * renderer — and this app carries no renderer on purpose. What CAN be asserted is the one prop that
 * broke them.
 *
 * `hidePersonal` shipped on the switcher and rendered it blank. Its documented behaviour in
 * `@clerk/shared` is the inverse of its name ("@default true … Setting this to `false` will hide the
 * personal account entry"), and with the personal entry suppressed a user with no ACTIVE
 * organization gave the trigger nothing to draw — so the control the person needed in order to
 * choose an organization was the one thing they could not see.
 */
const source = readFileSync(resolve(fileURLToPath(import.meta.url), '../org-switcher.tsx'), 'utf8');

describe('org-switcher.tsx', () => {
  it('never passes hidePersonal: it renders the control blank when no organization is active', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/hidePersonal/);
  });

  it('uses OrganizationList for the no-organization case, not a switcher with nothing to switch', () => {
    expect(source).toMatch(/OrganizationList/);
  });

  it('refreshes after setActive, so the server re-renders with the organization in session', () => {
    expect(source).toMatch(/router\.refresh\(\)/);
  });
});
