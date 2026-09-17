import { demoCopy, type CopyListRow, type Db } from '@tas/db';
import { COPY_CTAS } from '@tas/domain/copy';
import { COPY_STATUS } from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateCopyAction, type CopyActionResult, type CopyActionSuccess } from './actions';

/**
 * `updateCopyAction` is the Copywriting route's ONE mutation. There is no create action: the "New
 * copy" button is inert until the CSV upload ticket, and an exported Server Action nothing submits
 * to is dead code, so the rules below are asserted against the action that actually runs.
 *
 * Three seams are mocked and nothing else: the Next cache (only exists inside a request), Clerk,
 * and the brand scope — which is the one thing a unit test cannot have, since it opens a Neon
 * connection. Everything between them is the real module: the zod shape, `draftFrom`'s
 * "absent means unchanged", and `validateCopyDraft` from `@tas/domain/copy`. That is the point of
 * re-running the rules here at all — the panel's disabled button is a courtesy, not a guarantee.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the panel and submitting it. */
  actor: string | null;
  /** The row `getCopyById` resolves; null is another brand's id, or a soft-deleted row. */
  stored: CopyListRow | null;
  /** Whether the submitted creative resolves INSIDE the scope. */
  briefResolves: boolean;
}

/** Values the mocked seams read at call time, so a test can move the ground under one action. */
const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  stored: null,
  briefResolves: true,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));

/** The scope, stubbed: the body runs against a brand, which is all the action asks of it. */
vi.mock('@/lib/copy-source', () => ({
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

/** Only the three scoped calls the action makes; every other export stays the real one. */
vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  getCopyById: (): Promise<CopyListRow | null> => Promise.resolve(seam.stored),
  getBriefById: (_db: Db, _brandId: string, id: string): Promise<{ id: string } | null> =>
    Promise.resolve(seam.briefResolves ? { id } : null),
  updateCopy: (_db: Db, _brandId: string, id: string): Promise<{ id: string }> =>
    Promise.resolve({ id }),
}));

/** The row every test patches: a real fixture, so the stored side of a merge is a real row. */
function firstDemoCopyRow(): CopyListRow {
  const [row] = demoCopy;
  if (row === undefined) {
    throw new Error('the demo fixtures carry no copy row to patch');
  }
  return row;
}

const STORED = firstDemoCopyRow();

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

/** A copy row as the panel submits it: the id, the four copy fields, the creative it is tied to. */
const filled = {
  id: STORED.id,
  creativeBriefId: '55555555-5555-4555-8555-000000000001',
  primaryCopy:
    'Six years of night shifts and he still could not sleep at noon. It is the rota, not you.',
  headline: 'Your Rota Is Broken. You Are Not.',
  linkDescription: '90 nights. Sleep or return.',
  cta: 'Shop Now',
};

/** The same submission with no id at all, which is a different thing from an empty one. */
function formWithoutId(): FormData {
  const data = form(filled);
  data.delete('id');
  return data;
}

/** Clerk configured is what makes it live mode; demo mode is the absence of the key. */
function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  seam.stored = STORED;
  seam.actor = 'user_2TESTACTOR';
  seam.briefResolves = true;
}

function saved(result: CopyActionResult, why: string): CopyActionSuccess {
  if (!result.ok) {
    throw new Error(`${why}: ${result.error}`);
  }
  return result;
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.stored = null;
  seam.actor = 'user_2TESTACTOR';
  seam.briefResolves = true;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateCopyAction(null, form({ ...filled, id: 'whatever' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses a submission that would not have validated, without validating it', async () => {
    const result = await updateCopyAction(null, form({ ...filled, headline: '', cta: 'Buy Now' }));

    // The demo refusal comes FIRST: no field errors, because nothing was ever checked.
    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses without an id, rather than reporting the id it never reached', async () => {
    const result = await updateCopyAction(null, formWithoutId());

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured · the id', () => {
  it('rejects an update whose id is missing', async () => {
    live();

    const result = await updateCopyAction(null, formWithoutId());

    expect(result).toEqual({ ok: false, error: 'This copy could not be identified.' });
  });

  it('rejects an update whose id is the empty string', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, id: '' }));

    expect(result).toEqual({ ok: false, error: 'This copy could not be identified.' });
  });

  it('refuses an id that does not resolve inside the scope — another brand never leaks', async () => {
    live();
    seam.stored = null;

    const result = await updateCopyAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'That copy is no longer available.' });
  });
});

