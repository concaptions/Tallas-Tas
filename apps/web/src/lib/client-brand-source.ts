import { brands, createAutoDb, demoBrands, type Db } from '@tas/db';
import { serverEnv } from '@tas/env';

import { isDemoMode } from './demo-mode';

export interface ClientBrand {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

export async function resolveClientBrand(slug: string): Promise<ClientBrand | null> {
  if (isDemoMode()) {
    const match = demoBrands.find((b) => b.slug === slug);
    return match ? { id: match.id, name: match.name, slug: match.slug } : null;
  }

  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    const match = demoBrands.find((b) => b.slug === slug);
    return match ? { id: match.id, name: match.name, slug: match.slug } : null;
  }

  const { db, close } = neonConnection(databaseUrl);
  try {
    const rows = (await db.select().from(brands)).filter(
      (r) => r.slug === slug && r.deletedAt === null,
    );
    const row = rows[0];
    return row ? { id: row.id, name: row.name, slug: row.slug } : null;
  } finally {
    await close();
  }
}

export function defaultDemoSlug(): string {
  return demoBrands[0]?.slug ?? 'niagara-sleep-solutions';
}
