import type { BriefInput, CreateBriefValues, CreativeBrief, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { duplicateValues } from './duplicate-values';
import {
  approveCreativeAction,
  bulkMoveCreativesAction,
  deleteCreativesAction,
  duplicateCreativesAction,
  postCreativeCommentAction,
  requestChangesAction,
  submitToClientAction,
} from './review-actions';

/**
 * The Oct 12 review and multi-select actions past validation, with the sheet's usual seams
 * mocked (Next cache, Clerk, the actor name, the brand scope, the `@tas/db` writers as recorders).
 * What is pinned: the server RE-RUNS the two client-track gates (scope 4), a move into a revision
 * state clears QA in the same patch (scope 5), Duplicate's copy-and-reset rules and Delete's soft
 * delete (scope 3), and that a bulk move is exactly as strict as a single one.
 */
interface Seam {
  actor: string | null;
  briefs: CreativeBrief[];
  updates: { id: string; patch: Partial<BriefInput> }[];
  clientMoves: { id: string; status: string; alongside: Partial<BriefInput> | undefined }[];
  created: { values: CreateBriefValues; name: string; nameMode: string }[];
  deleted: string[][];
  comments: { recordType: string; recordId: string; body: string }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  briefs: [],
  updates: [],
  clientMoves: [],
  created: [],
  deleted: [],
  comments: [],
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
    getBriefById: (_db: Db, _brandId: string, id: string) =>
      Promise.resolve(seam.briefs.find((row) => row.id === id) ?? null),
    listBriefsByIds: (_db: Db, _brandId: string, ids: readonly string[]) =>
      Promise.resolve(seam.briefs.filter((row) => ids.includes(row.id))),
    getConceptById: () => Promise.resolve({ name: 'B1-Pain-UGC', batch: 'B1' }),
    insertActivity: () => Promise.resolve([]),
    updateBrief: (_db: Db, _brandId: string, id: string, patch: Partial<BriefInput>) => {
      seam.updates.push({ id, patch });
      const row = seam.briefs.find((candidate) => candidate.id === id);
      return Promise.resolve({ ...row, ...patch, id });
    },
    updateBriefClientStatus: (
      _db: Db,
      _brandId: string,
      id: string,
      status: string,
      _note: string | null,
      _actor: string,
      alongside?: Partial<BriefInput>,
    ) => {
      seam.clientMoves.push({ id, status, alongside });
      const row = seam.briefs.find((candidate) => candidate.id === id);
      return Promise.resolve({ ...row, ...alongside, id, clientStatus: status });
    },
    createBrief: (
      _db: Db,
      _brandId: string,
      values: CreateBriefValues,
      nameFor: (n: number) => string,
      nameMode: string,
    ) => {
      const name = nameFor(42);
      seam.created.push({ values, name, nameMode });
      return Promise.resolve({ ...values, id: `copy-${String(seam.created.length)}`, name });
    },
    softDeleteBriefs: (_db: Db, _brandId: string, ids: readonly string[]) => {
      const live = ids.filter((id) => seam.briefs.some((row) => row.id === id));
      seam.deleted.push(live);
      return Promise.resolve(live);
    },
    insertComment: (
      _db: Db,
      _brandId: string,
      values: { recordType: string; recordId: string; body: string; authorName: string },
    ) => {
      seam.comments.push({
        recordType: values.recordType,
        recordId: values.recordId,
        body: values.body,
      });
      return Promise.resolve({
        ...values,
        id: 'comment-1',
        createdAt: new Date('2026-10-12T10:00:00Z'),
      });
    },
  };
});

const VIDEO_ID = '77777777-7777-4777-8777-000000000001';
const STATIC_ID = '77777777-7777-4777-8777-000000000002';

