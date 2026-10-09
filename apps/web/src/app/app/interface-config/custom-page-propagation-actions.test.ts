import type { Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestCustomPagePromotionAction } from './custom-page-propagation-actions';

/**
 * "Push to all clients" opens a REVIEW REQUEST (B3): never a propagation. Admin only. The seams
 * are the scope (runs the body against one brand), the team read (who the actor is), the template
 * page list and the request writer, which records what it was asked to write.
 */
const PAGE_ID = vi.hoisted(() => '11111111-1111-4111-8111-000000000001');

const seam = vi.hoisted(
  (): {
    role: string;
    created: Record<string, unknown>[];
    pages: { id: string; slug: string; title: string }[];
  } => ({
    role: 'admin',
    created: [],
    pages: [{ id: PAGE_ID, slug: 'partnership-ads', title: 'Partnership Ads Tracking' }],
  }),
);

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: 'user_admin' }),
}));
vi.mock('@/lib/interface-config-pages-source', () => ({
  withInterfacePagesScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));
vi.mock('@/lib/data-source', () => ({ resolveLiveAgencyId: () => Promise.resolve('agency-1') }));
vi.mock('@/lib/team-actor', () => ({
  teamPageActorFrom: () => ({ agencyRole: seam.role, brandRoles: [] }),
}));
vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  listTeam: () => Promise.resolve([{ clerkUserId: 'user_admin' }]),
  listTemplateCustomPages: () => Promise.resolve(seam.pages),
  resolveTemplateBrandFromAny: () => Promise.resolve('template-brand'),
  createPromotionRequest: (_db: Db, input: Record<string, unknown>) => {
    seam.created.push(input);
    return Promise.resolve({ id: 'req-1', ...input });
  },
}));

function form(id: string): FormData {
  const data = new FormData();
  data.set('id', id);
  return data;
}

function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.created = [];
  seam.role = 'admin';
});

describe('requestCustomPagePromotionAction', () => {
  it('refuses in demo mode before anything is read', async () => {
    const result = await requestCustomPagePromotionAction(null, form(PAGE_ID));
    expect(result.ok).toBe(false);
    expect(seam.created).toEqual([]);
  });

  it('an Admin opens a review request naming the template page — and propagates nothing', async () => {
    live();
    const result = await requestCustomPagePromotionAction(null, form(PAGE_ID));

    expect(result.ok).toBe(true);
    expect(seam.created).toEqual([
      {
        brandId: 'template-brand',
        tableName: 'custom_interface_pages',
        rowId: PAGE_ID,
        fieldName: 'push',
        currentValue: 'template',
        proposedValue: JSON.stringify({
          slug: 'partnership-ads',
          title: 'Partnership Ads Tracking',
        }),
        requestedBy: 'user_admin',
      },
    ]);
  });

  it('a CSM cannot push: refused, no request written', async () => {
    live();
    seam.role = 'csm';
    const result = await requestCustomPagePromotionAction(null, form(PAGE_ID));
    expect(result).toEqual({
      ok: false,
      error: 'Only an agency Admin can push a page to every client.',
    });
    expect(seam.created).toEqual([]);
  });

  it('refuses a page that is not a template page', async () => {
    live();
    const result = await requestCustomPagePromotionAction(
      null,
      form('22222222-2222-4222-8222-000000000002'),
    );
    expect(result.ok).toBe(false);
    expect(seam.created).toEqual([]);
  });
});
