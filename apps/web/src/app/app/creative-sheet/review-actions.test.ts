import type { BriefInput, CreateBriefValues, CreativeBrief, Db } from '@tas/db';
import { INTERNAL_ENTRY_STATUS } from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { duplicateValues } from './duplicate-values';
import {
  addAnnotationAction,
  addCommentAction,
  approveBriefAction,
  bulkMoveCreativesAction,
  deleteAnnotationAction,
  deleteCommentAction,
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
  actorName: string;
  role: string | null;
  briefs: CreativeBrief[];
  updates: { id: string; patch: Partial<BriefInput> }[];
  clientMoves: { id: string; status: string; alongside: Partial<BriefInput> | undefined }[];
  created: { values: CreateBriefValues; name: string; nameMode: string }[];
  deleted: string[][];
  comments: { recordType: string; recordId: string; body: string }[];
  briefCommentCount: number;
  briefAnnotations: {
    briefId: string;
    submissionVersion: number | null;
    xPct: number;
    yPct: number;
    note: string;
    createdBy: string;
  }[];
  briefComments: {
    briefId: string;
    submissionVersion: number;
    body: string;
    parentCommentId: string | null;
    createdBy: string;
  }[];
  annotationActors: Map<string, { createdBy: string; briefId: string }>;
  commentActors: Map<string, { createdBy: string; briefId: string }>;
  briefBrand: Map<string, string>;
  userIdByClerk: Map<string, string>;
  deletedAnnotationIds: string[];
  deletedCommentIds: string[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  actorName: 'Test Actor',
  role: 'admin',
  briefs: [],
  updates: [],
  clientMoves: [],
  created: [],
  deleted: [],
  comments: [],
  // A reviewer by default has one comment on the version, so Request Changes passes its new gate
  // without each test having to set it.
  briefCommentCount: 1,
  briefAnnotations: [],
  briefComments: [],
  annotationActors: new Map(),
  commentActors: new Map(),
  briefBrand: new Map(),
  userIdByClerk: new Map([['user_2TESTACTOR', '00000000-0000-4000-8000-00000000aaaa']]),
  deletedAnnotationIds: [],
  deletedCommentIds: [],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));
