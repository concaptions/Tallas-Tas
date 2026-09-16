import { demoAngles, demoConcepts, demoThemes } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConceptAction, updateConceptAction } from './actions';

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** A connection would only ever be attempted after validation; nothing here should get that far. */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the action reached Clerk');
  }),
}));

/**
 * The detail page submits `formats` and `adInspoLinks` as repeated entries — a checkbox group and
 * one input per link row — so the helper appends those and sets everything else once.
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

const [firstAngle] = demoAngles;
const [firstTheme] = demoThemes;
const [firstConcept] = demoConcepts;
if (firstAngle === undefined || firstTheme === undefined || firstConcept === undefined) {
  throw new Error('the demo fixtures are empty');
}

/**
 * A complete draft. There is deliberately NO `name` key: the name is generated from the Batch, the
 * Angle and the Theme inside the action, and a test that submitted one would be documenting a field
 * the page must never have.
 */
const filled = {
  batch: 'B2',
  angleId: firstAngle.id,
  themeId: firstTheme.id,
  category: 'New',
  conceptStyle: 'Editing',
  hookExamples: '"Three forty-seven. Every night."',
  scriptIdea: 'Creator reads the thread aloud beside a full-screen grab.',
};

const filledRepeated = {
  formats: ['Video', 'Static'],
  adInspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ', ''],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the page shows', async () => {
    const result = await createConceptAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateConceptAction(
      null,
      form({ ...filled, id: firstConcept.id }, filledRepeated),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses an invalid draft in demo mode too, without ever validating it', async () => {
    const result = await createConceptAction(null, form({ ...filled, batch: '' }));

    // Not the validation envelope: the refusal happens first, so there are no field errors.
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  const live = (): void => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  };

  it('rejects a draft with no batch, with the domain validator’s message', async () => {
    live();

    const result = await createConceptAction(null, form({ ...filled, batch: '' }, filledRepeated));

    if (result.ok) {
      throw new Error('a concept with no batch was accepted');
    }
    expect(result.fieldErrors?.batch).toBe('Pick the batch this concept belongs to.');
    expect(result.error).toBe('Some fields need attention before this can be saved.');
  });

  it('rejects a batch outside B1…B20', async () => {
    live();

    const result = await createConceptAction(
      null,
      form({ ...filled, batch: 'B21' }, filledRepeated),
    );

    if (result.ok) {
      throw new Error('an out-of-range batch was accepted');
    }
    expect(result.fieldErrors?.batch).toMatch(/B1 to B20/u);
  });

  it('rejects a concept with no angle and a concept with no theme', async () => {
    live();

    const noAngle = await createConceptAction(
      null,
      form({ ...filled, angleId: '' }, filledRepeated),
    );
    const noTheme = await createConceptAction(
      null,
      form({ ...filled, themeId: '' }, filledRepeated),
    );

    if (noAngle.ok || noTheme.ok) {
      throw new Error('half a pairing was accepted');
    }
    expect(noAngle.fieldErrors?.angleId).toBe('Pick the angle this concept is built on.');
    expect(noTheme.fieldErrors?.themeId).toBe('Pick the theme this angle is paired with.');
  });

  it('rejects a category outside the vocabulary', async () => {
    live();

    const result = await createConceptAction(
      null,
      form({ ...filled, category: 'Remix' }, filledRepeated),
    );

    if (result.ok) {
      throw new Error('an unknown category was accepted');
    }
    expect(result.fieldErrors?.category).toMatch(/New, Iteration/u);
  });

  it('rejects a format outside the shared vocabulary, before the rules run', async () => {
    live();

    const result = await createConceptAction(
      null,
      form(filled, { ...filledRepeated, formats: ['Video', 'Billboard'] }),
    );

    if (result.ok) {
      throw new Error('an unknown format was accepted');
    }
    expect(result.fieldErrors?.formats).toBe('That is not one of the four formats.');
  });

  it('rejects an ad-inspiration entry that is not a link, naming its position', async () => {
    live();

    const result = await createConceptAction(
      null,
      form(filled, { ...filledRepeated, adInspoLinks: ['https://example.test/ad', 'not a link'] }),
    );

    if (result.ok) {
      throw new Error('a non-link ad inspiration was accepted');
    }
    expect(result.fieldErrors?.adInspoLinks).toMatch(/Ad inspiration 2/u);
  });

  it('rejects a status that is not on the internal track', async () => {
    live();

    const result = await createConceptAction(
      null,
      form({ ...filled, internalStatus: 'shipped_it' }, filledRepeated),
    );

    if (result.ok) {
      throw new Error('an unknown internal status was accepted');
    }
    expect(result.fieldErrors?.internalStatus).toBe('That is not a status on the internal track.');
  });

  /**
   * CLAUDE.md non-negotiable 6: the client track opens only at Approved. The refusal happens before
   * Clerk is reached (which throws, mocked above), so reaching this message proves the gate closed
   * the write rather than the write failing for some other reason.
   */
  it('refuses a client-status move while the internal track is not Approved', async () => {
    live();

    const result = await createConceptAction(
      null,
      form({ ...filled, internalStatus: 'ad_submitted', clientStatus: 'approved' }, filledRepeated),
    );

    if (result.ok) {
      throw new Error('the client track opened behind a closed gate');
    }
    expect(result.fieldErrors?.clientStatus).toBe(
      'The client track opens once internal status reaches Approved.',
    );
  });

  it('refuses the same move on update', async () => {
    live();

    const result = await updateConceptAction(
      null,
      form(
        {
          ...filled,
          id: firstConcept.id,
          internalStatus: 'video_editing_in_progress',
          clientStatus: 'launched',
        },
        filledRepeated,
      ),
    );

    if (result.ok) {
      throw new Error('the client track opened behind a closed gate');
    }
    expect(result.fieldErrors?.clientStatus).toBe(
      'The client track opens once internal status reaches Approved.',
    );
  });

  it('lets the client status stand still while the gate is shut', async () => {
    live();

    // `pending_for_approval` is where the column starts, so this is not a move and the gate is not
    // consulted. The write then reaches the mocked `auth()`, which throws — the catch-all message.
    const result = await createConceptAction(
      null,
      form({ ...filled, clientStatus: 'pending_for_approval' }, filledRepeated),
    );

    expect(result).toEqual({ ok: false, error: 'The concept could not be saved. Try again.' });
  });

  it('rejects an update whose id is missing', async () => {
    live();

    const result = await updateConceptAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'This concept could not be identified.' });
  });

  it('never throws to the client when the write path fails', async () => {
    live();

    // `auth()` throws (mocked above); a valid draft therefore reaches the try/catch.
    const result = await createConceptAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'The concept could not be saved. Try again.' });
  });
});
