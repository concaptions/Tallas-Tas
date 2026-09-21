import { Pool as NeonPool } from '@neondatabase/serverless';
import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle as drizzleNeon, type NeonClient } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool as PgPool } from 'pg';

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
export type NeonDb<Client extends NeonClient = NeonPool> = ReturnType<
  typeof drizzleNeon<Schema, Client>
>;

/** Shared driver configuration, so every adapter binds the same schema. */
export const drizzleConfig: DrizzleConfig<Schema> = { schema };

/** Binds a client the Neon driver accepts (`Pool`, `PoolClient` or `Client`) to the schema. */
export function createDb<Client extends NeonClient>(client: Client): NeonDb<Client> {
  return drizzleNeon(client, drizzleConfig);
}

/**
 * Neon adapter: a connection pool over WebSocket. Use for Neon-hosted Postgres where the serverless
 * driver's WebSocket transport is available.
 */
export function createNeonDb(databaseUrl: string): NeonDb {
  return createDb(new NeonPool({ connectionString: databaseUrl }));
}

/**
 * Standard Postgres adapter: a connection pool over TCP using node-postgres. Use for Railway,
 * Supabase, self-hosted, or any Postgres that speaks the standard wire protocol. Close it with
 * `db.$client.end()`.
 */
export function createNodeDb(databaseUrl: string) {
  const pool = new PgPool({ connectionString: databaseUrl });
  return Object.assign(drizzleNode(pool, drizzleConfig), {
    $client: pool,
  });
}

/**
 * Auto-detecting adapter: uses the Neon serverless driver for `*.neon.tech` URLs (WebSocket) and
 * the standard node-postgres driver for everything else (TCP). Close with `db.$client.end()`.
 */
export function createAutoDb(databaseUrl: string) {
  if (databaseUrl.includes('.neon.tech')) {
    return createNeonDb(databaseUrl);
  }
  return createNodeDb(databaseUrl);
}
