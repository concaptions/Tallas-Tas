import { customInterfacePages, listMergedPages, seed, type Db } from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPageAction, setPageVisibilityAction } from './page-actions';

/**
 * The Pages section's visibility switch, end to end against a REAL database (PGlite): the action
 * receives the exact `FormData` the client posts (`slug`, `isVisible: 'true' | 'false'`) and the
 * brand's merged row must flip. Only the request-bound seams are mocked — the Next cache, Clerk,
 * the brand scope (which would open a live connection), the agency id and the team read — the
 * zod shape, the page writers and the merge are the real ones.
 *
 * SMOKE-23 (2026-10-11): toggle → reset → toggle again failed in production with "The page
 * visibility could not be saved" — the reset soft-deletes the brand row and the next toggle's
 * INSERT collided with the `(brand_id, slug)` unique index. The sequence below is that path.
 */
const seam = vi.hoisted((): { db: Db | null; brandId: string } => ({ db: null, brandId: '' }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: 'user_admin' }),
}));
vi.mock('@/lib/interface-config-pages-source', () => ({
  withInterfacePagesScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> => {
    if (seam.db === null) throw new Error('the test database is not open');
    return run(seam.db, seam.brandId);
  },
}));
vi.mock('@/lib/data-source', () => ({ resolveLiveAgencyId: () => Promise.resolve('agency-1') }));
vi.mock('@/lib/team-actor', () => ({
  teamPageActorFrom: () => ({ agencyRole: 'admin', brandRoles: [] }),
}));
vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  listTeam: () => Promise.resolve([{ clerkUserId: 'user_admin' }]),
}));

/** Exactly what `pages-section.tsx` appends before calling the action. */
function post(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.append(key, value);
  return fd;
}

async function calendarRow(): Promise<{ isVisible: boolean; brandOwn: boolean } | undefined> {
  if (seam.db === null) throw new Error('the test database is not open');
  const winner = (await listMergedPages(seam.db, seam.brandId)).find(
    (row) => row.slug === 'calendar',
  );
  return winner === undefined
    ? undefined
    : { isVisible: winner.isVisible, brandOwn: winner.brandId === seam.brandId };
}

beforeAll(async () => {
  const db = await testDb();
  const { childBrand } = await seed(db);
  // The template's standard Calendar row exactly as migration 0063 wrote it (column_config '[]').
  await db.insert(customInterfacePages).values({
    brandId: null,
    slug: 'calendar',
    title: 'Calendar',
    sourceTableKey: 'campaigns_offers',
    filterConfig: {},
    columnConfig: [],
    sortOrder: 5,
    isVisible: true,
    isInherited: true,
    pageKind: 'standard',
    createdBy: 'migration:0063',
    updatedBy: 'migration:0063',
  });
  seam.db = db;
  seam.brandId = childBrand.id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('setPageVisibilityAction with the client payload', () => {
  it('flips Calendar off, resets it, and flips it off AGAIN without a save failure', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    expect(await calendarRow()).toEqual({ isVisible: true, brandOwn: false });

    const off = await setPageVisibilityAction(null, post({ slug: 'calendar', isVisible: 'false' }));
    expect(off).toMatchObject({ ok: true });
    expect(await calendarRow()).toEqual({ isVisible: false, brandOwn: true });

    const reset = await resetPageAction(null, post({ slug: 'calendar' }));
    expect(reset).toMatchObject({ ok: true });
    expect(await calendarRow()).toEqual({ isVisible: true, brandOwn: false });

    const offAgain = await setPageVisibilityAction(
      null,
      post({ slug: 'calendar', isVisible: 'false' }),
    );
    expect(offAgain).toMatchObject({ ok: true });
    expect(await calendarRow()).toEqual({ isVisible: false, brandOwn: true });

    const on = await setPageVisibilityAction(null, post({ slug: 'calendar', isVisible: 'true' }));
    expect(on).toMatchObject({ ok: true });
    expect(await calendarRow()).toEqual({ isVisible: true, brandOwn: true });
  });
});
