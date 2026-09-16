import { describe, expect, it } from 'vitest';

import { clientEnv } from './client';

describe('clientEnv', () => {
  it('parses an empty source with NODE_ENV defaulting to development', () => {
    expect(clientEnv({})).toEqual({ NODE_ENV: 'development' });
  });

  it('accepts a publishable key', () => {
    expect(clientEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_1' })).toEqual({
      NODE_ENV: 'development',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_1',
    });
  });

  it('rejects a secret key placed in the publishable slot', () => {
    expect(() => clientEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_1' })).toThrow(
      /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/,
    );
  });

  it('drops server-only variables', () => {
    expect(clientEnv({ DATABASE_URL: 'postgresql://x' })).toEqual({ NODE_ENV: 'development' });
  });
});