function brief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    id: VIDEO_ID,
    brandId: 'brand-under-test',
    name: 'TAS-TOF-V007-Pain-UGC-B1',
    nameMode: 'auto',
    briefNumber: 7,
    conceptId: 'concept-1',
    source: 'TAS',
    funnel: 'TOF',
    type: 'Video',
    version: 2,
    sequence: 1,
    batch: 'B1',
    internalStatus: 'ad_submitted',
    clientStatus: 'pending_for_approval',
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    clickForAiSpellChecker: false,
    dimensions: ['4:5'],
    inspoLinks: [],
    platform: ['Meta'],
    performance: 'best_performing',
    legacyAirtableId: 'recOLD',
    templateRowId: null,
    overriddenFields: [],
    clientStatusNote: 'old note',
    clientStatusUpdatedAt: new Date('2026-10-01T00:00:00Z'),
    launchedAt: null,
    launchPriority: 3,
    briefToDesign: 'Warm kitchen.',
    scriptContent: 'Hook.',
    ...overrides,
  } as CreativeBrief;
}

function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.briefs = [];
  seam.updates.length = 0;
  seam.clientMoves.length = 0;
  seam.created.length = 0;
  seam.deleted.length = 0;
  seam.comments.length = 0;
});

describe('in demo mode', () => {
  it('every action refuses before looking at anything', async () => {
    const refusal = { ok: false, error: 'Sign in required to save changes.' };
    expect(await approveCreativeAction(VIDEO_ID)).toEqual(refusal);
    expect(await requestChangesAction(VIDEO_ID)).toEqual(refusal);
    expect(await submitToClientAction(VIDEO_ID)).toEqual(refusal);
    expect(await duplicateCreativesAction([VIDEO_ID])).toEqual(refusal);
    expect(await deleteCreativesAction([VIDEO_ID])).toEqual(refusal);
    expect(await bulkMoveCreativesAction([VIDEO_ID], 'status', 'approved')).toEqual(refusal);
    expect(await postCreativeCommentAction(VIDEO_ID, 'hi')).toEqual(refusal);
  });
});

describe('Approve — the QA gate on the step that opens the client track (scope 4)', () => {
  it('refuses, naming the missing tick, and writes nothing', async () => {
    live();
    seam.briefs = [brief({ qaStrategist: true })];

    const result = await approveCreativeAction(VIDEO_ID);

    expect(result).toEqual({
      ok: false,
      error: 'Video Editor QA must be ticked before this brief can go to the client.',
    });
    expect(seam.updates).toEqual([]);
  });

  it('approves once every required tick is set; the designer’s tick is not asked of a video', async () => {
    live();
    seam.briefs = [brief({ qaVideoEditor: true, qaStrategist: true })];

    const result = await approveCreativeAction(VIDEO_ID);

    expect(result).toMatchObject({ ok: true, id: VIDEO_ID, internalStatus: 'approved' });
    expect(seam.updates).toEqual([
      { id: VIDEO_ID, patch: { internalStatus: 'approved', clientStatus: 'pending_for_approval' } },
    ]);
  });

  it('still refuses a skip the machine does not allow', async () => {
    live();
    seam.briefs = [
      brief({
        internalStatus: 'video_editing_in_progress',
        qaVideoEditor: true,
        qaStrategist: true,
      }),
    ];
    expect(await approveCreativeAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'That is not the next step on the internal track.',
    });
  });
});

describe('Request Changes — the reset lands in the SAME write (scope 5)', () => {
  it('moves a video to Videos Revisions and clears all three ticks in one patch', async () => {
    live();
    seam.briefs = [brief({ qaVideoEditor: true, qaDesigner: true, qaStrategist: true })];

    const result = await requestChangesAction(VIDEO_ID);

    expect(result).toMatchObject({ ok: true, internalStatus: 'videos_revisions' });
    expect(seam.updates).toEqual([
      {
        id: VIDEO_ID,
        patch: {
          internalStatus: 'videos_revisions',
          clientStatus: 'pending_for_approval',
          qaVideoEditor: false,
          qaDesigner: false,
          qaStrategist: false,
        },
      },
    ]);
  });

  it('uses the static ladder’s own key for a static, and refuses a creative not under review', async () => {
    live();
    seam.briefs = [
      brief({ id: STATIC_ID, type: 'Static', internalStatus: 'revisions_submitted' }),
      brief({ internalStatus: 'sent_to_video_editor' }),
    ];

    expect(await requestChangesAction(STATIC_ID)).toMatchObject({
      internalStatus: 'images_revisions',
    });
    expect(await requestChangesAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'That is not the next step on the internal track.',
    });
  });
});

