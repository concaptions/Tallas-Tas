import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProductAction, updateProductAction } from './actions';

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

const filled = {
  name: 'Niagara Deep Sleep Weighted Blanket',
  link: 'https://niagarasleep.example/products/deep-sleep-weighted-blanket',
  collectionLink: 'https://niagarasleep.example/collections/sleep-essentials',
};

const DEMO_REFUSAL = { ok: false, error: 'Sign in required to save changes.' };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the panel shows', async () => {
    const result = await createProductAction(null, form(filled));

    expect(result).toEqual(DEMO_REFUSAL);
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateProductAction(null, form({ ...filled, id: 'whatever' }));

    expect(result).toEqual(DEMO_REFUSAL);
  });

  it('refuses before validation, so an invalid form still gets the demo message', async () => {
    const result = await createProductAction(null, form({ name: '', link: 'not-a-url' }));

    expect(result).toEqual(DEMO_REFUSAL);
  });
});

describe('with Clerk configured', () => {
  it('rejects an empty name before any actor or database call', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createProductAction(null, form({ ...filled, name: '   ' }));

    if (result.ok) {
      throw new Error('an empty name was accepted');
    }
    expect(result.fieldErrors?.name).toBe('A product needs a name.');
  });

  it('rejects a missing landing page link — PRD §5.1 requires at least that one', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createProductAction(null, form({ ...filled, link: '' }));

    if (result.ok) {
      throw new Error('a product with no landing page link was accepted');
    }
    expect(result.fieldErrors?.link).toBe('A product needs a landing page link.');
  });

  it('rejects a landing page link that is not an http(s) URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createProductAction(
      null,
      form({ ...filled, link: 'niagarasleep.example/products/blanket' }),
    );

    if (result.ok) {
      throw new Error('a bare hostname was accepted as a landing page link');
    }
    expect(result.fieldErrors?.link).toBe('Enter a full link, starting with https://');
  });

  it('rejects a collection link that is not a link, although the field is optional', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createProductAction(
      null,
      form({ ...filled, collectionLink: 'javascript:alert(1)' }),
    );

    if (result.ok) {
      throw new Error('a non-http collection link was accepted');
    }
    expect(result.fieldErrors?.collectionLink).toBe('Enter a full link, starting with https://');
  });

  it('rejects an update whose id is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await updateProductAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'This product could not be identified.' });
  });

  it('accepts an empty collection link and gets as far as the actor lookup', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    // Validation passes, so the action reaches `auth()`, which the mock makes throw; the action
    // catches it and answers with a typed failure rather than letting it reach the client.
    const result = await createProductAction(null, form({ ...filled, collectionLink: '   ' }));

    expect(result).toEqual({ ok: false, error: 'The product could not be saved. Try again.' });
  });
});
