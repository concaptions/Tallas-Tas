import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

import { clientEnv, type ClientEnv } from './client';
import { parseEnv, serverSchema, type EnvSource, type ServerEnv } from './schema';

/** Repo-root `.env.local`: this file lives at `packages/env/src`, three levels below the root. */
const repoRootEnvLocal = fileURLToPath(new URL('../../../.env.local', import.meta.url));

/** Parses a dotenv file without touching `process.env`; a missing file is an empty source. */
export function loadEnvFile(path: string): EnvSource {
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {};
}

/**
 * Development merges the repo-root `.env.local` under the process environment, so a variable set in
 * the shell still wins. Every other `NODE_ENV` reads the process environment alone.
 */
export function serverSource(env: EnvSource = process.env, envFile = repoRootEnvLocal): EnvSource {
  const nodeEnv = env.NODE_ENV ?? 'development';
  return nodeEnv === 'development' ? { ...loadEnvFile(envFile), ...env } : env;
}

/** Validates the server environment. Runs when called, never at import. */
export function serverEnv(source: EnvSource = serverSource()): ServerEnv {
  return parseEnv(serverSchema, source);
}

export interface Env {
  readonly serverEnv: () => ServerEnv;
  readonly clientEnv: () => ClientEnv;
}

/**
 * Memoising loader for one call site. Each call to `createEnv` owns its own cache, validated on first
 * use; nothing is cached at module level.
 */
export function createEnv(source: EnvSource = serverSource()): Env {
  let server: ServerEnv | undefined;
  let client: ClientEnv | undefined;
  return {
    serverEnv: () => (server ??= serverEnv(source)),
    clientEnv: () => (client ??= clientEnv(source)),
  };
}
