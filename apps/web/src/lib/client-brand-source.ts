import { brands, demoBrands, type Db } from '@tas/db';
import { serverEnv } from '@tas/env';
import { cache } from 'react';

import { isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

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
  return requestConnection(databaseUrl);
}

async function resolveClientBrandUncached(slug: string): Promise<ClientBrand | null> {
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
    // The client portal resolves a brand by slug alone, so the filter is the only gate on what a
    // slug can reach. A TEMPLATE brand is the parent every child is seeded from — it is never a
    // client's workspace and must never be served through this door, so it is excluded here beside
    // the soft-delete check. (Filtered in memory rather than a `where` clause because `@tas/web`
    // does not depend on `drizzle-orm` — the same reason `resolveLiveBrand` reads and filters.)
    //
    // This narrows WHAT a slug resolves to; it does not authenticate WHO is asking. Real client
    // authorisation — a per-brand access token or magic link, so a guessed slug is not enough —
    // is the V1 follow-up tracked in the ticket; nothing here should be read as providing it.
    const rows = (await db.select().from(brands)).filter(
      (r) => r.slug === slug && r.deletedAt === null && !r.isTemplate,
    );
    const row = rows[0];
    return row ? { id: row.id, name: row.name, slug: row.slug } : null;
  } finally {
    await close();
  }
}

/**
 * The brand a client-portal URL names, once per request. The brand layout and every section page
 * resolve the same slug, so an uncached lookup ran the brands read twice per page view; React `cache`
 * keys on the slug for the life of one server render (a plain call outside one), so the layout and
 * the page share a single read and nothing is kept between requests.
 */
export const resolveClientBrand = cache(resolveClientBrandUncached);

export function defaultDemoSlug(): string {
  return demoBrands[0]?.slug ?? 'niagara-sleep-solutions';
}
