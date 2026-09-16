import { migrate } from 'drizzle-orm/pglite/migrator';

import { migrationsFolder } from './migrations';
import { createPgliteDb, type PgliteDb } from './pglite';

export { createPgliteDb } from './pglite';
export type { PgliteDb } from './pglite';

/** A fresh in-memory database with every migration in `drizzle/` applied: one line of test setup. */
export async function testDb(): Promise<PgliteDb> {
  const db = createPgliteDb();
  await migrate(db, { migrationsFolder });
  return db;
}
