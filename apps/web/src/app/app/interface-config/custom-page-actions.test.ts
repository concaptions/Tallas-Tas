import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCustomPageAction,
  deleteCustomPageAction,
  updateCustomPageAction,
} from './custom-page-actions';

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

describe('custom page actions in demo mode', () => {
  it('createCustomPageAction refuses before any validation', async () => {
    const result = await createCustomPageAction(null, form({ title: 'X', slug: 'x' }));
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('updateCustomPageAction refuses before any validation', async () => {
    const result = await updateCustomPageAction(
      null,
      form({ id: '00000000-0000-0000-0000-000000000000', title: 'X' }),
    );
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('deleteCustomPageAction refuses before any validation', async () => {
    const result = await deleteCustomPageAction(
      null,
      form({ id: '00000000-0000-0000-0000-000000000000' }),
    );
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('custom page actions with Clerk configured', () => {
  it('rejects a slug that is not kebab-case', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const result = await createCustomPageAction(
      null,
      form({
        title: 'Camel',
        slug: 'CamelCase',
        sourceTableKey: 'creative_briefs',
        isVisible: 'true',
      }),
    );
    expect(result).toEqual({ ok: false, error: 'Could not read the page.' });
  });

  it('rejects a source table key not in CUSTOM_PAGE_SOURCE_TABLE_KEYS', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const result = await createCustomPageAction(
      null,
      form({
        title: 'T',
        slug: 't',
        sourceTableKey: 'themes',
        isVisible: 'true',
      }),
    );
    expect(result).toEqual({ ok: false, error: 'Could not read the page.' });
  });

  it('rejects a filter whose op requires a value but has none', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const result = await createCustomPageAction(
      null,
      form({
        title: 'T',
        slug: 't',
        sourceTableKey: 'creative_briefs',
        isVisible: 'true',
        // zod rejects this: `is` requires a value field; the DU parse fails before filterValid runs
        filterConfig: JSON.stringify({ column: 'status', op: 'is' }),
      }),
    );
    expect(result).toEqual({ ok: false, error: 'Could not read the page.' });
  });
});