vi.mock('@/lib/actor', () => ({
  currentActor: () => Promise.resolve({ fullName: seam.actorName }),
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
    getActiveBrandRole: () => Promise.resolve(seam.role),
    briefBrandId: (_db: Db, briefId: string) =>
      Promise.resolve(seam.briefBrand.get(briefId) ?? 'brand-under-test'),
    countActiveBriefComments: () => Promise.resolve(seam.briefCommentCount),
    insertBriefAnnotation: (
      _db: Db,
      input: {
        briefId: string;
        submissionVersion: number | null;
        xPct: number;
        yPct: number;
        note: string;
        createdBy: string;
      },
    ) => {
      seam.briefAnnotations.push(input);
      const id = `annot-${String(seam.briefAnnotations.length)}`;
      seam.annotationActors.set(id, { createdBy: input.createdBy, briefId: input.briefId });
      return Promise.resolve({
        id,
        briefId: input.briefId,
        submissionVersion: input.submissionVersion,
        createdBy: input.createdBy,
        createdAt: new Date('2026-10-14T10:00:00Z'),
        xPct: String(input.xPct),
        yPct: String(input.yPct),
        note: input.note,
        deletedAt: null,
      });
    },
    insertBriefComment: (
      _db: Db,
      input: {
        briefId: string;
        submissionVersion: number;
        body: string;
        parentCommentId: string | null;
        createdBy: string;
      },
    ) => {
      seam.briefComments.push(input);
      const id = `bc-${String(seam.briefComments.length)}`;
      seam.commentActors.set(id, { createdBy: input.createdBy, briefId: input.briefId });
      return Promise.resolve({
        id,
        briefId: input.briefId,
        submissionVersion: input.submissionVersion,
        createdBy: input.createdBy,
        createdAt: new Date('2026-10-14T10:00:00Z'),
        body: input.body,
        parentCommentId: input.parentCommentId,
        deletedAt: null,
      });
    },
    findBriefAnnotationActor: (_db: Db, id: string) =>
      Promise.resolve(seam.annotationActors.get(id) ?? null),
    findBriefCommentActor: (_db: Db, id: string) =>
      Promise.resolve(seam.commentActors.get(id) ?? null),
    softDeleteBriefAnnotation: (_db: Db, id: string): Promise<string[]> => {
      if (!seam.annotationActors.has(id)) return Promise.resolve([]);
      seam.deletedAnnotationIds.push(id);
      seam.annotationActors.delete(id);
      return Promise.resolve([id]);
    },
    softDeleteBriefComment: (_db: Db, id: string) => {
      if (!seam.commentActors.has(id)) return Promise.resolve([]);
      seam.deletedCommentIds.push(id);
      seam.commentActors.delete(id);
      return Promise.resolve([id]);
    },
    resolveUserIdByClerk: (_db: Db, clerkUserId: string) =>
      Promise.resolve(seam.userIdByClerk.get(clerkUserId) ?? null),
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
  seam.actorName = 'Test Actor';
  seam.role = 'admin';
  seam.briefCommentCount = 1;
  seam.briefs = [];
  seam.updates.length = 0;
  seam.clientMoves.length = 0;
  seam.created.length = 0;
  seam.deleted.length = 0;
  seam.comments.length = 0;
  seam.briefAnnotations.length = 0;
  seam.briefComments.length = 0;
  seam.deletedAnnotationIds.length = 0;
  seam.deletedCommentIds.length = 0;
  seam.annotationActors.clear();
  seam.commentActors.clear();
  seam.briefBrand.clear();
  seam.userIdByClerk.clear();
  seam.userIdByClerk.set('user_2TESTACTOR', '00000000-0000-4000-8000-00000000aaaa');
});

describe('in demo mode', () => {
  it('every action refuses before looking at anything', async () => {
    const refusal = { ok: false, error: 'Sign in required to save changes.' };
    expect(await approveBriefAction(VIDEO_ID)).toEqual(refusal);
    expect(await requestChangesAction(VIDEO_ID)).toEqual(refusal);
    expect(await submitToClientAction(VIDEO_ID)).toEqual(refusal);
    expect(await duplicateCreativesAction([VIDEO_ID])).toEqual(refusal);
    expect(await deleteCreativesAction([VIDEO_ID])).toEqual(refusal);
    expect(await bulkMoveCreativesAction([VIDEO_ID], 'status', 'approved')).toEqual(refusal);
    expect(await postCreativeCommentAction(VIDEO_ID, 'hi')).toEqual(refusal);
    expect(await addAnnotationAction(VIDEO_ID, 1, 50, 50, 'pin')).toEqual(refusal);
    expect(await deleteAnnotationAction('annot-1')).toEqual(refusal);
    expect(await addCommentAction(VIDEO_ID, 1, 'hi', null)).toEqual(refusal);
    expect(await deleteCommentAction('bc-1')).toEqual(refusal);
  });
});

describe('Approve — the QA gate on the step that opens the client track (scope 4)', () => {
  it('refuses, naming the missing tick, and writes nothing', async () => {
    live();
    seam.briefs = [brief({ qaStrategist: true })];

    const result = await approveBriefAction(VIDEO_ID);

    expect(result).toEqual({
      ok: false,
      error: 'Video Editor QA must be ticked before this brief can go to the client.',
    });
    expect(seam.updates).toEqual([]);
  });

  it('approves once every required tick is set; the designer’s tick is not asked of a video', async () => {
    live();
    seam.briefs = [brief({ qaVideoEditor: true, qaStrategist: true })];

    const result = await approveBriefAction(VIDEO_ID);

    expect(result).toMatchObject({ ok: true, id: VIDEO_ID, internalStatus: 'approved' });
    expect(seam.updates).toEqual([
      { id: VIDEO_ID, patch: { internalStatus: 'approved', clientStatus: 'pending_for_approval' } },
    ]);
  });

  it('still refuses a skip the machine does not allow', async () => {
    live();
    seam.briefs = [
      brief({
        internalStatus: 'under_editing_or_designing',
        qaVideoEditor: true,
        qaStrategist: true,
      }),
    ];
    expect(await approveBriefAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'That is not the next step on the internal track.',
    });
  });
});

