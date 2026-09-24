import { createAutoDb, type Db } from '@tas/db';
import { after } from 'next/server';
import { cache } from 'react';

/** An open database handle and the way to close it again — the shape every `*-source.ts` takes. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * ONE database handle per server request, shared by every loader that request runs.
 *
 * Before this, each loader opened its own node-postgres pool and ended it in a `finally`: a full
 * Overview load opened six pools and roughly two dozen physical connections to Railway, and every one
 * paid the TCP + startup/auth handshake again. Measured from the `fra1` functions that is about
 * 0.8–1.0 s per fresh connection (the database is not co-located; see docs/decisions.md D-031), so
 * the handshakes, not the SQL, were the page.
 *
 * `cache` makes the handle per REQUEST, not per process: React keys the memo on the render's request
 * storage, so two requests never share a pool and nothing survives the response — the CLAUDE.md rule
 * against shared mutable module state and module-level singletons still holds, and `createAutoDb`
 * stays the factory. The pool is ended by `after`, which runs once the response has been sent, so
 * closing it costs the user nothing and no loader can close it under another.
 *
 * Where React does not memoize — a Server Action, which runs outside the render's cache scope —
 * each call gets its own pool, still ended by `after`: correct, just not deduplicated. Unit tests
 * never reach this; every source takes an injected `connect` seam, and `after` would throw outside a
 * request scope by design.
 */
const requestDb = cache((databaseUrl: string): Db => {
  const db = createAutoDb(databaseUrl);
  after(() => db.$client.end());
  return db;
});

/**
 * The request's connection, in the `DbConnection` shape the sources already take. `close` is a
 * no-op on purpose: the request owns the pool and `after` ends it; a loader closing it in its
 * `finally` would pull it out from under every other loader still running in the same render.
 */
export function requestConnection(databaseUrl: string): DbConnection {
  return { db: requestDb(databaseUrl), close: () => Promise.resolve() };
}
