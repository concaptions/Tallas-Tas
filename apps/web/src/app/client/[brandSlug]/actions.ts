'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { getBriefById, insertAnnotation, insertComment, listComments, updateBrief } from '@tas/db';
import { canTransitionClient, clientQueueAction, isClientTrackOpen } from '@tas/domain/state';
import { z } from 'zod';

import { toBriefRow, withBrandScope } from '@/lib/briefs-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';

export interface ActionSuccess {
  readonly ok: true;
  readonly savedAt: number;
}

export interface ActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type ActionResult = ActionSuccess | ActionFailure;

function failure(error: string): ActionFailure {
  return { ok: false, error };
}

async function actorId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

async function actorName(): Promise<string> {
  try {
    const { userId } = await auth();
    return userId ?? 'Client';
  } catch {
    return 'Client';
  }
}

const annotationSchema = z.object({
  brandSlug: z.string().min(1),
  recordType: z.string().min(1),
  recordId: z.uuid(),
  kind: z.enum(['video_timestamp', 'image_xy']),
  timestampSeconds: z.coerce.number().optional(),
  x: z.coerce.number().min(0).max(1).optional(),
  y: z.coerce.number().min(0).max(1).optional(),
  body: z.string().min(1),
});

export async function createAnnotationAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = annotationSchema.safeParse({
    brandSlug: formData.get('brandSlug'),
    recordType: formData.get('recordType'),
    recordId: formData.get('recordId'),
    kind: formData.get('kind'),
    timestampSeconds: formData.get('timestampSeconds') || undefined,
    x: formData.get('x') || undefined,
    y: formData.get('y') || undefined,
    body: formData.get('body'),
  });
  if (!parsed.success) return failure('Invalid annotation data.');

  const { brandSlug, ...values } = parsed.data;
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again.');

    const name = await actorName();
    const outcome = await withBrandScope(async (db, brandId) => {
      await insertAnnotation(
        db,
        brandId,
        {
          recordType: values.recordType,
          recordId: values.recordId,
          authorId: actor,
          authorName: name,
          kind: values.kind,
          timestampSeconds: values.timestampSeconds ?? null,
          x: values.x ?? null,
          y: values.y ?? null,
          body: values.body,
        },
        actor,
      );
      return { ok: true as const, savedAt: Date.now() };
    });

    if (outcome === null) return failure('No workspace found.');
    revalidatePath(`/client/${encodeURIComponent(brandSlug)}`);
    return outcome;
  } catch {
    return failure('Could not save annotation. Try again.');
  }
}

const commentSchema = z.object({
  brandSlug: z.string().min(1),
  recordType: z.string().min(1),
  recordId: z.uuid(),
  parentCommentId: z.uuid().optional(),
  body: z.string().min(1),
});

const MAX_COMMENT_DEPTH = 2;

export async function createCommentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = commentSchema.safeParse({
    brandSlug: formData.get('brandSlug'),
    recordType: formData.get('recordType'),
    recordId: formData.get('recordId'),
    parentCommentId: formData.get('parentCommentId') || undefined,
    body: formData.get('body'),
  });
  if (!parsed.success) return failure('Invalid comment data.');

  const { brandSlug, ...values } = parsed.data;
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again.');

    const name = await actorName();
    const outcome = await withBrandScope(async (db, brandId) => {
      if (values.parentCommentId) {
        const existing = await listComments(db, brandId, values.recordType, values.recordId);
        const parent = existing.find((c) => c.id === values.parentCommentId);
        if (!parent) return failure('Parent comment not found.');
        if (parent.parentCommentId !== null) {
          const depth = existing.some(
            (c) => c.id === parent.parentCommentId && c.parentCommentId !== null,
          )
            ? 3
            : 2;
          if (depth >= MAX_COMMENT_DEPTH) return failure('Maximum reply depth reached.');
        }
      }

      await insertComment(
        db,
        brandId,
        {
          recordType: values.recordType,
          recordId: values.recordId,
          parentCommentId: values.parentCommentId ?? null,
          authorId: actor,
          authorName: name,
          body: values.body,
        },
        actor,
      );
      return { ok: true as const, savedAt: Date.now() };
    });

    if (outcome === null) return failure('No workspace found.');
    revalidatePath(`/client/${encodeURIComponent(brandSlug)}`);
    return outcome;
  } catch {
    return failure('Could not save comment. Try again.');
  }
}

const approveSchema = z.object({
  brandSlug: z.string().min(1),
  id: z.uuid(),
});

export async function approveRecordAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = approveSchema.safeParse({
    brandSlug: formData.get('brandSlug'),
    id: formData.get('id'),
  });
  if (!parsed.success) return failure('This creative could not be identified.');

  const { brandSlug, id } = parsed.data;
  const action = clientQueueAction('approve');
  if (action === undefined) return failure('That is not a valid action.');

  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again.');

    const outcome = await withBrandScope(async (db, brandId) => {
      const found = await getBriefById(db, brandId, id);
      if (found === null) return failure('That creative is no longer available.');

      const row = toBriefRow(found);
      if (!isClientTrackOpen(row.internalStatus)) {
        return failure('The client track opens once internal status reaches Approved.');
      }
      if (!canTransitionClient(row.internalStatus, row.clientStatus, action.to)) {
        return failure('That is not the next step on the client track.');
      }

      const saved = await updateBrief(db, brandId, id, { clientStatus: action.to }, actor);
      return saved === null
        ? failure('That creative is no longer available.')
        : { ok: true as const, savedAt: Date.now() };
    });

    if (outcome === null) return failure('No workspace found.');
    if (!outcome.ok) return outcome;
    revalidatePath(`/client/${encodeURIComponent(brandSlug)}`);
    return outcome;
  } catch {
    return failure('Could not approve. Try again.');
  }
}

export async function requestRevisionsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = approveSchema.safeParse({
    brandSlug: formData.get('brandSlug'),
    id: formData.get('id'),
  });
  if (!parsed.success) return failure('This creative could not be identified.');

  const { brandSlug, id } = parsed.data;
  const action = clientQueueAction('request_revisions');
  if (action === undefined) return failure('That is not a valid action.');

  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again.');

    const outcome = await withBrandScope(async (db, brandId) => {
      const found = await getBriefById(db, brandId, id);
      if (found === null) return failure('That creative is no longer available.');

      const row = toBriefRow(found);
      if (!isClientTrackOpen(row.internalStatus)) {
        return failure('The client track opens once internal status reaches Approved.');
      }
      if (!canTransitionClient(row.internalStatus, row.clientStatus, action.to)) {
        return failure('That is not the next step on the client track.');
      }

      const saved = await updateBrief(db, brandId, id, { clientStatus: action.to }, actor);
      return saved === null
        ? failure('That creative is no longer available.')
        : { ok: true as const, savedAt: Date.now() };
    });

    if (outcome === null) return failure('No workspace found.');
    if (!outcome.ok) return outcome;
    revalidatePath(`/client/${encodeURIComponent(brandSlug)}`);
    return outcome;
  } catch {
    return failure('Could not request revisions. Try again.');
  }
}
