import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAngleAction, updateAngleAction } from './actions';

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** A connection would only ever be attempted after validation; nothing here should get that far. */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the action reached Clerk');
  }),
}));

/**
 * The panel submits `formats` and `adInspoLinks` as repeated entries — a checkbox group and one
 * input per link row — so the helper appends those and sets everything else once.
 */
function form(
  values: Record<string, string>,
  repeated: Record<string, readonly string[]> = {},
): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  for (const [key, entries] of Object.entries(repeated)) {
    for (const entry of entries) {
      data.append(key, entry);
    }
  }
  return data;
}

const filled = {
  name: 'Make 9am Look Like 3am',
  personaId: '11111111-1111-4111-8111-555500000002',
  productId: '22222222-2222-4222-8222-555500000003',
  description: 'Hypothesis: the shift worker’s blocker is photons, not willpower.',
  painPoints: 'Sleeps in full daylight behind thin rented curtains.',
  usp: 'A contoured blackout mask that seals at the nose bridge.',
};

const filledRepeated = {
  formats: ['Static', 'Video'],
  adInspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ', ''],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the panel shows', async () => {
    const result = await createAngleAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateAngleAction(
      null,
      form({ ...filled, id: 'whatever' }, filledRepeated),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses an invalid draft in demo mode too, without ever validating it', async () => {
    const result = await createAngleAction(null, form({ ...filled, name: '' }));

    // Not the validation envelope: the refusal happens first, so there are no field errors.
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  it('rejects an empty name with the domain validator’s message', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(null, form({ ...filled, name: '  ' }, filledRepeated));

    if (result.ok) {
      throw new Error('an empty name was accepted');
    }
    expect(result.fieldErrors?.name).toBe('An angle needs a name.');
    expect(result.error).toBe('Some fields need attention before this can be saved.');
  });

  it('rejects a one-character name, the domain’s minimum', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(null, form({ ...filled, name: 'A' }, filledRepeated));

    if (result.ok) {
      throw new Error('a one-character name was accepted');
    }
    expect(result.fieldErrors?.name).toMatch(/at least 2 characters/u);
  });

  it('rejects an angle with no persona chosen', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(
      null,
      form({ ...filled, personaId: '' }, filledRepeated),
    );

    if (result.ok) {
      throw new Error('an angle with no persona was accepted');
    }
    expect(result.fieldErrors?.personaId).toBe('Pick the persona this angle is written from.');
  });

  it('rejects an angle with no format ticked', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(null, form(filled));

    if (result.ok) {
      throw new Error('an angle with no format was accepted');
    }
    expect(result.fieldErrors?.formats).toBe('Pick at least one format to create.');
  });

  it('rejects a format outside the shared vocabulary, before the rules run', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(
      null,
      form(filled, { ...filledRepeated, formats: ['Static', 'Billboard'] }),
    );

    if (result.ok) {
      throw new Error('an unknown format was accepted');
    }
    expect(result.fieldErrors?.formats).toBe('That is not one of the four formats.');
  });

  it('rejects an ad-inspiration entry that is not a link, naming its position', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(
      null,
      form(filled, { ...filledRepeated, adInspoLinks: ['https://example.test/ad', 'not a link'] }),
    );

    if (result.ok) {
      throw new Error('a non-link ad inspiration was accepted');
    }
    expect(result.fieldErrors?.adInspoLinks).toMatch(/Ad inspiration 2/u);
  });

  it('rejects an update whose id is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await updateAngleAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'This angle could not be identified.' });
  });

  it('never throws to the client when the write path fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    // `auth()` throws (mocked above); a valid draft therefore reaches the try/catch.
    const result = await createAngleAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'The angle could not be saved. Try again.' });
  });
});
