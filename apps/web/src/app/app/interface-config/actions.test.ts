import { demoInterfaceConfig } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveInterfaceConfigAction } from './actions';

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** A connection would only ever be attempted after validation; nothing here should get that far. */
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

const [conceptsPage] = demoInterfaceConfig;
if (conceptsPage === undefined) {
  throw new Error('the demo interface configuration is empty');
}
/** The draft the Save control submits, built from the fixtures so the ids are real uuids. */
const draft = JSON.stringify({
  pages: demoInterfaceConfig.map((page) => ({
    id: page.id,
    pageKey: page.pageKey,
    enabled: page.enabled,
    fields: page.fields.map((field) => ({ id: field.id, visible: field.visible })),
  })),
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to save the whole configuration, before the JSON is parsed', async () => {
    const result = await saveInterfaceConfigAction(null, form({ config: 'not json at all' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  it('rejects a draft naming a page key the product does not have', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    const tampered = JSON.stringify({
      pages: [{ id: conceptsPage.id, pageKey: 'billing', enabled: true, fields: [] }],
    });

    const result = await saveInterfaceConfigAction(null, form({ config: tampered }));

    expect(result).toEqual({ ok: false, error: 'This configuration could not be read.' });
  });

  it('rejects a draft that is not JSON', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await saveInterfaceConfigAction(null, form({ config: '{' }));

    expect(result).toEqual({ ok: false, error: 'This configuration could not be read.' });
  });

  it('rejects a save with nothing attached', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await saveInterfaceConfigAction(null, form({}));

    expect(result).toEqual({ ok: false, error: 'There was nothing to save.' });
  });

  it('accepts the shape of a real draft far enough to reach the actor lookup', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    // The Clerk mock throws, which the action catches: proof the payload passed validation rather
    // than being turned away by it, without needing a database.
    const result = await saveInterfaceConfigAction(null, form({ config: draft }));

    expect(result).toEqual({
      ok: false,
      error: 'The interface configuration could not be saved. Try again.',
    });
  });
});
