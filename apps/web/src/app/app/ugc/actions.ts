'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  syncCreatorConcepts,
  syncCreatorProducts,
  updateCreator,
  type CreatorInput,
} from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { ugcPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/ugc-source';

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

const optionalBool = z
  .string()
  .trim()
  .transform((value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  })
  .nullable();

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
  creatorLink: text,
  shippingLocation: text,
  trackingNumber: text,
  rawAssetsUrl: text,
  internalBrief: text,
  costUsd: optionalInt,
  partnershipPricePer30Days: optionalInt,
  continueWorkingWith: optionalBool,
  extensionDays: optionalInt.transform((v) => v ?? 0),
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
    creatorLink: single('creatorLink'),
    shippingLocation: single('shippingLocation'),
    trackingNumber: single('trackingNumber'),
    rawAssetsUrl: single('rawAssetsUrl'),
    internalBrief: single('internalBrief'),
    costUsd: single('costUsd'),
    partnershipPricePer30Days: single('partnershipPricePer30Days'),
    continueWorkingWith: single('continueWorkingWith'),
    extensionDays: single('extensionDays'),
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

  const { id, conceptIds, productIds, ...rest } = parsed.data;
  const patch: Partial<CreatorInput> = {
    ...rest,
    ageBracket: rest.ageBracket as CreatorInput['ageBracket'],
    platform: rest.platform as CreatorInput['platform'],
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
