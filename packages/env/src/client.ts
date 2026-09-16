// Browser-safe entry (`@tas/env/client`): no Node imports, so Next.js can bundle it for the client.
import { clientSchema, parseEnv, type ClientEnv, type EnvSource } from './schema';

export type { ClientEnv, EnvSource } from './schema';

/**
 * Reads each public variable through a literal `process.env.NAME` expression. Next.js replaces those
 * expressions with their build-time values in the browser bundle; a dynamic lookup would stay empty.
 */
export function clientSource(): EnvSource {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  };
}

/** Validates the browser-visible variables. Runs when called, never at import. */
export function clientEnv(source: EnvSource = clientSource()): ClientEnv {
  return parseEnv(clientSchema, source);
}
