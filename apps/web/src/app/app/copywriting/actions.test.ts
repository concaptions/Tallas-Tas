import { demoCopy, type CopyListRow, type Db } from '@tas/db';
import { COPY_CTAS } from '@tas/domain/copy';
import { COPY_STATUS } from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCopyAction,
  updateCopyAction,
  updateCopyClientApproval,
  type CopyActionResult,
  type CopyActionSuccess,
} from './actions';

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

/** One call the action made to the copy-type sync, exactly as the query layer received it. */
interface SyncedCopyTypes {
  readonly brandId: string;
  readonly copyId: string;
  readonly copyTypeIds: readonly string[];
}

/** One call the action made to the collection-link setter. */
interface LinkedCollection {
  readonly brandId: string;
  readonly copyId: string;
  readonly collectionId: string | null;
}

interface Seam {
  /** Null stands for a session that expired between rendering the panel and submitting it. */
  actor: string | null;
  /** The row `getCopyById` resolves; null is another brand's id, or a soft-deleted row. */
  stored: CopyListRow | null;
  /** Whether the submitted creative resolves INSIDE the scope. */
  briefResolves: boolean;
  /** Whether the submitted collection resolves INSIDE the scope (Oct 5 Linked Collection). */
  collectionResolves: boolean;
  /** Whether the submitted product resolves INSIDE the scope (Oct 5 Linked Product). */
  productResolves: boolean;
  /** Every `syncCopywritingCopyTypesInBrand` call, so a test can assert it ran once or never. */
  synced: SyncedCopyTypes[];
  /** Every `setCollectionCopywritingLinkInBrand` call. */
  collectionLinks: LinkedCollection[];
  /** Every `updateCopy` patch, so a test can assert what reached the setter for the two row-side links. */
  /** The rows `listCopy` answers with, and every `insertCopy` call (SMOKE-11). */
  existing: { copyNumber: number | null }[];
  inserted: Record<string, unknown>[];
  updates: {
    readonly productId?: string | null;
    readonly creativeBriefId?: string | null;
    readonly clientApprovalStatus?: string | null;
  }[];
}

/** Values the mocked seams read at call time, so a test can move the ground under one action. */
const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  stored: null,
  briefResolves: true,
  collectionResolves: true,
  productResolves: true,
  synced: [],
  collectionLinks: [],
  existing: [],
  inserted: [],
  updates: [],
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

/** Only the six scoped calls the action makes; every other export stays the real one. */
vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  getCopyById: (): Promise<CopyListRow | null> => Promise.resolve(seam.stored),
  listCopy: () => Promise.resolve(seam.existing),
  insertCopy: (_db: Db, _brandId: string, values: Record<string, unknown>) => {
    seam.inserted.push(values);
    return Promise.resolve({ id: 'copy-new', ...values });
  },
  getBriefById: (_db: Db, _brandId: string, id: string): Promise<{ id: string } | null> =>
    Promise.resolve(seam.briefResolves ? { id } : null),
  getCollectionById: (_db: Db, _brandId: string, id: string): Promise<{ id: string } | null> =>
    Promise.resolve(seam.collectionResolves ? { id } : null),
  getProductById: (_db: Db, _brandId: string, id: string): Promise<{ id: string } | null> =>
    Promise.resolve(seam.productResolves ? { id } : null),
  updateCopy: (
    _db: Db,
    _brandId: string,
    id: string,
    patch: {
      productId?: string | null;
      creativeBriefId?: string | null;
      clientApprovalStatus?: string | null;
    },
  ): Promise<{ id: string }> => {
    seam.updates.push({
      productId: patch.productId,
      creativeBriefId: patch.creativeBriefId,
      clientApprovalStatus: patch.clientApprovalStatus,
    });
    return Promise.resolve({ id });
  },
  syncCopywritingCopyTypesInBrand: (
    _db: Db,
    brandId: string,
    copyId: string,
    copyTypeIds: readonly string[],
  ): Promise<void> => {
    seam.synced.push({ brandId, copyId, copyTypeIds });
    return Promise.resolve();
  },
  setCollectionCopywritingLinkInBrand: (
    _db: Db,
    brandId: string,
    copyId: string,
    collectionId: string | null,
  ): Promise<boolean> => {
    seam.collectionLinks.push({ brandId, copyId, collectionId });
    return Promise.resolve(true);
  },
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

