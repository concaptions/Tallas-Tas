'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  syncCreatorConcepts,
  syncCreatorProducts,
  updateCreator,
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
