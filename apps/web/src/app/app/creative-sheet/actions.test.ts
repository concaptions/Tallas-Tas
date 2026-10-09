import type { BriefInput, CreativeBrief, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  moveCreativeSheetItemAction,
  updateCreativeSheetItemAction,
  updateCreativeSheetItemDimensionsAction,
} from './actions';

/**
 * The Creative Sheet's three mutations past validation, with the same seams the brief actions'
 * tests mock: the Next cache, Clerk, the actor name, the brand scope, and the `@tas/db` writers,
 * which are recorders. Pins the single-source contract (2026-10-09): a sheet save or drop writes
 * the BRIEF — `updateBrief`, `updateBriefClientStatus`, `updateBriefDimensions` — through the
 * same state-machine checks the brief page applies, and never anything else.
 */
interface Seam {
  actor: string | null;
  brief: CreativeBrief | null;
  updates: { id: string; patch: Partial<BriefInput> }[];
  clientMoves: { id: string; status: string }[];
  dimensionWrites: { id: string; dimensions: readonly string[] }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  brief: null,
  updates: [],
  clientMoves: [],
  dimensionWrites: [],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));
vi.mock('@/lib/actor', () => ({
  currentActor: () => Promise.resolve({ fullName: 'Test Actor' }),
}));
vi.mock('@/lib/creative-sheet-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/creative-sheet-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));
vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    getBriefById: () => Promise.resolve(seam.brief),
    insertActivity: () => Promise.resolve([]),
    updateBrief: (_db: Db, _brandId: string, id: string, patch: Partial<BriefInput>) => {
      seam.updates.push({ id, patch });
      return Promise.resolve({ ...seam.brief, ...patch, id });
    },
    updateBriefClientStatus: (_db: Db, _brandId: string, id: string, status: string) => {
      seam.clientMoves.push({ id, status });
      return Promise.resolve({ ...seam.brief, id, clientStatus: status });
    },
    updateBriefDimensions: (
      _db: Db,
      _brandId: string,
      id: string,
      dimensions: readonly string[],
    ) => {
      seam.dimensionWrites.push({ id, dimensions });
      return Promise.resolve({ ...seam.brief, id, dimensions: [...dimensions] });
    },
  };
});

const BRIEF_ID = '77777777-7777-4777-8777-000000000001';

/** A video brief sitting at Ad Submitted on the internal track, pending on the client track. */
function brief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    id: BRIEF_ID,
    type: 'Video',
    internalStatus: 'ad_submitted',
    clientStatus: 'pending_for_approval',
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    clickForAiSpellChecker: false,
    qaChecklistDoc: null,
    dimensions: ['4:5'],
    ...overrides,
  } as CreativeBrief;
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.brief = null;
  seam.updates.length = 0;
  seam.clientMoves.length = 0;
  seam.dimensionWrites.length = 0;
});

