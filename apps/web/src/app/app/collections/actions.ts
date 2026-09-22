'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertCollection, updateCollection, type CollectionInput } from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/collections-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { collectionsPath } from '@/lib/routes';

/**
 * Server Actions for the Collections table, following the pattern set by
 * `apps/web/src/app/app/campaigns/actions.ts`: a zod schema, a demo-mode guard, actor resolution
 * from Clerk and a brand-scoped write through `withBrandScope`. `name` is the only required field;
 * every relation is an optional uuid and every free-text field is optional text, so a strategist can
 * start a collection from just a name and fill the rest in later.
 */
export type CollectionFieldName =
  | 'name'
  | 'url'
  | 'campaignId'
  | 'angleId'
  | 'productId'
  | 'creativeDesignNote'
  | 'copywritingId'
  | 'creativeDesign2Id';

export interface CollectionActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface CollectionActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CollectionFieldName, string>>;
}

export type CollectionActionResult = CollectionActionSuccess | CollectionActionFailure;

const requiredText = z.string().trim().min(1, 'Required');

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const collectionSchema = z.object({
  name: requiredText,
  url: optionalText,
  campaignId: optionalUuid,
  angleId: optionalUuid,
  productId: optionalUuid,
  creativeDesignNote: optionalText,
  copywritingId: optionalUuid,
  creativeDesign2Id: optionalUuid,
});

function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): CollectionActionFailure {
  const fieldErrors: Partial<Record<CollectionFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as CollectionFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: CollectionInput } | CollectionActionFailure {
  const parsed = collectionSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return failureFrom(parsed.error);
  const { name, ...rest } = parsed.data;
  return {
    values: {
      name,
      url: rest.url ?? null,
      campaignId: rest.campaignId ?? null,
      angleId: rest.angleId ?? null,
      productId: rest.productId ?? null,
      creativeDesignNote: rest.creativeDesignNote ?? null,
      copywritingId: rest.copywritingId ?? null,
      creativeDesign2Id: rest.creativeDesign2Id ?? null,
      legacyAirtableId: null,
    },
  };
}

export async function createCollectionAction(
  _previous: CollectionActionResult | null,
  formData: FormData,
): Promise<CollectionActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) return parsed;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const created = await withBrandScope((db, brandId) =>
      insertCollection(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(collectionsPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The collection could not be saved. Try again.' };
  }
}

export async function updateCollectionAction(
  _previous: CollectionActionResult | null,
  formData: FormData,
): Promise<CollectionActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This collection could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) return parsed;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateCollection(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That collection is no longer available.' };
    }
    revalidatePath(collectionsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The collection could not be saved. Try again.' };
  }
}
