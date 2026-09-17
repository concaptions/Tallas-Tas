import { COPY_CTAS } from '@tas/domain/copy';
import { COPY_STATUS } from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCopyAction, updateCopyAction } from './actions';

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

/** A copy row as the panel submits it: the four copy fields plus the creative it is tied to. */
const filled = {
  creativeBriefId: '55555555-5555-4555-8555-000000000001',
  primaryCopy:
    'Six years of night shifts and he still could not sleep at noon. It is the rota, not you.',
  headline: 'Your Rota Is Broken. You Are Not.',
  linkDescription: '90 nights. Sleep or return.',
  cta: 'Shop Now',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the words the disabled save tooltip uses', async () => {
    const result = await createCopyAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateCopyAction(null, form({ ...filled, id: 'whatever' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses a submission that would not have validated, without validating it', async () => {
    const result = await createCopyAction(null, form({ ...filled, headline: '', cta: 'Buy Now' }));

    // The demo refusal comes FIRST: no field errors, because nothing was ever checked.
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  const live = (): void => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  };

  it('rejects an empty headline before any actor or database call', async () => {
    live();

    const result = await createCopyAction(null, form({ ...filled, headline: '   ' }));

    if (result.ok) {
      throw new Error('a copy row with no headline was accepted');
    }
    expect(result.fieldErrors?.headline).toBe('A copy row needs a headline.');
    expect(result.error).toBe('Some fields need attention before this can be saved.');
  });

  it('rejects a CTA that is not one of the six', async () => {
    live();

    const result = await createCopyAction(null, form({ ...filled, cta: 'Buy Now' }));

    if (result.ok) {
      throw new Error('a CTA outside the vocabulary was accepted');
    }
    expect(result.fieldErrors?.cta).toBeDefined();
  });

  it('rejects a status that is not one of the five', async () => {
    live();

    const result = await createCopyAction(null, form({ ...filled, status: 'in_review' }));

    if (result.ok) {
      throw new Error('a status outside the vocabulary was accepted');
    }
    expect(result.fieldErrors?.status).toBeDefined();
  });

  it('rejects an empty CTA rather than reading it as "leave it alone"', async () => {
    live();

    const result = await createCopyAction(null, form({ ...filled, cta: '' }));

    if (result.ok) {
      throw new Error('an empty CTA was accepted');
    }
    expect(result.fieldErrors?.cta).toBeDefined();
  });

  it.each(COPY_CTAS.map((entry) => entry.key))(
    'accepts %s as a CTA and gets as far as the actor lookup',
    async (cta) => {
      live();

      // Past validation there is nothing left but Clerk, which this file makes throw; the generic
      // failure is therefore proof the draft itself was accepted.
      const result = await createCopyAction(null, form({ ...filled, cta }));

      expect(result).toEqual({ ok: false, error: 'The copy could not be saved. Try again.' });
    },
  );

  it.each(COPY_STATUS.map((entry) => entry.key))(
    'accepts %s as a status and gets as far as the actor lookup',
    async (status) => {
      live();

      const result = await createCopyAction(null, form({ ...filled, status }));

      expect(result).toEqual({ ok: false, error: 'The copy could not be saved. Try again.' });
    },
  );

  it('accepts the "No creative" option — an unattached row is ordinary, not degraded', async () => {
    live();

    const result = await createCopyAction(null, form({ ...filled, creativeBriefId: '' }));

    expect(result).toEqual({ ok: false, error: 'The copy could not be saved. Try again.' });
  });

  it('never refuses a save for a field past its character guidance', async () => {
    live();

    const result = await createCopyAction(
      null,
      form({ ...filled, primaryCopy: 'x'.repeat(260), linkDescription: 'y'.repeat(60) }),
    );

    // Over the ~125 and ~27 guides and still not a validation failure: Meta truncates, it does not
    // reject, so the overage is a warning the panel renders and the write goes ahead.
    expect(result).toEqual({ ok: false, error: 'The copy could not be saved. Try again.' });
  });

  it('rejects an update whose id is missing', async () => {
    live();

    const result = await updateCopyAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'This copy could not be identified.' });
  });

  it('rejects an update whose id is the empty string', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, id: '' }));

    expect(result).toEqual({ ok: false, error: 'This copy could not be identified.' });
  });
});
