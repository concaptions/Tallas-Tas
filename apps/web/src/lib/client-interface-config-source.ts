import {
  brands,
  listBrandCustomPages,
  listTabVisibility,
  listTemplateCustomPages,
  loadCustomPageRender as dbLoadCustomPageRender,
  resolveTemplateBrandFromAny,
  type CustomInterfacePage,
  type Db,
  type InterfaceTabVisibility,
} from '@tas/db';
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
  readonly tabRows: readonly InterfaceTabVisibility[];
  readonly templateTabRows: readonly InterfaceTabVisibility[];
  readonly customPages: readonly CustomInterfacePage[];
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
    return {
      brandId,
      tabRows: [],
      templateTabRows: [],
      customPages: [],
      templateCustomPages: [],
    };
  }
  return withDb(async (db) => {
    const templateBrandId = await resolveTemplateBrandFromAny(db, brandId);
    const [tabRows, templateTabRows, customPages, templateCustomPages] = await Promise.all([
      listTabVisibility(db, brandId),
      templateBrandId === null ? Promise.resolve([]) : listTabVisibility(db, templateBrandId),
      listBrandCustomPages(db, brandId),
      listTemplateCustomPages(db),
    ]);
    return { brandId, tabRows, templateTabRows, customPages, templateCustomPages };
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

export { brands };