describe('with Clerk configured · the rules the panel disables its save with', () => {
  it('rejects an empty headline', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, headline: '   ' }));

    if (result.ok) {
      throw new Error('a copy row with no headline was accepted');
    }
    expect(result.fieldErrors?.headline).toBe('A copy row needs a headline.');
    expect(result.error).toBe('Some fields need attention before this can be saved.');
  });

  it('rejects a CTA that is not one of the six', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, cta: 'Buy Now' }));

    if (result.ok) {
      throw new Error('a CTA outside the vocabulary was accepted');
    }
    expect(result.fieldErrors?.cta).toBeDefined();
  });

  it('rejects a status that is not one of the five', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, status: 'in_review' }));

    if (result.ok) {
      throw new Error('a status outside the vocabulary was accepted');
    }
    expect(result.fieldErrors?.status).toBeDefined();
  });

  it('rejects an empty CTA rather than reading it as "leave it alone"', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, cta: '' }));

    if (result.ok) {
      throw new Error('an empty CTA was accepted');
    }
    expect(result.fieldErrors?.cta).toBeDefined();
  });

  it('rejects an empty status rather than reading it as "leave it alone"', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, status: '' }));

    if (result.ok) {
      throw new Error('an empty status was accepted');
    }
    expect(result.fieldErrors?.status).toBeDefined();
  });

  it.each(COPY_CTAS.map((entry) => entry.key))('saves %s as a CTA', async (cta) => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, cta }));

    expect(saved(result, `the ${cta} call to action was refused`).id).toBe(STORED.id);
  });

  it.each(COPY_STATUS.map((entry) => entry.key))('saves %s as a status', async (status) => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, status }));

    expect(saved(result, `the ${status} status was refused`).id).toBe(STORED.id);
  });
});

describe('with Clerk configured · the creative the copy is tied to', () => {
  it('accepts the "No creative" option — an unattached row is ordinary, not degraded', async () => {
    live();
    // Nothing is looked up for a detach, so an unresolvable brief cannot affect it.
    seam.briefResolves = false;

    const result = await updateCopyAction(null, form({ ...filled, creativeBriefId: '' }));

    expect(saved(result, 'a detached copy row was refused').id).toBe(STORED.id);
  });

  it('refuses a creative that does not resolve in the scope', async () => {
    live();
    seam.briefResolves = false;

    const result = await updateCopyAction(null, form(filled));

    if (result.ok) {
      throw new Error("another brand's creative was accepted");
    }
    expect(result.fieldErrors?.creativeBriefId).toBe('That creative is no longer available.');
  });
});

describe('with Clerk configured · a key that was not submitted', () => {
  it('leaves the columns the form did not send exactly as they are', async () => {
    live();

    // Only the headline. The stored CTA and status carry the draft, so this must SAVE rather than
    // be judged as though the panel had cleared the two vocabularies it never edits.
    const result = await updateCopyAction(
      null,
      form({ id: STORED.id, headline: 'A New Headline' }),
    );

    expect(saved(result, 'a partial save was judged as a clear').id).toBe(STORED.id);
  });
});

describe('with Clerk configured · the character guidance is a tilde, not a rule', () => {
  it('saves a field past its guidance and reports it as a warning', async () => {
    live();

    const result = await updateCopyAction(
      null,
      form({ ...filled, primaryCopy: 'x'.repeat(260), linkDescription: 'y'.repeat(60) }),
    );

    // Over the ~125 and ~27 guides and still a save: Meta truncates, it does not reject.
    const success = saved(result, 'an over-long field was refused');
    expect(success.warnings.primaryCopy).toContain('over the ~125 guide');
    expect(success.warnings.linkDescription).toContain('over the ~27 guide');
  });

  it('reports no warning for a save inside every guide', async () => {
    live();

    const result = await updateCopyAction(null, form(filled));

    expect(saved(result, 'a save inside the guides was refused').warnings).toEqual({});
  });
});

describe('with Clerk configured · the session', () => {
  it('refuses when the session expired between rendering and submitting', async () => {
    live();
    seam.actor = null;

    const result = await updateCopyAction(null, form(filled));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
  });
});
