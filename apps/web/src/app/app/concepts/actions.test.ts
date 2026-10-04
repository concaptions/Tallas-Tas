import {
  CONCEPT_CLIENT_STATUS_DEFAULT,
  demoAngles,
  demoConcepts,
  demoThemes,
  type ConceptInput,
  type Db,
} from '@tas/db';
import { conceptName } from '@tas/domain/concepts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConceptAction, updateConceptAction } from './actions';

/**
 * The Concepts route's two mutations, run against the real zod shape, the real `parse`, the real
 * domain validator and the real gate. Four seams are mocked and nothing else: the Next cache (only
 * exists inside a request), Clerk, the brand scope (which would open a Neon connection), and the
 * `@tas/db` functions the write path calls — the three reads answer from the demo fixtures, the two
 * writes are recorders, so a test can read the exact `ConceptInput` the query layer received. That
 * is how the four own prose columns are proven to travel from the form to the row, how a blank
 * textarea is proven to arrive as NULL rather than as an empty string, and how the stored name is
 * proven to be the generated one whatever the form claimed.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the page and submitting it. */
  actor: string | null;
  /** When true every write throws: the outage the catch-all message exists for. */
  failWrites: boolean;
  /** Every `insertConcept` call's values, in order. */
  inserted: ConceptInput[];
  /** Every `updateConcept` call's `{ id, patch }`, in order. */
  updated: { id: string; patch: Partial<ConceptInput> }[];
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

vi.mock('@/lib/concepts-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/concepts-source')>()),
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
    getConceptById: (
      _db: Db,
      _brandId: string,
      id: string,
    ): ReturnType<typeof actual.getConceptById> =>
      Promise.resolve(actual.demoConcepts.find((row) => row.id === id) ?? null),
    getAngleById: (_db: Db, _brandId: string, id: string): ReturnType<typeof actual.getAngleById> =>
      Promise.resolve(actual.demoAngles.find((row) => row.id === id) ?? null),
    getThemeById: (_db: Db, id: string): ReturnType<typeof actual.getThemeById> =>
      Promise.resolve(actual.demoThemes.find((row) => row.id === id) ?? null),
    insertConcept: (_db: Db, _brandId: string, values: ConceptInput): Promise<{ id: string }> => {
      write();
      seam.inserted.push(values);
      return Promise.resolve({ id: 'concept-created' });
    },
    updateConcept: (
      _db: Db,
      _brandId: string,
      id: string,
      patch: Partial<ConceptInput>,
    ): Promise<{ id: string }> => {
      write();
      seam.updated.push({ id, patch });
      return Promise.resolve({ id });
    },
    syncConceptAngles: (): Promise<void> => Promise.resolve(),
    syncConceptThemes: (): Promise<void> => Promise.resolve(),
    syncConceptCreators: (): Promise<void> => Promise.resolve(),
    listBriefsByConceptId: (): ReturnType<typeof actual.listBriefsByConceptId> =>
      Promise.resolve([]),
  };
});

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

/** The concept's four own prose columns, every one filled. */
const prose = {
  description: 'Shift the blame from the sleeper to the night.',
  painPoints: 'Wakes at the same hour every night. Has been told it is just her age.',
  usp: 'Quilted pressure channels that settle the body without heat.',
  clientComments: "Client's note: keep the doctor's line, lose the ceiling shot.",
};

/** Clerk configured is what makes it live mode; demo mode is the absence of the key. */
function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

function onlyInsert(): ConceptInput {
  const [values] = seam.inserted;
  if (values === undefined || seam.inserted.length !== 1) {
    throw new Error(`expected exactly one insert, saw ${String(seam.inserted.length)}`);
  }
  return values;
}

