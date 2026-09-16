import { serverEnv } from '@tas/env';

import { createNeonDb } from '../db';
import { seed } from '../seed';

/** `pnpm --filter @tas/db db:seed`: inserts one `health_check` row into `DATABASE_URL`. */
async function main(): Promise<void> {
  const db = createNeonDb(serverEnv().DATABASE_URL);
  try {
    const row = await seed(db);
    console.log(`Seeded health_check ${row.id}`);
  } finally {
    await db.$client.end();
  }
}

await main();
