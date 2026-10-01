import type { AngleInput, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAngleAction, updateAngleAction } from './actions';

/**
 * The Angles route's two mutations, run against the real zod shape, the real `parse` and the real
 * domain validator. Four seams are mocked and nothing else: the Next cache (only exists inside a
 * request), Clerk, the brand scope (which would open a Neon connection), and the `@tas/db` writes,
 * which are recorders — so a test can read the exact `AngleInput` the query layer received. That
 * is how the eight parity fields (Potential, Winning, both notes, the formats, the ad-inspiration
 * links) are proven to travel from the form to the row, and how a blank textarea is proven to
 * arrive as NULL rather than as an empty string.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the page and submitting it. */
  actor: string | null;
  /** When true every write throws: the outage the catch-all message exists for. */
  failWrites: boolean;
  /** Every `insertAngle` call's values, in order. */
  inserted: AngleInput[];
  /** Every `updateAngle` call's `{ id, patch }`, in order. */
  updated: { id: string; patch: Partial<AngleInput> }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  failWrites: false,
  inserted: [],
  updated: [],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));

vi.mock('@/lib/angles-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/angles-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  const write = (): void => {
    if (seam.failWrites) {
      throw new Error('the database is unreachable');
    }
  };
  return {
    ...actual,
    insertAngle: (_db: Db, _brandId: string, values: AngleInput): Promise<{ id: string }> => {
      write();
      seam.inserted.push(values);
      return Promise.resolve({ id: 'angle-created' });
    },
    updateAngle: (
      _db: Db,
      _brandId: string,
      id: string,
      patch: Partial<AngleInput>,
    ): Promise<{ id: string }> => {
      write();
      seam.updated.push({ id, patch });
      return Promise.resolve({ id });
    },
    syncAnglePersonas: (): Promise<void> => Promise.resolve(),
    syncAngleProducts: (): Promise<void> => Promise.resolve(),
  };
});

/**
 * The panel submits `formats` and `adInspoLinks` as repeated entries — a toggle row's hidden
 * inputs and one input per link row — so the helper appends those and sets everything else once.
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

/** The one insert a successful create made, past `noUncheckedIndexedAccess`. */
function onlyInsert(): AngleInput {
  const [values] = seam.inserted;
  if (values === undefined || seam.inserted.length !== 1) {
    throw new Error(`expected exactly one insert, saw ${String(seam.inserted.length)}`);
  }
  return values;
}

/** The one update a successful save made. */
function onlyUpdate(): { id: string; patch: Partial<AngleInput> } {
  const [call] = seam.updated;
  if (call === undefined || seam.updated.length !== 1) {
    throw new Error(`expected exactly one update, saw ${String(seam.updated.length)}`);
  }
  return call;
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.failWrites = false;
  seam.inserted.length = 0;
  seam.updated.length = 0;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the panel shows', async () => {
    const result = await createAngleAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.inserted).toEqual([]);
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateAngleAction(
      null,
      form({ ...filled, id: 'whatever' }, filledRepeated),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.updated).toEqual([]);
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
    expect(result.fieldErrors?.personaId).toBe(
      'Pick at least one persona this angle is written from.',
    );
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

  it('rejects a status outside the angleStatuses keys, before the rules run', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    // The LABEL, not the key: a select that posted its display text would be a tampered form.
    const result = await createAngleAction(
      null,
      form({ ...filled, status: 'Approved' }, filledRepeated),
    );

    if (result.ok) {
      throw new Error('an unknown status was accepted');
    }
    expect(result.fieldErrors?.status).toBe('That is not one of the angle statuses.');
  });

  it('writes a status key as itself, and "Not set" as NULL', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    for (const status of ['needs_revisions', '']) {
      await createAngleAction(null, form({ ...filled, status }, filledRepeated));
    }

    expect(seam.inserted.map((values) => values.status)).toEqual(['needs_revisions', null]);
  });

  it('writes Potential, Winning, both notes, the formats and the links exactly as submitted', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(
      null,
      form(
        {
          ...filled,
          potential: 'High — the pain is daily and the fix is visible on camera.',
          winning: 'true',
          internalNotes: 'Creator cost ceiling is 400.',
          clientNotes: 'Client wants the nurse persona first.',
        },
        filledRepeated,
      ),
    );

    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.id).toBe('angle-created');
    expect(onlyInsert()).toMatchObject({
      potential: 'High — the pain is daily and the fix is visible on camera.',
      winning: true,
      internalNotes: 'Creator cost ceiling is 400.',
      clientNotes: 'Client wants the nurse persona first.',
      formats: ['Static', 'Video'],
      // The editor's trailing blank row is dropped, never stored as ''.
      adInspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
    });
  });

  it('stores a blank Potential and blank notes as NULL, and an unticked Winning as false', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    await createAngleAction(
      null,
      form(
        { ...filled, potential: '   ', winning: 'false', internalNotes: '', clientNotes: ' ' },
        filledRepeated,
      ),
    );

    expect(onlyInsert()).toMatchObject({
      potential: null,
      winning: false,
      internalNotes: null,
      clientNotes: null,
    });
  });

  it('reads a form with no Winning key at all as not winning, the column’s default', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    await createAngleAction(null, form(filled, filledRepeated));

    expect(onlyInsert()).toMatchObject({ winning: false, potential: null });
  });

  it('rejects a Winning value that is neither true nor false, before the rules run', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createAngleAction(
      null,
      form({ ...filled, winning: 'yes' }, filledRepeated),
    );

    if (result.ok) {
      throw new Error('a tampered Winning value was accepted');
    }
    expect(result.fieldErrors?.winning).toBe('Winning is either ticked or not.');
    expect(seam.inserted).toEqual([]);
  });

  it('patches the same eight columns on the identified angle, and only that angle', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await updateAngleAction(
      null,
      form(
        {
          ...filled,
          id: '55555555-5555-4555-8555-000000000001',
          potential: 'Medium',
          winning: 'true',
          internalNotes: 'Re-cut the hook.',
          clientNotes: '',
        },
        {
          formats: ['Carousel'],
          adInspoLinks: ['https://www.tiktok.com/@brand/video/1', '', 'https://example.test/ad'],
        },
      ),
    );

    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.id).toBe('55555555-5555-4555-8555-000000000001');
    const { id, patch } = onlyUpdate();
    expect(id).toBe('55555555-5555-4555-8555-000000000001');
    expect(patch).toMatchObject({
      potential: 'Medium',
      winning: true,
      internalNotes: 'Re-cut the hook.',
      clientNotes: null,
      formats: ['Carousel'],
      adInspoLinks: ['https://www.tiktok.com/@brand/video/1', 'https://example.test/ad'],
    });
    expect(seam.inserted).toEqual([]);
  });

  it('rejects an update whose id is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await updateAngleAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'This angle could not be identified.' });
    expect(seam.updated).toEqual([]);
  });

  it('refuses to write for an expired session', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.actor = null;

    const result = await createAngleAction(null, form(filled, filledRepeated));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.inserted).toEqual([]);
  });

  it('never throws to the client when the write path fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.failWrites = true;

    const result = await createAngleAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'The angle could not be saved. Try again.' });
  });
});
