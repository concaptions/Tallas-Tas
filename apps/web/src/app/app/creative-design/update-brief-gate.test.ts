import type { BriefInput, CreativeBrief, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateBriefAction } from './actions';

/**
 * The brief page's save past validation and into the scope, with the seams `create-brief.test.ts`
 * mocks. Pins the Oct 12 rules on the full-page form: the QA gate re-runs on the server against
 * the row's stored ticks (scope 4), and a move into a revision state clears the ticks in the same
 * patch (scope 5).
 */
interface Seam {
  brief: CreativeBrief | null;
  updates: Partial<BriefInput>[];
}

const seam = vi.hoisted<Seam>(() => ({ brief: null, updates: [] }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: 'user_2TESTACTOR' }),
}));
vi.mock('@/lib/actor', () => ({
  currentActor: () => Promise.resolve({ fullName: 'Test Actor' }),
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
    getBriefById: () => Promise.resolve(seam.brief),
    getConceptById: () => Promise.resolve(null),
    insertActivity: () => Promise.resolve([]),
    updateBrief: (_db: Db, _brandId: string, id: string, patch: Partial<BriefInput>) => {
      seam.updates.push(patch);
      return Promise.resolve({ ...seam.brief, ...patch, id });
    },
  };
});

const BRIEF_ID = '77777777-7777-4777-8777-000000000001';

function brief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    id: BRIEF_ID,
    name: 'TAS_TOF_V_007_B1',
    type: 'Video',
    sequence: 1,
    internalStatus: 'ad_submitted',
    clientStatus: 'pending_for_approval',
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    ...overrides,
  } as CreativeBrief;
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const filled = {
  id: BRIEF_ID,
  conceptId: '',
  funnel: 'TOF',
  type: 'Video',
  version: '1',
  batch: 'B1',
  product: '',
  priority: '',
  assignee: '',
  briefToDesign: '',
  scriptContent: '',
  elementsTested: '',
};

afterEach(() => {
  vi.unstubAllEnvs();
  seam.brief = null;
  seam.updates.length = 0;
});

describe('updateBriefAction · the QA gate and reset on the full page', () => {
  it('refuses Approve while a required tick is unset, naming it under the internal field', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.brief = brief({ qaStrategist: true });

    const result = await updateBriefAction(
      null,
      form({ ...filled, internalStatus: 'approved', clientStatus: 'pending_for_approval' }),
    );

    if (result.ok) throw new Error('an unticked creative was approved');
    expect(result.fieldErrors?.internalStatus).toBe(
      'Video Editor QA must be ticked before this brief can go to the client.',
    );
    expect(seam.updates).toEqual([]);
  });

  it('approves once the row carries the ticks, and never touches them', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.brief = brief({ qaVideoEditor: true, qaStrategist: true });

    const result = await updateBriefAction(
      null,
      form({ ...filled, internalStatus: 'approved', clientStatus: 'pending_for_approval' }),
    );

    expect(result).toMatchObject({ ok: true, id: BRIEF_ID });
    expect(seam.updates[0]).toMatchObject({ internalStatus: 'approved' });
    expect(seam.updates[0]).not.toHaveProperty('qaVideoEditor');
  });

  it('clears the three ticks in the same patch as a move to Revisions Needed', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    // The seam brief starts at `ad_submitted`, the step `revisions_needed` is reachable from.
    seam.brief = brief({ qaVideoEditor: true, qaStrategist: true });

    await updateBriefAction(
      null,
      form({ ...filled, internalStatus: 'revisions_needed', clientStatus: 'pending_for_approval' }),
    );

    expect(seam.updates[0]).toMatchObject({
      internalStatus: 'revisions_needed',
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
    });
  });

  it('gates a client resubmission the same way', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.brief = brief({ internalStatus: 'approved', clientStatus: 'revisions_needed' });

    const result = await updateBriefAction(
      null,
      form({ ...filled, internalStatus: 'approved', clientStatus: 'revisions_submitted' }),
    );

    if (result.ok) throw new Error('an unticked creative was resubmitted');
    expect(result.fieldErrors?.clientStatus).toContain('must be ticked');
  });
});
