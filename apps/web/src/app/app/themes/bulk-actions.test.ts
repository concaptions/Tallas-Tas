import type { Db, Theme, ThemeInput } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { archiveThemesAction } from './bulk-actions';

/**
 * The Themes grid's one bulk write (Ticket 8), tested at the same seams as `actions.test.ts`: the
 * Next cache, Clerk, the global scope, and `updateTheme` as a recorder. What is pinned: the DEMO
 * refusal comes before any lookup (Clerk is never asked), an expired session writes nothing, a
 * tampered non-boolean flag is refused before the scope opens, and the action runs the SAME per-row
 * `updateTheme` flip the panel's Archive button makes — reporting only the rows that actually
 * flipped, because an unknown or soft-deleted id resolves nothing. No brand and no activity log:
 * the library is GLOBAL (non-negotiable 3) and `insertActivity` needs a `brandId`.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the page and clicking the bar. */
  actor: string | null;
  /** How many times Clerk was asked at all — the demo refusal must leave this at zero. */
  authCalls: number;
  /** The ids of the library's live rows; everything else resolves nothing. */
  live: string[];
  /** Every `updateTheme` call's `{ id, patch }`, in order. */
  flipped: { id: string; patch: Partial<ThemeInput> }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  authCalls: 0,
  live: [],
  flipped: [],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => {
    seam.authCalls += 1;
    return Promise.resolve({ userId: seam.actor });
  },
}));

vi.mock('@/lib/themes-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/themes-source')>()),
  withGlobalScope: <T>(run: (db: Db) => Promise<T>): Promise<T> => run({} as Db),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    updateTheme: (_db: Db, id: string, patch: Partial<ThemeInput>): Promise<Theme | null> => {
      seam.flipped.push({ id, patch });
      return Promise.resolve(seam.live.includes(id) ? ({ id } as Theme) : null);
    },
  };
});

const THEME_A = '66666666-6666-4666-8666-000000000001';
const THEME_B = '66666666-6666-4666-8666-000000000002';
const UNKNOWN = '99999999-9999-4999-8999-000000000001';

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.authCalls = 0;
  seam.live = [];
  seam.flipped.length = 0;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses before any lookup: Clerk is never even asked', async () => {
    const result = await archiveThemesAction([THEME_A], false);

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.flipped).toEqual([]);
  });
});

describe('with Clerk configured', () => {
  it('refuses an empty selection without touching the database', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    expect(await archiveThemesAction([], false)).toEqual({
      ok: false,
      error: 'Select at least one theme first.',
    });
    expect(seam.authCalls).toBe(0);
    expect(seam.flipped).toEqual([]);
  });

  it('refuses a tampered non-boolean flag before anything is written', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [THEME_A];

    const result = await archiveThemesAction([THEME_A], 'false' as unknown as boolean);

    expect(result).toEqual({ ok: false, error: 'Invalid request.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.flipped).toEqual([]);
  });

  it('refuses to write for an expired session', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.actor = null;

    expect(await archiveThemesAction([THEME_A], false)).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.flipped).toEqual([]);
  });

  it('archives each row through updateTheme and reports the honest subset that flipped', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [THEME_A, THEME_B];

    const result = await archiveThemesAction([THEME_A, UNKNOWN, THEME_B], false);

    // Every id went through the SAME one-row flip the panel makes; the unknown one moved nothing.
    expect(seam.flipped).toEqual([
      { id: THEME_A, patch: { isActive: false } },
      { id: UNKNOWN, patch: { isActive: false } },
      { id: THEME_B, patch: { isActive: false } },
    ]);
    expect(result).toEqual({
      ok: true,
      changed: [THEME_A, THEME_B],
      notice: '2 themes archived.',
    });
  });

  it('restores with the same write, isActive true, and says so in the singular', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [THEME_A];

    const result = await archiveThemesAction([THEME_A], true);

    expect(seam.flipped).toEqual([{ id: THEME_A, patch: { isActive: true } }]);
    expect(result).toEqual({ ok: true, changed: [THEME_A], notice: '1 theme restored.' });
  });
});
