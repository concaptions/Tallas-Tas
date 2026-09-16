import { describe, expect, it } from 'vitest';

import { DEMO_ACTOR, DEMO_MODE_NOTICE, isDemoMode } from './demo-mode';

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
