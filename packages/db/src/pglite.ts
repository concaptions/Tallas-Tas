import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';

import { drizzleConfig, type Schema } from './db';

export type PgliteDb = PgliteDatabase<Schema> & { $client: PGlite };

/** Test adapter: an in-memory Postgres (WASM) that belongs to the caller alone. */
export function createPgliteDb(): PgliteDb {
  return drizzle(new PGlite(), drizzleConfig);
}
