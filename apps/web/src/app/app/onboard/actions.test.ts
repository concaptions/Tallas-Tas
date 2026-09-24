import { seed } from '@tas/db';
import { testDb, type PgliteDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrandAction } from './actions';

/**
 * The wizard's one Server Action, exercised end to end against PGlite. The DB write itself
 * (`onboardBrand`) is proven in `packages/db/src/onboard.test.ts`; what THIS file pins is the
 * wiring above it — the demo refusal, the validation gate, the `DATABASE_URL` guard whose message
 * a misconfigured deployment shows on the review step, and that a legal submission really lands a
 * brand row in Postgres and redirects.
 */

const holder = vi.hoisted((): { db: unknown } => ({ db: null }));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock('@clerk/nextjs/server', () => {
  const protect = vi.fn((): never => {
    throw new Error('the action reached Clerk');
  });
  return { auth: Object.assign(vi.fn(), { protect }) };
});

vi.mock('@tas/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@tas/db')>();
  return {
    ...mod,
    createAutoDb: vi.fn(() => holder.db as ReturnType<typeof mod.createAutoDb>),
  };
});

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

/** Exactly what the wizard's hidden inputs submit from the review step. */
const filled = {
  name: 'Atlas Coffee',
  slug: 'atlas-coffee',
  website: 'https://atlas.example',
  team: '[]',
};

const AUTHED_SESSION = { userId: 'user_test_1', orgId: 'org_test_1' };

async function clerkProtect() {
  const { auth } = await import('@clerk/nextjs/server');
  return vi.mocked(auth.protect);
}

/**
 * A seeded PGlite world whose agency answers to the test's Clerk organisation, wired into the
 * action through the mocked `createAutoDb`. `$client.end` is stubbed because the action closes a
 * Neon pool in its `finally`; PGlite has no `end` and in-memory instances are simply dropped, the
 * same way every other `testDb()` caller lets go of them.
 */
async function seededWorld(): Promise<PgliteDb> {
  const db = await testDb();
  await seed(db);
  await db.$client.query(
    `UPDATE agencies SET clerk_org_id = '${AUTHED_SESSION.orgId}' WHERE slug = 'tas-digital'`,
  );
  Object.assign(db.$client as object, { end: () => Promise.resolve() });
  holder.db = db;
  return db;
}

afterEach(() => {
  vi.unstubAllEnvs();
  holder.db = null;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses before validation, auth or the database', async () => {
    const result = await createBrandAction(form(filled));

    expect(result).toEqual({
      ok: false,
      errors: [{ field: 'name', message: 'Cannot create brands in demo mode.' }],
    });
  });
});

describe('with Clerk configured', () => {
  function configured(): void {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  }

  it('rejects an illegal slug in validation, before the Clerk mock can throw', async () => {
    configured();

    const result = await createBrandAction(form({ ...filled, slug: 'Not A Slug' }));

    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.field === 'slug')).toBe(true);
  });

  it('names DATABASE_URL and the redeploy remedy when the deployment has no value for it', async () => {
    configured();
    vi.stubEnv('DATABASE_URL', '');
    (await clerkProtect()).mockResolvedValueOnce(
      AUTHED_SESSION as unknown as Awaited<
        ReturnType<typeof import('@clerk/nextjs/server').auth.protect>
      >,
    );

    const result = await createBrandAction(form(filled));

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]?.message).toContain('DATABASE_URL is not set in this deployment');
    expect(result.errors?.[0]?.message).toContain('redeploy');
  });

  it('creates the brand in Postgres, seeds its config, and redirects to the app', async () => {
    configured();
    vi.stubEnv('DATABASE_URL', 'postgresql://stub.invalid/tas');
    (await clerkProtect()).mockResolvedValueOnce(
      AUTHED_SESSION as unknown as Awaited<
        ReturnType<typeof import('@clerk/nextjs/server').auth.protect>
      >,
    );
    const db = await seededWorld();

    await expect(createBrandAction(form(filled))).rejects.toThrow('REDIRECT:/app');

    const brand = await db.$client.query(
      `SELECT name, created_by,
              template_brand_id = (SELECT id FROM brands WHERE is_template) AS from_template
         FROM brands WHERE slug = 'atlas-coffee'`,
    );
    expect(brand.rows).toEqual([
      { name: 'Atlas Coffee', created_by: AUTHED_SESSION.userId, from_template: true },
    ]);

    const pages = await db.$client.query(
      `SELECT count(*)::int AS n FROM interface_pages WHERE brand_id =
         (SELECT id FROM brands WHERE slug = 'atlas-coffee')`,
    );
    expect((pages.rows[0] as { n: number }).n).toBeGreaterThan(0);

    const triggers = await db.$client.query(
      `SELECT count(*)::int AS n FROM notification_settings WHERE brand_id =
         (SELECT id FROM brands WHERE slug = 'atlas-coffee')`,
    );
    expect((triggers.rows[0] as { n: number }).n).toBeGreaterThan(0);
  });
});
