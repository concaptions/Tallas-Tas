import type { Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClientTokenAction } from './token-actions';

/**
 * The Client Access magic link must open the portal: `/client/<brandSlug>/auth/verify?token=…`, because
 * `resolveClientBrand` resolves the portal's brand BY SLUG. The generator wrote the brand's UUID in
 * that position, so every generated link answered "Brand Not Found" (2026-10-11). Seams: the brand
 * scope, Clerk, and the two `@tas/db` reads/writes the action makes.
 */
const BRAND_ID = '11111111-1111-4111-8111-111111111113';

const seam = vi.hoisted((): { inserted: Record<string, unknown>[] } => ({ inserted: [] }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: 'user_admin' }),
}));
vi.mock('@/lib/interface-config-source', () => ({
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, BRAND_ID),
}));
vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  brandSlugById: (_db: Db, id: string) => Promise.resolve(id === BRAND_ID ? 'gratsi' : null),
  insertClientToken: (_db: Db, input: Record<string, unknown>) => {
    seam.inserted.push(input);
    return Promise.resolve({ id: 'token-row-1', ...input });
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  seam.inserted = [];
});

describe('createClientTokenAction', () => {
  it('builds the magic link on the brand SLUG, the portal route’s key, never the id', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createClientTokenAction(BRAND_ID, 'client@example.com', 'Cowork');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.magicLinkUrl.startsWith('/client/gratsi/auth/verify?token=')).toBe(true);
    expect(result.magicLinkUrl).not.toContain(BRAND_ID);
    expect(seam.inserted).toHaveLength(1);
    expect(seam.inserted[0]).toMatchObject({ brandId: BRAND_ID, email: 'client@example.com' });
  });
});
