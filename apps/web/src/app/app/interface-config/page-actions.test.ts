import {
  activityLog,
  customInterfacePages,
  insertCustomPage,
  listMergedPages,
  seed,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { editPageAction, resetPageAction, setPageVisibilityAction } from './page-actions';

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
vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve(new Headers({ 'x-vercel-id': 'fra1::abc123-1760000000000-deadbeef' })),
}));
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

/**
 * SMOKE-29 (open): the save sometimes answered a 503 while the write persisted, and the 503 lives
 * in Vercel's layer. So the action leaves a trace in Postgres — one `activity_log` row at START and
 * one at OK or FAILED, both carrying the request's `x-vercel-id` — so the next 503 says whether the
 * function finished. Keyed on the brand under `interface_config`, which no record page lists.
 */
describe('setPageVisibilityAction tracing', () => {
  it('writes start and ok rows with the request id, inside the brand scope', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    if (seam.db === null) throw new Error('the test database is not open');
    const before = (await seam.db.select().from(activityLog)).length;

    const result = await setPageVisibilityAction(
      null,
      post({ slug: 'calendar', isVisible: 'true' }),
    );
    expect(result).toMatchObject({ ok: true });

    const rows = (await seam.db.select().from(activityLog)).slice(before);
    expect(
      rows.map((row) => [row.entityType, row.entityId, row.field, row.oldValue, row.newValue]),
    ).toEqual([
      [
        'interface_config',
        seam.brandId,
        'page_visibility:calendar',
        'fra1::abc123-1760000000000-deadbeef',
        'start',
      ],
      [
        'interface_config',
        seam.brandId,
        'page_visibility:calendar',
        'fra1::abc123-1760000000000-deadbeef',
        'ok',
      ],
    ]);
  });
});

/**
 * Edit (2026-10-12): the Edit dialog posts `slug`, `title`, `isVisible` (and, for a custom or
 * module page, `filterConfig` / `columnConfig`). A standard tab's edit lands on the brand's
 * override row — the template keeps its own title — and Reset brings the template back; a brand's
 * own custom page is updated in place. The tenant is the scope's, never the form's.
 */
describe('editPageAction with the client payload', () => {
  it('re-titles Calendar for this brand, keeps the template, and Reset restores it', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    if (seam.db === null) throw new Error('the test database is not open');

    const edited = await editPageAction(
      null,
      post({ slug: 'calendar', title: 'Dates', isVisible: 'true' }),
    );
    expect(edited).toMatchObject({ ok: true });
    const merged = (await listMergedPages(seam.db, seam.brandId)).find(
      (p) => p.slug === 'calendar',
    );
    expect(merged).toMatchObject({ title: 'Dates', brandId: seam.brandId });
    // The brand row already kept `is_visible` from the toggles above; `title` joins it.
    expect(merged?.overriddenFields).toEqual(expect.arrayContaining(['title']));
    const template = (await seam.db.select().from(customInterfacePages)).find(
      (row) => row.slug === 'calendar' && row.brandId === null,
    );
    expect(template?.title).toBe('Calendar');

    expect(await resetPageAction(null, post({ slug: 'calendar' }))).toMatchObject({ ok: true });
    expect(
      (await listMergedPages(seam.db, seam.brandId)).find((p) => p.slug === 'calendar')?.title,
    ).toBe('Calendar');
  });

  it("updates the brand's own custom page in place, columns included", async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    if (seam.db === null) throw new Error('the test database is not open');
    const own = await insertCustomPage(seam.db, {
      brandId: seam.brandId,
      slug: 'winners',
      title: 'Winners',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 50,
      isVisible: true,
      isInherited: false,
      createdBy: 'user_admin',
      updatedBy: 'user_admin',
    });

    const edited = await editPageAction(
      null,
      post({
        slug: 'winners',
        title: 'Top ads',
        isVisible: 'false',
        columnConfig: JSON.stringify([
          { columnKey: 'name', displayLabel: 'Name', displayOrder: 0 },
          { columnKey: 'client_status', displayLabel: 'Client Approval', displayOrder: 1 },
        ]),
      }),
    );
    expect(edited).toMatchObject({ ok: true });
    const row = (await seam.db.select().from(customInterfacePages)).find((r) => r.id === own.id);
    expect(row).toMatchObject({ title: 'Top ads', isVisible: false });
    expect(row?.columnConfig).toHaveLength(2);
  });

  it('refuses an empty column set, which would show a client every column', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const result = await editPageAction(
      null,
      post({ slug: 'winners', title: 'Top ads', isVisible: 'true', columnConfig: '[]' }),
    );
    expect(result.ok).toBe(false);
  });
});
