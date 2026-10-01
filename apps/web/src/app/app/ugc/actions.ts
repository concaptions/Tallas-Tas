'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertAsset,
  isR2Available,
  syncCreatorConcepts,
  syncCreatorProducts,
  updateCreator,
  uploadToR2,
  type CreatorInput,
} from '@tas/db';
import { isCreatorInternalStatus, isCreatorStatus } from '@tas/domain/state';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { ugcPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/ugc-source';

import {
  CONTINUE_WORKING_WITH_UNDECIDED,
  continueWorkingWithValue,
  isContinueWorkingWithKey,
  MAX_SHOWCASE_VIDEO_BYTES,
  R2_UNAVAILABLE_HINT,
} from './fields';

export interface CreatorActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface CreatorActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type CreatorActionResult = CreatorActionSuccess | CreatorActionFailure;

const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

const optionalInt = z
  .string()
  .trim()
  .transform((value) => {
    if (value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  })
  .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => {
    if (value === '') return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  })
  .nullable();

/** `extension_days` is NOT NULL defaulting to 0 (`schema/creators.ts`), so an emptied input means none. */
const intOrZero = z
  .string()
  .trim()
  .transform((value) => {
    const n = Number(value);
    return value !== '' && Number.isFinite(n) ? Math.trunc(n) : 0;
  });

/**
 * A submitted status. Absent means "leave it where it is" (a form that never rendered the control
 * must not reset the track); anything else must be a key the domain knows. That membership check
 * IS the creator tracks' transition rule: `creator-status` in `@tas/domain/state` defines three
 * independent vocabularies and no ladder, so only a value outside the list is refused.
 */
const statusOrAbsent = (known: (value: string) => boolean) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || known(value))
    .transform((value) => (value === '' ? undefined : value));

/** "Continue Working With?": the three keys of `CONTINUE_WORKING_WITH`, stored as `boolean | null`. */
const triState = z
  .string()
  .trim()
  .transform((value) => (value === '' ? CONTINUE_WORKING_WITH_UNDECIDED : value))
  .refine(isContinueWorkingWithKey)
  .transform(continueWorkingWithValue);

/**
 * `slackNotified`, `partnershipActivity` and `partnershipActivatedAt` are deliberately absent: the
 * first is the partnership reminder automation's receipt and the other two are the scanner's
 * (`schema/creators.ts`), and the panel renders all three read-only. A key smuggled into the
 * request is dropped here, never written.
 */
const creatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required.'),
  gender: text,
  ethnicity: text,
  ageBracket: text,
  platform: z
    .string()
    .trim()
    .transform((value) => (value === '' ? [] : [value]))
    .pipe(z.array(z.string())),
  profilePicUrl: text,
  videoIntroUrl: text,
  internalCreatorStatus: statusOrAbsent(isCreatorInternalStatus),
  clientStatus: statusOrAbsent(isCreatorStatus),
  clientNote: text,
  creatorLink: text,
  shippingLocation: text,
  trackingNumber: text,
  rawAssetsUrl: text,
  internalBrief: text,
  instagramUsername: text,
  facebookProfileUrl: text,
  partnershipPeriodDays: optionalInt,
  extensionDays: intOrZero,
  continueWorkingWith: triState,
  /** Gratsi "Creator's cost (USD) - Internal" — the creator's rate, not what TAS paid. */
  creatorCost: optionalInt,
  /** Gratsi "Paid by TAS", which the importer lands in `cost_usd`. */
  costUsd: optionalInt,
  budgetPer60s: optionalInt,
  partnershipPricePer30Days: optionalInt,
  paymentDate: optionalDate,
  dateOfManagement: optionalDate,
  creatorInfoRequest: text,
  partnershipNotes: text,
  conceptIds: z.array(z.string()),
  productIds: z.array(z.string()),
});

function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const many = (key: string): string[] =>
    formData.getAll(key).filter((value): value is string => typeof value === 'string');

  return {
    id: single('id'),
    name: single('name'),
    gender: single('gender'),
    ethnicity: single('ethnicity'),
    ageBracket: single('ageBracket'),
    platform: single('platform'),
    profilePicUrl: single('profilePicUrl'),
    videoIntroUrl: single('videoIntroUrl'),
    internalCreatorStatus: single('internalCreatorStatus'),
    clientStatus: single('clientStatus'),
    clientNote: single('clientNote'),
    creatorLink: single('creatorLink'),
    shippingLocation: single('shippingLocation'),
    trackingNumber: single('trackingNumber'),
    rawAssetsUrl: single('rawAssetsUrl'),
    internalBrief: single('internalBrief'),
    instagramUsername: single('instagramUsername'),
    facebookProfileUrl: single('facebookProfileUrl'),
    partnershipPeriodDays: single('partnershipPeriodDays'),
    extensionDays: single('extensionDays'),
    continueWorkingWith: single('continueWorkingWith'),
    creatorCost: single('creatorCost'),
    costUsd: single('costUsd'),
    budgetPer60s: single('budgetPer60s'),
    partnershipPricePer30Days: single('partnershipPricePer30Days'),
    paymentDate: single('paymentDate'),
    dateOfManagement: single('dateOfManagement'),
    creatorInfoRequest: single('creatorInfoRequest'),
    partnershipNotes: single('partnershipNotes'),
    conceptIds: many('conceptIds'),
    productIds: many('productIds'),
  };
}

