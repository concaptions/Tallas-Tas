import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  reorderTabAction,
  resetTabVisibilityAction,
  toggleTabVisibilityAction,
} from './visibility-actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the action reached Clerk');
  }),
}));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('visibility actions in demo mode', () => {
  it('toggleTabVisibilityAction refuses before any validation', async () => {
    const result = await toggleTabVisibilityAction(
      null,
      form({ tabKey: 'concepts', isVisible: 'true' }),
    );
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('reorderTabAction refuses before any validation', async () => {
    const result = await reorderTabAction(null, form({ tabKey: 'concepts', direction: 'up' }));
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('resetTabVisibilityAction refuses before any validation', async () => {
    const result = await resetTabVisibilityAction(null, form({ tabKey: 'concepts' }));
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('visibility actions with Clerk configured', () => {
  it('rejects a tab key not in CLIENT_TAB_KEYS', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const result = await toggleTabVisibilityAction(
      null,
      form({ tabKey: 'themes', isVisible: 'true' }),
    );
    expect(result).toEqual({ ok: false, error: 'Could not read the tab change.' });
  });

  it('rejects a direction that is not up or down', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const result = await reorderTabAction(
      null,
      form({ tabKey: 'concepts', direction: 'sideways' }),
    );
    expect(result).toEqual({ ok: false, error: 'Could not read the reorder request.' });
  });

  it('refuses to move the first tab up or the last tab down', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const upFirst = await reorderTabAction(null, form({ tabKey: 'concepts', direction: 'up' }));
    expect(upFirst).toEqual({ ok: false, error: 'This tab cannot move further.' });
    const downLast = await reorderTabAction(
      null,
      form({ tabKey: 'copywriting', direction: 'down' }),
    );
    expect(downLast).toEqual({ ok: false, error: 'This tab cannot move further.' });
  });
});
