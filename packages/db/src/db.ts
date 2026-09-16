import { Pool } from '@neondatabase/serverless';
import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle, type NeonClient } from 'drizzle-orm/neon-serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from './schema';

export type Schema = typeof schema;

/**
 * The handle every consumer types against: the common supertype of the Neon (production) and PGlite
 * (test) instances, so queries, `db.transaction(...)` and later `withBrand(...)` are written once.
 * Instances come from `createNeonDb` or `createPgliteDb` (`@tas/db/testing`); none lives at module
 * level.
 */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

/** A Neon-driver instance; `$client` is whatever `createDb` was given (a `Pool` from `createNeonDb`). */
export type NeonDb<Client extends NeonClient = Pool> = ReturnType<typeof drizzle<Schema, Client>>;

/** Shared driver configuration, so every adapter binds the same schema. */
export const drizzleConfig: DrizzleConfig<Schema> = { schema };

/** Binds a client the Neon driver accepts (`Pool`, `PoolClient` or `Client`) to the schema. */
export function createDb<Client extends NeonClient>(client: Client): NeonDb<Client> {
  return drizzle(client, drizzleConfig);
}

/**
 * Production adapter: a connection pool to Neon over WebSocket (Postgres protocol, so
 * `db.transaction(...)` runs BEGIN/COMMIT on one connection; the HTTP driver cannot). Node 22+ has
 * a global `WebSocket`, so no polyfill. Close it with `db.$client.end()` when the process is done.
 */
export function createNeonDb(databaseUrl: string): NeonDb {
  return createDb(new Pool({ connectionString: databaseUrl }));
}