export async function updateCreatorAction(
  _previous: CreatorActionResult | null,
  formData: FormData,
): Promise<CreatorActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = creatorSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return { ok: false, error: 'Some fields need attention before this can be saved.' };
  }

  const { id, conceptIds, productIds, internalCreatorStatus, clientStatus, ...rest } = parsed.data;
  // An absent status is left out of the patch entirely rather than written as `undefined`, so the
  // query layer never sees a key for a track the form did not touch.
  const patch: Partial<CreatorInput> = {
    ...rest,
    ageBracket: rest.ageBracket as CreatorInput['ageBracket'],
    platform: rest.platform as CreatorInput['platform'],
    ...(internalCreatorStatus === undefined ? {} : { internalCreatorStatus }),
    ...(clientStatus === undefined ? {} : { clientStatus }),
  };

  try {
    const actor = (await auth()).userId;
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope(async (db, brandId) => {
      const row = await updateCreator(db, brandId, id, patch, actor);
      if (row === null) return null;
      await syncCreatorConcepts(db, row.id, conceptIds);
      await syncCreatorProducts(db, row.id, productIds);
      return row;
    });
    if (saved === null) {
      return { ok: false, error: 'That creator is no longer available.' };
    }
    revalidatePath(ugcPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The creator could not be saved. Try again.' };
  }
}

export interface VideoUploadSuccess {
  readonly ok: true;
  readonly id: string;
  readonly url: string;
  readonly savedAt: number;
}

export type VideoUploadResult = VideoUploadSuccess | CreatorActionFailure;

const uploadSchema = z.object({
  creatorId: z.uuid(),
  caption: text,
});

/** A file name safe for an object key: the base name, lower-cased, nothing but word characters and dots. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'video';
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned === '' ? 'video' : cleaned;
}

/**
 * Uploads one showcase video for a creator (Sprint 7, UGC media): the file goes to R2 through the
 * shared `uploadToR2`, then one `assets` row is written with `creator_id` set and the
 * `showcase_video` category — the existing attachment storage, reused, so the Assets page, the
 * re-hosting scripts and this panel all read one table. Several uploads make several rows; the panel
 * lists them newest first with inline playback. Refused in demo mode, without a session, without
 * the bucket, for a non-video file and past `MAX_SHOWCASE_VIDEO_BYTES`.
 */
export async function uploadCreatorVideoAction(
  _previous: VideoUploadResult | null,
  formData: FormData,
): Promise<VideoUploadResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const parsed = uploadSchema.safeParse({
    creatorId: formData.get('creatorId'),
    caption: formData.get('caption') ?? '',
  });
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };

  const file = formData.get('video');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a video file to upload.' };
  }
  if (!file.type.startsWith('video/')) {
    return { ok: false, error: 'Only video files can be uploaded here.' };
  }
  if (file.size > MAX_SHOWCASE_VIDEO_BYTES) {
    return { ok: false, error: 'That video is over 250 MB. Compress it and try again.' };
  }

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Your session has expired. Sign in again to upload.' };
  if (!isR2Available()) return { ok: false, error: R2_UNAVAILABLE_HINT };

  try {
    const saved = await withBrandScope(async (db, brandId) => {
      const key = `${brandId}/creators/${parsed.data.creatorId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const uploaded = await uploadToR2(key, await file.arrayBuffer(), file.type);
      if (!uploaded.ok) throw new Error(uploaded.error);
      return insertAsset(
        db,
        brandId,
        {
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          r2Key: uploaded.r2Key,
          url: uploaded.url,
          category: 'showcase_video',
          conceptId: null,
          creatorId: parsed.data.creatorId,
          caption: parsed.data.caption,
        },
        userId,
      );
    });
    if (saved === null) return { ok: false, error: 'No brand is selected for this workspace.' };
    revalidatePath(ugcPath);
    return { ok: true, id: saved.id, url: saved.url, savedAt: Date.now() };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The upload failed. Try again.',
    };
  }
}