describe('Submit to Client — both gates re-run on the server (scope 4)', () => {
  it('refuses on the internal gate first, then on QA, then when nothing is left to submit', async () => {
    live();
    seam.briefs = [brief({ clientStatus: 'revisions_needed' })];
    expect(await submitToClientAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'Internal approval first: the client track opens at Approved.',
    });

    seam.briefs = [brief({ internalStatus: 'approved', clientStatus: 'revisions_needed' })];
    expect(await submitToClientAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'Video Editor QA must be ticked before this brief can go to the client.',
    });

    seam.briefs = [brief({ internalStatus: 'approved', qaVideoEditor: true, qaStrategist: true })];
    expect(await submitToClientAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'This creative is already with the client.',
    });
    expect(seam.clientMoves).toEqual([]);
  });

  it('resubmits a creative the client sent back, through the client-status writer', async () => {
    live();
    seam.briefs = [
      brief({
        internalStatus: 'approved',
        clientStatus: 'revisions_needed',
        qaVideoEditor: true,
        qaStrategist: true,
      }),
    ];

    const result = await submitToClientAction(VIDEO_ID);

    expect(result).toMatchObject({ ok: true, clientStatus: 'revisions_submitted' });
    expect(seam.clientMoves).toEqual([
      { id: VIDEO_ID, status: 'revisions_submitted', alongside: undefined },
    ]);
  });
});

describe('Duplicate — copy and reset rules (scope 3)', () => {
  it('copies every field, bumps the version, resets QA and both tracks, drops the identity columns', () => {
    const values = duplicateValues(
      brief({
        qaVideoEditor: true,
        qaStrategist: true,
        internalStatus: 'approved',
        clientStatus: 'approved',
      }),
    );

    expect(values).toMatchObject({
      conceptId: 'concept-1',
      funnel: 'TOF',
      type: 'Video',
      version: 3,
      batch: 'B1',
      briefToDesign: 'Warm kitchen.',
      scriptContent: 'Hook.',
      dimensions: ['4:5'],
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
      internalStatus: 'sent_to_video_editor',
      clientStatus: 'pending_for_approval',
      clientStatusUpdatedAt: null,
      clientStatusNote: null,
      launchedAt: null,
      launchPriority: null,
      performance: null,
    });
    for (const key of [
      'id',
      'name',
      'briefNumber',
      'nameMode',
      'legacyAirtableId',
      'templateRowId',
      'createdAt',
      'brandId',
    ]) {
      expect(values).not.toHaveProperty(key);
    }
    expect(duplicateValues(brief({ type: 'Static' })).internalStatus).toBe('sent_to_designer');
  });

  it('names an auto-named copy through the formula with its NEW number, keeping name_mode auto', async () => {
    live();
    seam.briefs = [brief()];

    const result = await duplicateCreativesAction([VIDEO_ID]);

    expect(result).toEqual({
      ok: true,
      created: [{ id: 'copy-1', name: 'TAS-TOF-V042-Pain-UGC-B1' }],
      skipped: 0,
    });
    expect(seam.created[0]).toMatchObject({
      nameMode: 'auto',
      values: { version: 3, internalStatus: 'sent_to_video_editor' },
    });
  });

  it('bumps the version segment of a manual name and never hands it to the formula', async () => {
    live();
    seam.briefs = [brief({ name: 'TV01-B3-CasualHangouts-V2-GratsiRED', nameMode: 'manual' })];

    const result = await duplicateCreativesAction([VIDEO_ID, 'not-a-row']);

    expect(result).toEqual({
      ok: true,
      created: [{ id: 'copy-1', name: 'TV01-B3-CasualHangouts-V3-GratsiRED' }],
      skipped: 1,
    });
    expect(seam.created[0]?.nameMode).toBe('manual');
  });

  it('refuses an empty selection', async () => {
    live();
    expect(await duplicateCreativesAction([])).toEqual({
      ok: false,
      error: 'Select at least one creative first.',
    });
  });
});

