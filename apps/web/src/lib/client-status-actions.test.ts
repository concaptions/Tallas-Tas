import type { BriefInput, CreativeBrief, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateClientStatus } from './client-status-actions';

/**
 * The shared client-status action for `creative_briefs` past validation: the Oct 12 QA gate
 * re-runs here for a resubmission (scope 4), and a move into Revisions Needed carries the QA
 * reset in the same statement (scope 5). The other three tables are untouched by both.
 */
interface Seam {
  brief: CreativeBrief | null;
  briefMoves: { status: string; alongside: Partial<BriefInput> | undefined }[];
  conceptMoves: string[];
}

const seam = vi.hoisted<Seam>(() => ({ brief: null, briefMoves: [], conceptMoves: [] }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: 'user_2TESTACTOR' }),
}));
vi.mock('./concepts-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./concepts-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));
vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    getBriefById: () => Promise.resolve(seam.brief),
    updateBriefClientStatus: (
      _db: Db,
      _brandId: string,
      id: string,
      status: string,
      _note: string | null,
      _actor: string,
      alongside?: Partial<BriefInput>,
    ) => {
      seam.briefMoves.push({ status, alongside });
      return Promise.resolve({ ...seam.brief, id, clientStatus: status });
    },
    updateConceptClientStatus: (_db: Db, _brandId: string, id: string, status: string) => {
      seam.conceptMoves.push(status);
      return Promise.resolve({ id, clientStatus: status });
    },
  };
});

const BRIEF_ID = '77777777-7777-4777-8777-000000000001';

function brief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    id: BRIEF_ID,
    type: 'Video',
    internalStatus: 'approved',
    clientStatus: 'pending_for_approval',
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    ...overrides,
  } as CreativeBrief;
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.brief = null;
  seam.briefMoves.length = 0;
  seam.conceptMoves.length = 0;
});

describe('updateClientStatus on creative_briefs', () => {
  it('carries the QA reset in the same statement as Revisions Needed', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.brief = brief({ qaVideoEditor: true, qaStrategist: true });

    const result = await updateClientStatus({
      tableKey: 'creative_briefs',
      recordId: BRIEF_ID,
      newStatus: 'revisions_needed',
      note: 'Trim the ending.',
    });

    expect(result).toMatchObject({ ok: true, status: 'revisions_needed' });
    expect(seam.briefMoves).toEqual([
      {
        status: 'revisions_needed',
        alongside: { qaVideoEditor: false, qaDesigner: false, qaStrategist: false },
      },
    ]);
  });

  it('refuses a resubmission until the required ticks are set, then allows it with no reset', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.brief = brief({ clientStatus: 'revisions_needed' });

    expect(
      await updateClientStatus({
        tableKey: 'creative_briefs',
        recordId: BRIEF_ID,
        newStatus: 'revisions_submitted',
      }),
    ).toEqual({
      ok: false,
      error: 'Video Editor QA must be ticked before this brief can go to the client.',
    });
    expect(seam.briefMoves).toEqual([]);

    seam.brief = brief({
      clientStatus: 'revisions_needed',
      qaVideoEditor: true,
      qaStrategist: true,
    });
    expect(
      await updateClientStatus({
        tableKey: 'creative_briefs',
        recordId: BRIEF_ID,
        newStatus: 'revisions_submitted',
      }),
    ).toMatchObject({ ok: true });
    expect(seam.briefMoves).toEqual([{ status: 'revisions_submitted', alongside: {} }]);
  });

  it('leaves the client’s own decisions ungated', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.brief = brief();
    expect(
      await updateClientStatus({
        tableKey: 'creative_briefs',
        recordId: BRIEF_ID,
        newStatus: 'approved',
      }),
    ).toMatchObject({ ok: true });
    expect(seam.briefMoves).toEqual([{ status: 'approved', alongside: {} }]);
  });

  it('does not touch the other tables', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    expect(
      await updateClientStatus({
        tableKey: 'concepts',
        recordId: 'concept-1',
        newStatus: 'approved',
      }),
    ).toMatchObject({ ok: true });
    expect(seam.conceptMoves).toEqual(['approved']);
  });
});