describe('Request Changes — the reset lands in the SAME write (scope 5)', () => {
  it('moves the creative to Revisions Needed and clears all three ticks in one patch', async () => {
    live();
    seam.briefs = [brief({ qaVideoEditor: true, qaDesigner: true, qaStrategist: true })];

    const result = await requestChangesAction(VIDEO_ID);

    expect(result).toMatchObject({ ok: true, internalStatus: 'revisions_needed' });
    expect(seam.updates).toEqual([
      {
        id: VIDEO_ID,
        patch: {
          internalStatus: 'revisions_needed',
          clientStatus: 'pending_for_approval',
          qaVideoEditor: false,
          qaDesigner: false,
          qaStrategist: false,
        },
      },
    ]);
  });

  it('sends a static at Revisions Submitted to the same step, and refuses a creative not under review', async () => {
    live();
    seam.briefs = [
      brief({ id: STATIC_ID, type: 'Static', internalStatus: 'revisions_submitted' }),
      brief({ internalStatus: 'sent_to_editor_or_designer' }),
    ];

    expect(await requestChangesAction(STATIC_ID)).toMatchObject({
      internalStatus: 'revisions_needed',
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
      internalStatus: 'draft',
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
    expect(duplicateValues(brief({ type: 'Static' })).internalStatus).toBe(INTERNAL_ENTRY_STATUS);
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
      values: { version: 3, internalStatus: 'draft' },
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

/* ------------------------------------------------------------------------------------------------
 * TICKET 10 — role gates, annotations and the brief-scoped comment thread.
 * ---------------------------------------------------------------------------------------------- */

describe('Ticket 10 role gates on Approve', () => {
  it('refuses a strategist whose actor name does not match the brief’s assignee', async () => {
    live();
    seam.role = 'strategist';
    seam.actorName = 'Someone Else';
    seam.briefs = [brief({ assignee: 'Test Actor', qaVideoEditor: true, qaStrategist: true })];

    const result = await approveBriefAction(VIDEO_ID);

    expect(result).toEqual({
      ok: false,
      error: 'Only an admin or the assigned creative strategist can approve this brief.',
    });
    expect(seam.updates).toEqual([]);
  });

  it('lets the assigned strategist approve their own brief', async () => {
    live();
    seam.role = 'strategist';
    seam.actorName = 'Assigned Person';
    seam.briefs = [brief({ assignee: 'Assigned Person', qaVideoEditor: true, qaStrategist: true })];

    const result = await approveBriefAction(VIDEO_ID);

    expect(result).toMatchObject({ ok: true, internalStatus: 'approved' });
  });

  it('refuses a video editor, whatever the assignee', async () => {
    live();
    seam.role = 'video_editor';
    seam.briefs = [brief({ qaVideoEditor: true, qaStrategist: true })];

    expect(await approveBriefAction(VIDEO_ID)).toMatchObject({
      ok: false,
      error: 'Only an admin or the assigned creative strategist can approve this brief.',
    });
  });
});

describe('Ticket 10 — Request Changes needs a comment on the current version', () => {
  it('refuses when no comment is on file for this version', async () => {
    live();
    seam.briefCommentCount = 0;
    seam.briefs = [brief()];

    expect(await requestChangesAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'Request Changes needs at least one comment on this version.',
    });
    expect(seam.updates).toEqual([]);
  });

  it('refuses a reviewer-less role before the comment check', async () => {
    live();
    seam.role = 'designer';
    seam.briefs = [brief()];

    expect(await requestChangesAction(VIDEO_ID)).toEqual({
      ok: false,
      error: 'Only an agency admin, CSM, strategist or media buyer can review this brief.',
    });
  });
});

describe('addAnnotationAction', () => {
  it('refuses a non-reviewer', async () => {
    live();
    seam.role = 'designer';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];

    const result = await addAnnotationAction(VIDEO_ID, 1, 42, 7, 'slow this');

    expect(result).toEqual({
      ok: false,
      error: 'Only an agency admin, CSM, strategist or media buyer can review this brief.',
    });
    expect(seam.briefAnnotations).toEqual([]);
  });

  it('writes a pin for a reviewer, with the user’s uuid as the author', async () => {
    live();
    seam.role = 'strategist';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];

    const result = await addAnnotationAction(VIDEO_ID, 1, 42, 7, 'slow this');

    expect(result).toMatchObject({ ok: true });
    expect(seam.briefAnnotations).toEqual([
      {
        briefId: VIDEO_ID,
        submissionVersion: 1,
        xPct: 42,
        yPct: 7,
        note: 'slow this',
        createdBy: '00000000-0000-4000-8000-00000000aaaa',
      },
    ]);
  });

  it('refuses an out-of-range coordinate', async () => {
    live();
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];

    expect(await addAnnotationAction(VIDEO_ID, 1, 101, 7, 'bad')).toEqual({
      ok: false,
      error: 'That annotation is not valid.',
    });
  });
});

describe('deleteAnnotationAction', () => {
  it('lets the author remove their own pin', async () => {
    live();
    seam.role = 'strategist';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];
    await addAnnotationAction(VIDEO_ID, 1, 10, 10, 'mine');

    const result = await deleteAnnotationAction('annot-1');

    expect(result).toEqual({ ok: true, id: 'annot-1' });
    expect(seam.deletedAnnotationIds).toEqual(['annot-1']);
  });

  it('refuses a different reviewer who did not author the pin', async () => {
    live();
    seam.role = 'strategist';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];
    await addAnnotationAction(VIDEO_ID, 1, 10, 10, 'mine');

    seam.userIdByClerk.set('user_2TESTACTOR', '00000000-0000-4000-8000-0000000000bb');

    const result = await deleteAnnotationAction('annot-1');

    expect(result).toEqual({
      ok: false,
      error: 'Only an agency admin, CSM, strategist or media buyer can review this brief.',
    });
    expect(seam.deletedAnnotationIds).toEqual([]);
  });

  it('lets an admin remove any pin', async () => {
    live();
    seam.role = 'strategist';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];
    await addAnnotationAction(VIDEO_ID, 1, 10, 10, 'theirs');

    seam.userIdByClerk.set('user_2TESTACTOR', '00000000-0000-4000-8000-0000000000ad');
    seam.role = 'admin';

    expect(await deleteAnnotationAction('annot-1')).toEqual({ ok: true, id: 'annot-1' });
  });
});