/**
 * The submission with the Copy Types picker on it, exactly as the panel posts it: the empty-valued
 * marker first, then one repeated `copyTypeIds` entry per pressed toggle.
 */
function formWithCopyTypes(copyTypeIds: readonly string[]): FormData {
  const data = form(filled);
  data.append('copyTypeIds', '');
  for (const id of copyTypeIds) {
    data.append('copyTypeIds', id);
  }
  return data;
}

const TYPE_PAS = 'c0b7a1d3-0013-4013-8013-000000000001';
const TYPE_OFFER_LED = 'c0b7a1d3-0013-4013-8013-000000000003';

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
  seam.collectionResolves = true;
  seam.productResolves = true;
  seam.synced = [];
  seam.collectionLinks = [];
  seam.updates = [];
  seam.inserted = [];
  seam.existing = [];
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

describe('with Clerk configured · the copy types the row is tagged with', () => {
  it('replaces the tags with exactly the pressed toggles, inside the scope, after the row saved', async () => {
    live();

    const result = await updateCopyAction(null, formWithCopyTypes([TYPE_PAS, TYPE_OFFER_LED]));

    expect(saved(result, 'a save with two copy types was refused').id).toBe(STORED.id);
    expect(seam.synced).toEqual([
      { brandId: 'brand-under-test', copyId: STORED.id, copyTypeIds: [TYPE_PAS, TYPE_OFFER_LED] },
    ]);
  });

  it('clears every tag when the picker was on the form with nothing pressed', async () => {
    live();

    // The marker alone: the picker was there, and no toggle was on. That is a clear, not a skip.
    const result = await updateCopyAction(null, formWithCopyTypes([]));

    expect(saved(result, 'a save that cleared the copy types was refused').id).toBe(STORED.id);
    expect(seam.synced).toEqual([
      { brandId: 'brand-under-test', copyId: STORED.id, copyTypeIds: [] },
    ]);
  });

  it('leaves the tags alone when the form never carried the picker', async () => {
    live();

    const result = await updateCopyAction(null, form(filled));

    expect(saved(result, 'a save without the picker was refused').id).toBe(STORED.id);
    expect(seam.synced).toEqual([]);
  });

  it('syncs nothing when the row itself did not save', async () => {
    live();
    seam.stored = null;

    const result = await updateCopyAction(null, formWithCopyTypes([TYPE_PAS]));

    expect(result).toEqual({ ok: false, error: 'That copy is no longer available.' });
    expect(seam.synced).toEqual([]);
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

/** The Oct 5 Linked Collection single-select. Writes `collections.copywriting_id` through the
 * owner-side setter; the action resolves the submitted id in the scope first. */
const COLLECTION_BFCM = '11223344-1122-4334-8556-000000000001';

describe('with Clerk configured · the Linked Collection control', () => {
  it('leaves the owner-side FK alone when the form never carried the control', async () => {
    live();

    const result = await updateCopyAction(null, form(filled));

    expect(saved(result, 'a save without the collection control was refused').id).toBe(STORED.id);
    expect(seam.collectionLinks).toEqual([]);
  });

  it('reassigns the collection to the picked id when the control was submitted', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, collectionId: COLLECTION_BFCM }));

    expect(saved(result, 'a save with a picked collection was refused').id).toBe(STORED.id);
    expect(seam.collectionLinks).toEqual([
      { brandId: 'brand-under-test', copyId: STORED.id, collectionId: COLLECTION_BFCM },
    ]);
  });

  it('unlinks the owner-side FK when the "No collection" option was submitted', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, collectionId: '' }));

    expect(saved(result, 'a save that cleared the collection was refused').id).toBe(STORED.id);
    expect(seam.collectionLinks).toEqual([
      { brandId: 'brand-under-test', copyId: STORED.id, collectionId: null },
    ]);
  });

  it('refuses a collection that does not resolve in the scope', async () => {
    live();
    seam.collectionResolves = false;

    const result = await updateCopyAction(null, form({ ...filled, collectionId: COLLECTION_BFCM }));

    if (result.ok) {
      throw new Error("another brand's collection was accepted");
    }
    expect(result.fieldErrors?.collectionId).toBe('That collection is no longer available.');
    expect(seam.collectionLinks).toEqual([]);
  });
});

/** The Oct 5 Linked Product single-select. Writes `copywriting.product_id` directly through
 * `updateCopy`; the action resolves the submitted id in the scope first. */
