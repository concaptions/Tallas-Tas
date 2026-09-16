import type { Db } from './db';
import { healthCheck, type HealthCheck } from './schema';

/** Inserts one `health_check` row and returns it. Run by `db:seed` and by the PGlite test. */
export async function seed(db: Db): Promise<HealthCheck> {
  const [row] = await db
    .insert(healthCheck)
    .values({ note: 'seeded by @tas/db db:seed' })
    .returning();
  if (row === undefined) {
    throw new Error('health_check insert returned no row');
  }
  return row;
}
