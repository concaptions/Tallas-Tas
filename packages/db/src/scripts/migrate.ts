import { serverEnv } from '@tas/env';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';

import { createNeonDb } from '../db';
import { migrationsFolder } from '../migrations';

/** `pnpm --filter @tas/db db:migrate`: applies every pending migration in `drizzle/` to `DATABASE_URL`. */
async function main(): Promise<void> {
  const db = createNeonDb(serverEnv().DATABASE_URL);
  try {
    await migrate(db, { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);
  } finally {
    await db.$client.end();
  }
}

await main();
