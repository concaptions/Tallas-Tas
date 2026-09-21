import { serverEnv } from '@tas/env';

import { createAutoDb } from '../db';
import { seed } from '../seed';

/** `pnpm --filter @tas/db db:seed`: inserts the development data set into `DATABASE_URL`. */
async function main(): Promise<void> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required to run the seed script.');
  }
  const db = createAutoDb(databaseUrl);
  try {
    for (const [name, value] of Object.entries(await seed(db))) {
      console.log(
        Array.isArray(value)
          ? `Seeded ${String(value.length)} ${name}`
          : `Seeded ${name} ${value.id}`,
      );
    }
  } finally {
    await db.$client.end();
  }
}

await main();
