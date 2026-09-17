import { describe, expect, it } from 'vitest';

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_WRITE_HINT } from '@tas/ui';

import {
  DEMO_ACTOR,
  DEMO_MODE_NOTICE,
  DEMO_MUTATION_REFUSED,
  DEMO_WRITE_REFUSAL,
  isDemoMode,
} from './demo-mode';

describe('isDemoMode', () => {
  it('is false when a Clerk publishable key is present', () => {
    expect(isDemoMode({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_demo-mode' })).toBe(false);
  });

  it('is true when the Clerk publishable key is absent', () => {
    expect(isDemoMode({})).toBe(true);
  });

  it('is true when the Clerk publishable key is an empty string (a copied .env.example line)', () => {
    expect(isDemoMode({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '' })).toBe(true);
  });

  it('ignores DATABASE_URL: only the Clerk key decides', () => {
    expect(isDemoMode({ DATABASE_URL: 'postgres://localhost/tas' })).toBe(true);
  });
});

describe('DEMO_ACTOR', () => {
  it('is a stub, not a real user', () => {
    expect(DEMO_ACTOR).toEqual({
      fullName: 'Demo User',
      email: 'demo@tas-digital.com',
      initials: 'DU',
    });
  });

  it('tells the visitor the data is not saved', () => {
    expect(DEMO_MODE_NOTICE).toContain('changes are not saved');
  });
});

/**
 * This sentence used to be declared thirteen times, once per Server Action module, and one of them
 * (Personas) disagreed: a visitor who clicked Save on that panel was told something no other page
 * said. There is one declaration now, and these two tests are what keep it honest — the first that
 * it is the tooltip's sentence, the second that no module has quietly grown its own again.
 */
describe('DEMO_WRITE_REFUSAL', () => {
  it("is the disabled control's tooltip, as a sentence", () => {
    expect(DEMO_WRITE_REFUSAL).toBe(`${DEMO_WRITE_HINT}.`);
  });

  it("is not the source layer's backstop, which nobody should ever read", () => {
    expect(DEMO_WRITE_REFUSAL).not.toBe(DEMO_MUTATION_REFUSED);
  });

  it('is declared once: no Server Action module writes the sentence again', () => {
    const actions = resolve(fileURLToPath(import.meta.url), '../../app/app');
    const offenders: string[] = [];
    const scanned: string[] = [];

    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name === 'actions.ts') {
          scanned.push(relative(actions, path));
          if (readFileSync(path, 'utf8').includes(DEMO_WRITE_REFUSAL)) {
            offenders.push(relative(actions, path));
          }
        }
      }
    };
    walk(actions);

    // Asserted first: an empty scan would make the line below pass on a repository with no
    // Server Actions in it at all, and Personas is the module whose copy had drifted.
    expect(scanned.length).toBeGreaterThan(10);
    expect(scanned).toContain(join('personas', 'actions.ts'));
    expect(offenders).toEqual([]);
  });
});