const PRODUCT_BLANKET = 'aa112233-4455-4667-8899-000000000001';

describe('with Clerk configured · the Linked Product control', () => {
  it('leaves the row-side FK alone when the form never carried the control', async () => {
    live();

    const result = await updateCopyAction(null, form(filled));

    expect(saved(result, 'a save without the product control was refused').id).toBe(STORED.id);
    const [first] = seam.updates;
    expect(first?.productId).toBe(STORED.productId);
  });

  it('accepts a copy linked to a PRODUCT ONLY — no creative, no collection (Oct 7 item 5)', async () => {
    live();
    seam.briefResolves = false;

    const result = await updateCopyAction(
      null,
      form({ ...filled, creativeBriefId: '', collectionId: '', productId: PRODUCT_BLANKET }),
    );

    expect(saved(result, 'a product-only copy row was refused').id).toBe(STORED.id);
    const [first] = seam.updates;
    expect(first?.productId).toBe(PRODUCT_BLANKET);
    expect(first?.creativeBriefId).toBeNull();
    expect(seam.collectionLinks).toEqual([
      { brandId: 'brand-under-test', copyId: STORED.id, collectionId: null },
    ]);
  });

  it('writes the picked product id to copywriting.product_id', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, productId: PRODUCT_BLANKET }));

    expect(saved(result, 'a save with a picked product was refused').id).toBe(STORED.id);
    const [first] = seam.updates;
    expect(first?.productId).toBe(PRODUCT_BLANKET);
  });

  it('clears copywriting.product_id when the "No product" option was submitted', async () => {
    live();

    const result = await updateCopyAction(null, form({ ...filled, productId: '' }));

    expect(saved(result, 'a save that cleared the product was refused').id).toBe(STORED.id);
    const [first] = seam.updates;
    expect(first?.productId).toBeNull();
  });

  it('refuses a product that does not resolve in the scope', async () => {
    live();
    seam.productResolves = false;

    const result = await updateCopyAction(null, form({ ...filled, productId: PRODUCT_BLANKET }));

    if (result.ok) {
      throw new Error("another brand's product was accepted");
    }
    expect(result.fieldErrors?.productId).toBe('That product is no longer available.');
    expect(seam.updates).toEqual([]);
  });
});

describe('with Clerk configured · updateCopyClientApproval — one client vocabulary (2026-10-10)', () => {
  it('stores a CLIENT_STATUS key as it is, launched included', async () => {
    live();

    const result = await updateCopyClientApproval(STORED.id, 'launched');

    expect(saved(result, 'a client-track key was refused').id).toBe(STORED.id);
    expect(seam.updates.at(-1)?.clientApprovalStatus).toBe('launched');
  });

  it('maps the retired four-value spelling onto the client track before writing', async () => {
    live();

    await updateCopyClientApproval(STORED.id, 'revision_needed', 'Tighten the hook.');
    await updateCopyClientApproval(STORED.id, 'pending_client_approval');

    expect(seam.updates.map((patch) => patch.clientApprovalStatus)).toEqual([
      'revisions_needed',
      'pending_for_approval',
    ]);
  });

  it('refuses a word outside both spellings before any write', async () => {
    live();

    const result = await updateCopyClientApproval(STORED.id, 'nonsense');

    expect(result.ok).toBe(false);
    expect(seam.updates).toEqual([]);
  });
});

describe('createCopyAction — "New copy" (SMOKE-11)', () => {
  it('refuses in demo mode before any read', async () => {
    const result = await createCopyAction();
    expect(result.ok).toBe(false);
    expect(seam.inserted).toEqual([]);
  });

  it("creates a blank row numbered after the brand's highest Copy #, and returns its id", async () => {
    live();
    seam.existing = [{ copyNumber: 3 }, { copyNumber: 7 }, { copyNumber: null }];

    const result = await createCopyAction();

    expect(saved(result, 'the first copy was refused').id).toBe('copy-new');
    expect(seam.inserted).toEqual([
      { copyNumber: 8, cta: COPY_CTAS[0].key, status: COPY_STATUS[0].key },
    ]);
  });

  it('starts at the first number on an empty workspace', async () => {
    live();
    seam.existing = [];
    await createCopyAction();
    expect(seam.inserted[0]?.['copyNumber']).toBe(1);
  });
});
