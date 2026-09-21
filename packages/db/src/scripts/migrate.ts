import { serverEnv } from '@tas/env';
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator';
import { migrate as migrateNode } from 'drizzle-orm/node-postgres/migrator';

import { createAutoDb } from '../db';
import { migrationsFolder } from '../migrations';

/** `pnpm --filter @tas/db db:migrate`: applies every pending migration in `drizzle/` to `DATABASE_URL`. */
async function main(): Promise<void> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }
  const db = createAutoDb(databaseUrl);
  const isNeon = databaseUrl.includes('.neon.tech');
  const migrate = isNeon ? migrateNeon : migrateNode;
  try {
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);
  } finally {
    await db.$client.end();
  }
}

await main();
