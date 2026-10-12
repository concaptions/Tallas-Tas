import {
  brands,
  listBrandCustomPages,
  listTemplateCustomPages,
  loadCustomPageRender as dbLoadCustomPageRender,
  loadStandardTabRender as dbLoadStandardTabRender,
  type CustomInterfacePage,
  type Db,
  type StandardTabRender,
} from '@tas/db';
import { STANDARD_PAGE_SOURCE_TABLE, type StandardPageSlug } from '@tas/domain';
import { serverEnv } from '@tas/env';

import { inDemoMode } from './data-source';
import { requestConnection } from '@/lib/request-db';

/**
 * The reads the CLIENT PORTAL layout + the custom-page route run per request.
 *
 * The client portal is a different route tree from `/app` and MUST NOT reach the shipped
 * `data-source.ts` resolver (which reads the Clerk session). It resolves its brand by SLUG
 * alone (see `client-brand-source.ts`); this module takes the resolved `brandId` and reads the
 * two interface tables scoped to it, falling through to the template rows for anything the brand
 * has not overridden.
 */

export interface ClientInterfaceConfig {
  readonly brandId: string;
  /** The brand's own page rows (standard overrides, custom views, module toggles). */
  readonly customPages: readonly CustomInterfacePage[];
  /** The template's page rows, which every brand reads unless it has its own row for the slug. */
  readonly templateCustomPages: readonly CustomInterfacePage[];
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

async function withDb<T>(query: (db: Db) => Promise<T>): Promise<T> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const { db, close } = neonConnection(databaseUrl);
  try {
    return await query(db);
  } finally {
    await close();
  }
}

/** The whole config a client portal layout needs in one call. */
export async function loadClientInterfaceConfig(brandId: string): Promise<ClientInterfaceConfig> {
  if (inDemoMode()) {
    return { brandId, customPages: [], templateCustomPages: [] };
  }
  return withDb(async (db) => {
    const [customPages, templateCustomPages] = await Promise.all([
      listBrandCustomPages(db, brandId),
      listTemplateCustomPages(db),
    ]);
    return { brandId, customPages, templateCustomPages };
  });
}

/** The one-shot read for the custom-page route: config + rows. */
export async function loadCustomPageRender(
  brandId: string,
  slug: string,
): Promise<null | {
  readonly page: CustomInterfacePage;
  readonly rows: readonly Record<string, unknown>[];
}> {
  if (inDemoMode()) return null;
  return withDb((db) => dbLoadCustomPageRender(db, brandId, slug));
}

/**
 * A standard tab's columns and rows for the brand (Part A2, 2026-10-12): the brand's resolved,
 * client-visible, stored columns of the tab's table, as the Interface Config Edit dialog shaped
 * them. Null in demo mode, where the tab keeps its shipped fixed table.
 */
export async function loadStandardTabRender(
  brandId: string,
  slug: StandardPageSlug,
): Promise<StandardTabRender | null> {
  if (inDemoMode()) return null;
  return withDb((db) => dbLoadStandardTabRender(db, brandId, STANDARD_PAGE_SOURCE_TABLE[slug]));
}

export { brands };