describe('Delete — soft, never DELETE FROM (scope 3)', () => {
  it('marks the live rows of the selection and reports them', async () => {
    live();
    seam.briefs = [brief(), brief({ id: STATIC_ID })];

    const result = await deleteCreativesAction([VIDEO_ID, STATIC_ID, 'gone']);

    expect(result).toEqual({ ok: true, deleted: [VIDEO_ID, STATIC_ID] });
    expect(seam.deleted).toEqual([[VIDEO_ID, STATIC_ID]]);
  });
});

describe('Change status over a selection (scope 3)', () => {
  it('moves what the machine allows, reports what it refuses, with the gate’s own reason', async () => {
    live();
    seam.briefs = [
      brief({ qaVideoEditor: true, qaStrategist: true }),
      brief({ id: STATIC_ID, type: 'Static', internalStatus: 'ad_submitted', name: 'TS01' }),
    ];

    const result = await bulkMoveCreativesAction(
      [VIDEO_ID, STATIC_ID],
      'internalStatus',
      'approved',
    );

    expect(result).toEqual({
      ok: true,
      moved: [VIDEO_ID],
      refused: [
        {
          id: STATIC_ID,
          name: 'TS01',
          reason: 'Graphic Designer QA must be ticked before this brief can go to the client.',
        },
      ],
    });
    expect(seam.updates).toEqual([{ id: VIDEO_ID, patch: { internalStatus: 'approved' } }]);
  });

  it('carries the QA reset in the client-status statement on a bulk Revisions Needed', async () => {
    live();
    seam.briefs = [brief({ internalStatus: 'approved', qaVideoEditor: true, qaStrategist: true })];

    const result = await bulkMoveCreativesAction([VIDEO_ID], 'status', 'revisions_needed');

    expect(result).toMatchObject({ ok: true, moved: [VIDEO_ID], refused: [] });
    expect(seam.clientMoves).toEqual([
      {
        id: VIDEO_ID,
        status: 'revisions_needed',
        alongside: { qaVideoEditor: false, qaDesigner: false, qaStrategist: false },
      },
    ]);
  });

  it('refuses a field that is not a track', async () => {
    live();
    expect(await bulkMoveCreativesAction([VIDEO_ID], 'priority', 'high')).toEqual({
      ok: false,
      error: 'That is not a status track.',
    });
  });
});

describe('a comment from Focus Mode', () => {
  it('files a top-level comment under the creative’s record type', async () => {
    live();
    seam.briefs = [brief()];

    const result = await postCreativeCommentAction(VIDEO_ID, '  Slow the pour shot.  ');

    expect(result).toMatchObject({ ok: true, id: 'comment-1', body: 'Slow the pour shot.' });
    expect(seam.comments).toEqual([
      { recordType: 'creative_briefs', recordId: VIDEO_ID, body: 'Slow the pour shot.' },
    ]);
  });

  it('refuses a blank comment and a creative that is gone', async () => {
    live();
    seam.briefs = [brief()];
    expect(await postCreativeCommentAction(VIDEO_ID, '   ')).toEqual({
      ok: false,
      error: 'Write a comment first.',
    });
    expect(await postCreativeCommentAction('gone', 'hi')).toEqual({
      ok: false,
      error: 'That creative is no longer available.',
    });
  });
});
