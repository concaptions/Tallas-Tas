import type { DashboardRole, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RATING_ADMIN_ONLY_NOTE, RATING_REQUIRED_HINT } from './fields';
import { rateCreatorAction } from './rating-actions';

/**
 * The rating Save, run against the real zod shape and the real domain function. Four seams are
 * mocked and nothing else: the Next cache, Clerk, the brand scope (which would open Neon), and the
 * two `@tas/db` reads and writes — replaced by recorders so a test can read the exact write the
 * query layer received and prove the admin check gates it.
 */

interface Seam {
  actor: string | null;
  role: DashboardRole | null;
  roleAsked: { brandId: string; clerkUserId: string }[];
  written: {
    brandId: string;
    creatorId: string;
    rating: number;
    note: string | null;
    actorId: string;
    now: Date | undefined;
  }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTADMIN',
  role: 'admin',
  roleAsked: [],
  written: [],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));

vi.mock('@/lib/ugc-source', () => ({
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  getActiveBrandRole: (
    _db: Db,
    brandId: string,
    clerkUserId: string,
  ): Promise<DashboardRole | null> => {
    seam.roleAsked.push({ brandId, clerkUserId });
    return Promise.resolve(seam.role);
  },
  updateCreatorPerformanceRating: (
    _db: Db,
    brandId: string,
    creatorId: string,
    rating: number,
    note: string | null,
    actorId: string,
    now?: Date,
  ): Promise<{ id: string } | null> => {
    seam.written.push({ brandId, creatorId, rating, note, actorId, now });
    return Promise.resolve(creatorId === 'missing' ? null : { id: creatorId });
  },
}));

const CREATOR_ID = '6b0d8a1e-4c3f-4e2a-9f0b-1d2e3f4a5b6c';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTADMIN';
  seam.role = 'admin';
  seam.roleAsked = [];
  seam.written = [];
});

describe('in demo mode', () => {
  it('refuses before validation or any write', async () => {
    const result = await rateCreatorAction(null, form({ id: CREATOR_ID, rating: '5' }));
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.written).toEqual([]);
  });
});

describe('as an agency admin', () => {
  it('writes the domain event: rating, trimmed note, actor and clock, inside the brand scope', async () => {
    live();
    const result = await rateCreatorAction(
      null,
      form({ id: CREATOR_ID, rating: '4', note: '  Reliable, fast turnaround.  ' }),
    );

    expect(result).toMatchObject({ ok: true, id: CREATOR_ID });
    expect(seam.roleAsked).toEqual([
      { brandId: 'brand-under-test', clerkUserId: 'user_2TESTADMIN' },
    ]);
    expect(seam.written).toHaveLength(1);
    expect(seam.written[0]).toMatchObject({
      brandId: 'brand-under-test',
      creatorId: CREATOR_ID,
      rating: 4,
      note: 'Reliable, fast turnaround.',
      actorId: 'user_2TESTADMIN',
    });
    expect(seam.written[0]?.now).toBeInstanceOf(Date);
  });

  it('stores an empty note as NULL', async () => {
    live();
    await rateCreatorAction(null, form({ id: CREATOR_ID, rating: '2', note: '   ' }));
    expect(seam.written[0]?.note).toBeNull();
  });

  it('refuses a rating off the scale with the domain message, writing nothing', async () => {
    live();
    const result = await rateCreatorAction(null, form({ id: CREATOR_ID, rating: '7' }));
    expect(result).toEqual({
      ok: false,
      error: 'rating must be a whole number from 1 to 5',
    });
    expect(seam.written).toEqual([]);
  });

  it('refuses a note past the limit, writing nothing', async () => {
    live();
    const result = await rateCreatorAction(
      null,
      form({ id: CREATOR_ID, rating: '3', note: 'x'.repeat(1001) }),
    );
    expect(result).toEqual({ ok: false, error: 'note must be at most 1000 characters' });
    expect(seam.written).toEqual([]);
  });

  it('asks for a rating when the form posts none', async () => {
    live();
    const result = await rateCreatorAction(null, form({ id: CREATOR_ID }));
    expect(result).toEqual({ ok: false, error: RATING_REQUIRED_HINT });
    expect(seam.written).toEqual([]);
  });

  it('reports a creator outside the brand as unavailable', async () => {
    live();
    const result = await rateCreatorAction(null, form({ id: 'missing', rating: '3' }));
    expect(result).toEqual({ ok: false, error: 'That creator is no longer available.' });
  });
});

describe('as anyone else', () => {
  for (const role of ['csm', 'video_editor', null] as const) {
    it(`refuses the ${role ?? 'unassigned'} viewer without writing`, async () => {
      live();
      seam.role = role;
      const result = await rateCreatorAction(null, form({ id: CREATOR_ID, rating: '5' }));
      expect(result).toEqual({ ok: false, error: RATING_ADMIN_ONLY_NOTE });
      expect(seam.written).toEqual([]);
    });
  }

  it('answers an expired session with a typed failure', async () => {
    live();
    seam.actor = null;
    const result = await rateCreatorAction(null, form({ id: CREATOR_ID, rating: '5' }));
    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.roleAsked).toEqual([]);
  });
});
