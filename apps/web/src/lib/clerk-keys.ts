import { clientEnv, serverEnv } from '@tas/env';

export interface ClerkKeys {
  readonly publishableKey: string;
  readonly secretKey: string;
}

/**
 * The publishable key in the process environment is the switch for the auth layer (D-008, D-013).
 * Absent, the app runs with no identity provider: the middleware sends every private route to
 * `/sign-in`, the root layout renders no `ClerkProvider` and the sign-in page explains what is
 * missing. Read through `clientEnv()` because the browser bundle reads the same variable.
 */
export function clerkPublishableKey(): string | undefined {
  return clientEnv().NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

/**
 * Both keys, validated, or `undefined` when Clerk is not configured. A publishable key without a
 * secret key is a misconfiguration and throws instead of silently running without auth.
 * `serverEnv()` validates the whole server environment, so `DATABASE_URL` must be valid as well.
 * Clerk's SDK reads `CLERK_SECRET_KEY` from the process environment itself (D-013), so the two
 * variables must live there: `apps/web/.env.local` or the shell for `next dev`, the host in production.
 */
export function clerkKeys(): ClerkKeys | undefined {
  const publishableKey = clerkPublishableKey();
  if (publishableKey === undefined) {
    return undefined;
  }
  const secretKey = serverEnv().CLERK_SECRET_KEY;
  if (secretKey === undefined) {
    throw new Error('CLERK_SECRET_KEY must be set when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.');
  }
  return { publishableKey, secretKey };
}