describe('addCommentAction', () => {
  it('files a root comment for a reviewer', async () => {
    live();
    seam.role = 'csm';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];

    const result = await addCommentAction(VIDEO_ID, 1, '  Trim the opener.  ', null);

    expect(result).toMatchObject({ ok: true });
    expect(seam.briefComments).toEqual([
      {
        briefId: VIDEO_ID,
        submissionVersion: 1,
        body: 'Trim the opener.',
        parentCommentId: null,
        createdBy: '00000000-0000-4000-8000-00000000aaaa',
      },
    ]);
  });

  it('refuses a reply whose parent is on another brief', async () => {
    live();
    seam.role = 'csm';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefBrand.set(STATIC_ID, 'brand-under-test');
    seam.briefs = [brief(), brief({ id: STATIC_ID })];

    // Root on the static brief; replying on the video brief must refuse.
    await addCommentAction(STATIC_ID, 1, 'root', null);

    const result = await addCommentAction(VIDEO_ID, 1, 'reply', 'bc-1');
    expect(result).toEqual({ ok: false, error: 'That reply has no parent to attach to.' });
  });
});

describe('deleteCommentAction', () => {
  it('refuses a reviewer who did not write the comment and is not admin', async () => {
    live();
    seam.role = 'csm';
    seam.briefBrand.set(VIDEO_ID, 'brand-under-test');
    seam.briefs = [brief()];
    await addCommentAction(VIDEO_ID, 1, 'theirs', null);

    seam.userIdByClerk.set('user_2TESTACTOR', '00000000-0000-4000-8000-0000000000bb');

    expect(await deleteCommentAction('bc-1')).toEqual({
      ok: false,
      error: 'Only an agency admin, CSM, strategist or media buyer can review this brief.',
    });
  });
});
