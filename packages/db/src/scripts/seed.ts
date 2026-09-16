import { serverEnv } from '@tas/env';

import { createNeonDb } from '../db';
import { seed } from '../seed';

/** `pnpm --filter @tas/db db:seed`: inserts the development data set into `DATABASE_URL`. */
async function main(): Promise<void> {
  const db = createNeonDb(serverEnv().DATABASE_URL);
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