describe('in demo mode', () => {
  it('refuses every write before looking at anything', async () => {
    expect(await updateCreativeSheetItemAction(null, form({ id: BRIEF_ID }))).toEqual({
      ok: false,
      error: 'Sign in required to save changes.',
    });
    expect(await updateCreativeSheetItemDimensionsAction(BRIEF_ID, ['1:1'])).toEqual({
      ok: false,
      error: 'Sign in required to save changes.',
    });
    expect(
      await moveCreativeSheetItemAction(
        null,
        form({ id: BRIEF_ID, field: 'status', value: 'approved' }),
      ),
    ).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('updateCreativeSheetItemAction · writes the brief', () => {
  it('saves the flags and checklist on the brief and moves the internal track one legal step', async () => {
    live();
    seam.brief = brief();

    const result = await updateCreativeSheetItemAction(
      null,
      form({
        id: BRIEF_ID,
        internalStatus: 'approved',
        status: '',
        qaVideoEditor: 'true',
        qaStrategist: 'true',
        spellCheckRequested: 'true',
        qaChecklistDoc: 'https://docs.example/qa\n\nhttps://docs.example/markup',
      }),
    );

    expect(result).toMatchObject({ ok: true, id: BRIEF_ID });
    expect(seam.updates).toEqual([
      {
        id: BRIEF_ID,
        patch: {
          internalStatus: 'approved',
          clientStatus: 'pending_for_approval',
          qaVideoEditor: true,
          qaDesigner: false,
          qaStrategist: true,
          clickForAiSpellChecker: true,
          qaChecklistDoc: ['https://docs.example/qa', 'https://docs.example/markup'],
        },
      },
    ]);
  });

  it('refuses an internal move the machine does not allow, and writes nothing', async () => {
    live();
    seam.brief = brief({ internalStatus: 'sent_to_video_editor' });

    const result = await updateCreativeSheetItemAction(
      null,
      form({ id: BRIEF_ID, internalStatus: 'approved', status: '', qaChecklistDoc: '' }),
    );

    if (result.ok) throw new Error('a skipped step was accepted');
    expect(result.fieldErrors?.internalStatus).toBe(
      'That is not the next step on the internal track.',
    );
    expect(seam.updates).toEqual([]);
  });

  it('refuses a status from the other track’s ladder', async () => {
    live();
    seam.brief = brief({ type: 'Static', internalStatus: 'sent_to_designer' });

    const result = await updateCreativeSheetItemAction(
      null,
      form({
        id: BRIEF_ID,
        internalStatus: 'video_editing_in_progress',
        status: '',
        qaChecklistDoc: '',
      }),
    );

    if (result.ok) throw new Error('a video step was accepted on a static brief');
    expect(result.fieldErrors?.internalStatus).toBe(
      'That is not a status on this creative’s internal track.',
    );
  });

  it('keeps the client gate: no client move while internal is below Approved', async () => {
    live();
    seam.brief = brief();

    const result = await updateCreativeSheetItemAction(
      null,
      form({ id: BRIEF_ID, internalStatus: '', status: 'approved', qaChecklistDoc: '' }),
    );

    if (result.ok) throw new Error('the client track moved behind a shut gate');
    expect(result.fieldErrors?.status).toBe(
      'The client track opens once internal status reaches Approved.',
    );
    expect(seam.updates).toEqual([]);
  });

  it('stamps client_status_updated_at when the client track moves in the same save', async () => {
    live();
    seam.brief = brief({ internalStatus: 'approved' });

    const result = await updateCreativeSheetItemAction(
      null,
      form({ id: BRIEF_ID, internalStatus: '', status: 'approved', qaChecklistDoc: '' }),
    );

    expect(result).toMatchObject({ ok: true });
    expect(seam.updates[0]?.patch).toMatchObject({
      internalStatus: 'approved',
      clientStatus: 'approved',
    });
    expect(seam.updates[0]?.patch.clientStatusUpdatedAt).toBeInstanceOf(Date);
  });

  it('refuses a checklist line that is not a link', async () => {
    live();
    seam.brief = brief();

    const result = await updateCreativeSheetItemAction(
      null,
      form({ id: BRIEF_ID, internalStatus: '', status: '', qaChecklistDoc: 'not a link' }),
    );

    if (result.ok) throw new Error('a bare word was accepted as a link');
    expect(result.fieldErrors?.qaChecklistDoc).toContain('full link');
  });
});

describe('updateCreativeSheetItemDimensionsAction · the one write path', () => {
  it('normalises the array and writes the brief’s dimensions', async () => {
    live();
    seam.brief = brief();

    const result = await updateCreativeSheetItemDimensionsAction(BRIEF_ID, [
      '9:16',
      'IG Story / Reel',
      '4:5',
    ]);

    expect(result).toMatchObject({ ok: true, id: BRIEF_ID });
    // The legacy name maps to 9:16 and is deduplicated; the order is the domain's normalised order.
    expect(seam.dimensionWrites).toHaveLength(1);
    expect(seam.dimensionWrites[0]?.id).toBe(BRIEF_ID);
    expect([...(seam.dimensionWrites[0]?.dimensions ?? [])].sort()).toEqual(['4:5', '9:16']);
  });

  it('refuses a value that is not a ratio or a legacy placement', async () => {
    live();
    const result = await updateCreativeSheetItemDimensionsAction(BRIEF_ID, ['']);
    if (result.ok) throw new Error('an empty dimension was accepted');
    expect(result.fieldErrors?.dimensions).toBe('That is not one of the delivery ratios.');
    expect(seam.dimensionWrites).toEqual([]);
  });
});

describe('moveCreativeSheetItemAction · a drop is a brief move', () => {
  it('writes the internal track through updateBrief', async () => {
    live();
    seam.brief = brief({ internalStatus: 'video_editing_in_progress' });

    const result = await moveCreativeSheetItemAction(
      null,
      form({ id: BRIEF_ID, field: 'internalStatus', value: 'ad_submitted' }),
    );

    expect(result).toMatchObject({ ok: true, id: BRIEF_ID });
    expect(seam.updates).toEqual([{ id: BRIEF_ID, patch: { internalStatus: 'ad_submitted' } }]);
  });

  it('writes the client track through updateBriefClientStatus once the gate is open', async () => {
    live();
    seam.brief = brief({ internalStatus: 'approved' });

    const result = await moveCreativeSheetItemAction(
      null,
      form({ id: BRIEF_ID, field: 'status', value: 'revisions_needed' }),
    );

    expect(result).toMatchObject({ ok: true, id: BRIEF_ID });
    expect(seam.clientMoves).toEqual([{ id: BRIEF_ID, status: 'revisions_needed' }]);
    expect(seam.updates).toEqual([]);
  });

  it('refuses the trailing Other column and a column the machine cannot reach', async () => {
    live();
    seam.brief = brief();

    expect(
      await moveCreativeSheetItemAction(null, form({ id: BRIEF_ID, field: 'status', value: '' })),
    ).toEqual({ ok: false, error: 'That column is not a status this sheet knows.' });
    expect(
      await moveCreativeSheetItemAction(
        null,
        form({ id: BRIEF_ID, field: 'status', value: 'launched' }),
      ),
    ).toEqual({
      ok: false,
      error: 'The client track opens once internal status reaches Approved.',
    });
    expect(seam.clientMoves).toEqual([]);
  });
});
