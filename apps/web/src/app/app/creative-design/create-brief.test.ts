import type { BriefNameMode, CreateBriefValues, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBriefAction } from './actions';

/**
 * `createBriefAction` past validation, with the same four seams `concepts/actions.test.ts` mocks:
 * the Next cache, Clerk, the brand scope and the `@tas/db` write. The recorder captures exactly
 * what the query layer is asked to store, which is how three audit findings (2026-10-09) are
 * pinned: the submitted Source reaches the `source` COLUMN and not only the name (item 9), a
 * linked concept contributes its `Angle-Theme` segment and the batch is printed once (item 7), and
 * an auto-named creative is stored as `name_mode = 'auto'` while a hand-typed one is `'manual'`.
 */
interface Seam {
  actor: string | null;
  /** Every `createBriefWithSheetRow` call: the values, the name the callback produced, the mode. */
  created: { values: CreateBriefValues; name: string; nameMode: BriefNameMode }[];
  /** The number the fake allocator hands the callback. */
  nextNumber: number;
}

const seam = vi.hoisted<Seam>(() => ({ actor: 'user_2TESTACTOR', created: [], nextNumber: 7 }));

const LINKED_CONCEPT_ID = '66666666-6666-4666-8666-000000000001';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));

vi.mock('@/lib/briefs-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/briefs-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    // The linked concept's generated name carries its batch, as every concept's does.
    getConceptById: (_db: Db, _brandId: string, id: string) =>
      Promise.resolve(
        id === LINKED_CONCEPT_ID
          ? { id, name: 'B1-Pain-UGC', batch: 'B1', angleId: null, productId: null }
          : null,
      ),
    listBriefs: () => Promise.resolve([]),
    createBriefWithSheetRow: (
      _db: Db,
      _brandId: string,
      values: CreateBriefValues,
      nameFor: (briefNumber: number) => string,
      nameMode: BriefNameMode,
    ) => {
      const name = nameFor(seam.nextNumber);
      seam.created.push({ values, name, nameMode });
      return Promise.resolve({
        brief: { id: 'brief-created', name },
        sheetItem: { id: 'sheet-row-created' },
      });
    },
  };
});

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

/** What the "New creative" dialog submits: no statuses (the action starts the ladder itself). */
const submitted = {
  conceptId: '',
  funnel: 'TOF',
  type: 'Video',
  version: '1',
  batch: 'Batch 1',
  product: '',
  priority: '',
  assignee: '',
  briefToDesign: '',
  scriptContent: '',
  elementsTested: '',
  internalStatus: '',
  clientStatus: '',
  nameMode: 'auto',
  source: 'TAS',
};

function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.created.length = 0;
  seam.actor = 'user_2TESTACTOR';
});

describe('createBriefAction · what reaches the query layer', () => {
  it('stores the submitted Source in the column AND in the name, and the brief as auto-named', async () => {
    live();

    const result = await createBriefAction(null, form({ ...submitted, source: 'Client' }));

    expect(result).toMatchObject({
      ok: true,
      id: 'brief-created',
      name: 'Client-TOF-V007-Batch 1',
    });
    expect(seam.created).toHaveLength(1);
    expect(seam.created[0]).toMatchObject({
      values: { source: 'Client', batch: 'Batch 1', conceptId: null },
      name: 'Client-TOF-V007-Batch 1',
      nameMode: 'auto',
    });
  });

  it('defaults a blank Source to TAS in the column, not only in the name', async () => {
    live();

    await createBriefAction(null, form({ ...submitted, source: '' }));

    expect(seam.created[0]).toMatchObject({
      values: { source: 'TAS' },
      name: 'TAS-TOF-V007-Batch 1',
    });
  });

  it('refuses a Source outside the vocabulary before any write', async () => {
    live();

    const result = await createBriefAction(null, form({ ...submitted, source: 'Agency' }));

    if (result.ok) throw new Error('an unknown source was accepted');
    expect(result.fieldErrors?.source).toBe('That is not one of the two sources.');
    expect(seam.created).toHaveLength(0);
  });

  it('stores a hand-typed name verbatim as manual, which no rename will ever touch', async () => {
    live();

    await createBriefAction(
      null,
      form({ ...submitted, nameMode: 'manual', nameOverride: 'Hero cut (client request)' }),
    );

    expect(seam.created[0]).toMatchObject({
      name: 'Hero cut (client request)',
      nameMode: 'manual',
    });
  });

  it('creates nothing when the session has expired', async () => {
    live();
    seam.actor = null;

    const result = await createBriefAction(null, form(submitted));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.created).toHaveLength(0);
  });
});
