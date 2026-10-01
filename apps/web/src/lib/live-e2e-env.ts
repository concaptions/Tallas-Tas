import { serverEnv, type EnvSource } from '@tas/env';

export interface LiveE2eEnv {
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly databaseUrl: string;
  readonly userEmail: string;
  readonly userPassword: string;
}

/** The four variables, named exactly as the GitHub Actions secrets (docs/runbook.md). */
export const LIVE_E2E_VARIABLES = [
  'CLERK_PUBLISHABLE_KEY_TEST',
  'CLERK_SECRET_KEY_TEST',
  'CLERK_E2E_USER_PASSWORD',
  'DATABASE_URL_E2E',
] as const;

/**
 * The pre-created E2E user on the Clerk dev instance. A `+clerk_test` address is Clerk's test mode:
 * the instance never emails it. Overridden by `CLERK_E2E_USER_EMAIL`, which is not a secret.
 */
export const DEFAULT_E2E_USER_EMAIL = 'tas-e2e+clerk_test@example.com';

/**
 * The live-mode variables, all four or none. None present is demo mode: the Clerk-gated tests skip
 * themselves (D-008). Some present is a misconfiguration (a secret not added, a typo in the
 * workflow), so this throws naming the absent ones and the run fails loudly instead of skipping a
 * test it was meant to run — a test that is green only locally is the failure mode this guards.
 */
export function liveE2eEnv(source?: EnvSource): LiveE2eEnv | undefined {
  const env = source === undefined ? serverEnv() : serverEnv(source);
  const missing = LIVE_E2E_VARIABLES.filter((name) => env[name] === undefined);
  if (missing.length === LIVE_E2E_VARIABLES.length) {
    return undefined;
  }
  const publishableKey = env.CLERK_PUBLISHABLE_KEY_TEST;
  const secretKey = env.CLERK_SECRET_KEY_TEST;
  const userPassword = env.CLERK_E2E_USER_PASSWORD;
  const databaseUrl = env.DATABASE_URL_E2E;
  if (
    publishableKey === undefined ||
    secretKey === undefined ||
    userPassword === undefined ||
    databaseUrl === undefined
  ) {
    throw new Error(
      `Playwright live mode needs all of ${LIVE_E2E_VARIABLES.join(', ')}; missing: ${missing.join(', ')} (docs/runbook.md, "Playwright live mode").`,
    );
  }
  return {
    publishableKey,
    secretKey,
    databaseUrl,
    userPassword,
    userEmail: env.CLERK_E2E_USER_EMAIL ?? DEFAULT_E2E_USER_EMAIL,
  };
}
