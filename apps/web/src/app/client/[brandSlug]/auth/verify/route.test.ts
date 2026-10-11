import { brands, clientAccessTokens, insertClientToken, seed, type Db } from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

/**
 * The magic link's landing, end to end against PGlite: a valid token answers a 307 into the portal
 * WITH the token cookie on the response (the one place Next 15 lets it be set), touches the token's
 * last-used time, and every refusal is a 307 back to the auth page naming its reason — never a
 * thrown error (CLIENT-ACCESS-500, 2026-10-11).
 */
const seam = vi.hoisted((): { db: Db | null; brandId: string } => ({ db: null, brandId: '' }));

vi.mock('@/lib/client-brand-source', () => ({
  resolveClientBrand: (slug: string) =>
    Promise.resolve(slug === 'gratsi' ? { id: seam.brandId, name: 'Gratsi', slug } : null),
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

async function token(expiresAt = new Date(Date.now() + 86_400_000)): Promise<string> {
  if (seam.db === null) throw new Error('the test database is not open');
  const value = `tok_${String(Date.now())}_${Math.random().toString(36).slice(2)}`;
  await insertClientToken(seam.db, {
    brandId: seam.brandId,
    token: value,
    email: 'client@example.com',
    label: 'test',
    expiresAt,
    createdBy: 'test',
    updatedBy: 'test',
  });
  return value;
}

function get(slug: string, query: string): Promise<Response> {
  return GET(new Request(`https://portal.example/client/${slug}/auth/verify${query}`), {
    params: Promise.resolve({ brandSlug: slug }),
  });
}

describe('GET /client/[brandSlug]/auth/verify', () => {
  it('a valid token: 307 into the portal, the token cookie set on the response, last-used touched', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const value = await token();

    const response = await get('gratsi', `?token=${value}`);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/client/gratsi');
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`tas_client_token=${value}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/client');
    if (seam.db === null) throw new Error('the test database is not open');
    const row = (await seam.db.select().from(clientAccessTokens)).find((r) => r.token === value);
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it('refuses back to the auth page with a reason: missing, unknown brand, expired, wrong brand', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const location = async (slug: string, query: string) => {
      const response = await get(slug, query);
      expect(response.status).toBe(307);
      expect(response.headers.get('set-cookie')).toBeNull();
      const url = new URL(response.headers.get('location') ?? '');
      return `${url.pathname}?${url.searchParams.get('reason') ?? ''}`;
    };
    expect(await location('gratsi', '')).toBe('/client/gratsi/auth?missing');
    expect(await location('nobody', '?token=x')).toBe('/client/nobody/auth?brand');
    expect(await location('gratsi', '?token=not-a-token')).toBe('/client/gratsi/auth?expired');
    expect(await location('gratsi', `?token=${await token(new Date(Date.now() - 1000))}`)).toBe(
      '/client/gratsi/auth?expired',
    );
  });
});
