import { describe, expect, it } from 'vitest';

import { DEFAULT_E2E_USER_EMAIL, liveE2eEnv } from './live-e2e-env';

const all = {
  NODE_ENV: 'test',
  CLERK_PUBLISHABLE_KEY_TEST: 'pk_test_1',
  CLERK_SECRET_KEY_TEST: 'sk_test_1',
  CLERK_E2E_USER_PASSWORD: 'pw',
  DATABASE_URL_E2E: 'postgresql://e2e@db.example.neon.tech/e2e',
};

describe('liveE2eEnv', () => {
  it('is undefined when none of the four variables is set (demo mode)', () => {
    expect(liveE2eEnv({ NODE_ENV: 'test' })).toBeUndefined();
    expect(liveE2eEnv({ NODE_ENV: 'test', CLERK_E2E_USER_EMAIL: 'x@example.com' })).toBeUndefined();
  });

  it('returns the keys, database and the default user when all four are set', () => {
    expect(liveE2eEnv(all)).toEqual({
      publishableKey: 'pk_test_1',
      secretKey: 'sk_test_1',
      databaseUrl: 'postgresql://e2e@db.example.neon.tech/e2e',
      userPassword: 'pw',
      userEmail: DEFAULT_E2E_USER_EMAIL,
    });
  });

  it('takes the user address from CLERK_E2E_USER_EMAIL when set', () => {
    expect(
      liveE2eEnv({ ...all, CLERK_E2E_USER_EMAIL: 'qa+clerk_test@example.com' })?.userEmail,
    ).toBe('qa+clerk_test@example.com');
  });

  it('throws naming the missing variables when only some are set', () => {
    expect(() => liveE2eEnv({ NODE_ENV: 'test', CLERK_PUBLISHABLE_KEY_TEST: 'pk_test_1' })).toThrow(
      /missing: CLERK_SECRET_KEY_TEST, CLERK_E2E_USER_PASSWORD, DATABASE_URL_E2E/,
    );
  });

  it('treats an empty string as unset', () => {
    expect(() => liveE2eEnv({ ...all, DATABASE_URL_E2E: '' })).toThrow(/missing: DATABASE_URL_E2E/);
  });
});
