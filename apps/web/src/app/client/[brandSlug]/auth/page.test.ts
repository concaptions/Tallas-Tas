import { brands, insertClientToken, seed, type Db } from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import ClientAuthPage from './page';

/**
 * CLIENT-ACCESS-500 (2026-10-11): a VALID magic link answered a 500 ("Application error", digest
 * 2851327881) after the token row's "Last used" had been touched — the auth page, a Server
 * Component, then called `cookies().set()`, which Next 15 allows only in a Server Action or a
 * Route Handler. The page must therefore never set the cookie: with a token it hands off to the
 * `auth/verify` Route Handler (a redirect), which sets the cookie on its own response. This test
 * drives the real page function against PGlite and asserts the hand-off, not a thrown error.
 */
const seam = vi.hoisted((): { db: Db | null; slug: string; brandId: string } => ({
  db: null,
  slug: 'gratsi',
  brandId: '',
}));

vi.mock('@/lib/client-brand-source', () => ({
  resolveClientBrand: (slug: string) =>
    Promise.resolve(
      slug === seam.slug ? { id: seam.brandId, name: 'Gratsi', slug: seam.slug } : null,
    ),
}));
vi.mock('@/lib/request-db', () => ({
  requestConnection: () => {
    if (seam.db === null) throw new Error('the test database is not open');
    return { db: seam.db, close: () => Promise.resolve() };
  },
}));

beforeAll(async () => {
  const db = await testDb();
  await seed(db);
  const gratsi = (await db.select().from(brands)).find((brand) => brand.slug === 'gratsi');
  if (gratsi === undefined) throw new Error('the seed has no gratsi brand');
  seam.db = db;
  seam.brandId = gratsi.id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function validToken(): Promise<string> {
  if (seam.db === null) throw new Error('the test database is not open');
  const token = `tok_${String(Date.now())}_${Math.random().toString(36).slice(2)}`;
  await insertClientToken(seam.db, {
    brandId: seam.brandId,
    token,
    email: 'client@example.com',
    label: 'test',
    expiresAt: new Date(Date.now() + 86_400_000),
    createdBy: 'test',
    updatedBy: 'test',
  });
  return token;
}

describe('the client auth page with a valid token', () => {
  it('redirects (hands off to the verify route) instead of throwing', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const token = await validToken();

    let thrown: unknown = null;
    try {
      await ClientAuthPage({
        params: Promise.resolve({ brandSlug: 'gratsi' }),
        searchParams: Promise.resolve({ token }),
      });
    } catch (error) {
      thrown = error;
    }

    const digest = (thrown as { digest?: unknown } | null)?.digest;
    expect(typeof digest === 'string' ? digest : String(thrown)).toContain('NEXT_REDIRECT');
    expect(String(digest)).toContain(`/client/gratsi/auth/verify?token=${token}`);
  });
});