function onlyUpdate(): { id: string; patch: Partial<ConceptInput> } {
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
  seam.inserted = [];
  seam.updated = [];
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the page shows, before any write', async () => {
    const result = await createConceptAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.inserted).toEqual([]);
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateConceptAction(
      null,
      form({ ...filled, id: firstConcept.id }, filledRepeated),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.updated).toEqual([]);
  });

  it('refuses an invalid draft in demo mode too, without ever validating it', async () => {
    const result = await createConceptAction(null, form({ ...filled, batch: '' }));

    // Not the validation envelope: the refusal happens first, so there are no field errors.
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  it('rejects a draft with no batch, with the domain validator’s message', async () => {
    live();

    const result = await createConceptAction(null, form({ ...filled, batch: '' }, filledRepeated));

    if (result.ok) {
      throw new Error('a concept with no batch was accepted');
    }
    expect(result.fieldErrors?.batch).toBe('Pick the batch this concept belongs to.');
    expect(result.error).toBe('Some fields need attention before this can be saved.');
    expect(seam.inserted).toEqual([]);
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
    // Keyed by the DRAFT's field names, which are the ones the detail page asks `fieldError` for.
    // They were asserted here under the posted input names (`angleId`, `themeId`) instead, and that
    // is the shape the page could never read: the message existed and never reached the control.
    expect(noAngle.fieldErrors?.angleIds).toBe('Pick at least one angle this concept is built on.');
    expect(noTheme.fieldErrors?.themeIds).toBe(
      'Pick at least one theme this angle is paired with.',
    );
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
   * the write path, so the recorders staying empty proves the gate closed the write rather than the
   * write failing for some other reason.
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
    expect(seam.inserted).toEqual([]);
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
    expect(seam.updated).toEqual([]);
  });

  it('lets the client status stand still while the gate is shut', async () => {
    live();

    // `pending_for_approval` is where the column starts, so this is not a move and the gate is not
    // consulted: the write goes through and stores the column default.
    const result = await createConceptAction(
      null,
      form({ ...filled, clientStatus: CONCEPT_CLIENT_STATUS_DEFAULT }, filledRepeated),
    );

    expect(result).toMatchObject({ ok: true, id: 'concept-created' });
    expect(onlyInsert().clientStatus).toBe(CONCEPT_CLIENT_STATUS_DEFAULT);
  });

  /**
   * CLAUDE.md non-negotiable 6: the name is generated, never typed. A `name` key smuggled into the
   * submission is ignored; what reaches the row is the formula applied to the angle and theme rows
   * the action read itself.
   */
  it('stores the generated Batch-Angle-Theme name, never one the form claims', async () => {
    live();
    const generated = conceptName({
      batch: filled.batch,
      angleName: firstAngle.name,
      themeName: firstTheme.name,
    });

    const result = await createConceptAction(
      null,
      form({ ...filled, name: 'Hand Typed Name' }, filledRepeated),
    );

    expect(result).toMatchObject({ ok: true, name: generated });
    expect(onlyInsert().name).toBe(generated);
  });

  /**
   * The concept's four own prose columns (Gratsi parity) travel from the form to the query layer.
   * The create form carries none of the four keys at all — a missing key is read as blank — and the
   * update form blanks them, one with whitespace only; both arrive as NULL, never as `''`.
   */
  it('passes the four own prose columns to the row, a blank or whitespace one as NULL', async () => {
    live();

    const blank = await createConceptAction(null, form(filled, filledRepeated));
    const emptied = await updateConceptAction(
      null,
      form(
        {
          ...filled,
          id: firstConcept.id,
          description: '',
          painPoints: '   ',
          usp: '',
          clientComments: '',
        },
        filledRepeated,
      ),
    );

    expect(blank).toMatchObject({ ok: true });
    expect(emptied).toMatchObject({ ok: true, id: firstConcept.id });
    const nulls = { description: null, painPoints: null, usp: null, clientComments: null };
    expect(onlyInsert()).toMatchObject(nulls);
    expect(onlyUpdate().id).toBe(firstConcept.id);
    expect(onlyUpdate().patch).toMatchObject(nulls);
  });

  it('passes all four own prose columns filled, on create and on update', async () => {
    live();

    const created = await createConceptAction(null, form({ ...filled, ...prose }, filledRepeated));
    const updated = await updateConceptAction(
      null,
      form({ ...filled, ...prose, id: firstConcept.id }, filledRepeated),
    );

    expect(created).toMatchObject({ ok: true });
    expect(updated).toMatchObject({ ok: true });
    // Every key asserted by value: dropping any one of the four from the write fails here.
    expect(onlyInsert()).toMatchObject(prose);
    expect(onlyUpdate().patch).toMatchObject(prose);
  });

  it('refuses when the session expired between rendering the page and submitting', async () => {
    live();
    seam.actor = null;

    const result = await createConceptAction(null, form(filled, filledRepeated));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.inserted).toEqual([]);
  });

  it('rejects an update whose id is missing', async () => {
    live();

    const result = await updateConceptAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'This concept could not be identified.' });
  });

  it('never throws to the client when the write path fails', async () => {
    live();
    seam.failWrites = true;

    const result = await createConceptAction(null, form(filled, filledRepeated));

    expect(result).toEqual({ ok: false, error: 'The concept could not be saved. Try again.' });
  });
});
