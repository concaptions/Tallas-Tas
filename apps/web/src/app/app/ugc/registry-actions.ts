'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  addRegistryCreatorToBrand,
  insertRegistryCreator,
  updateRegistryCreator,
  type RegistryCreatorInput,
} from '@tas/db';
import { normalizeInstagramUsername } from '@tas/domain/creators';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withGlobalScope } from '@/lib/registry-source';
import { ugcPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/ugc-source';

/**
 * Creator Registry mutations (global pool, Talal sync + Phase 2). The registry is NOT per-brand
 * (CLAUDE.md non-negotiable 3 analogy: like Themes), so writes go through `withGlobalScope` from
 * `registry-source.ts`. "Add to Brand" is the one cross-table write: it inserts a brand-scoped
 * `creators` row pre-filled from the registry entry.
 */

export interface RegistryActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface RegistryActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<string, string>>;
}

export type RegistryActionResult = RegistryActionSuccess | RegistryActionFailure;

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v));

const registrySchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  instagramUsername: optionalText,
  profilePicUrl: optionalText,
  creatorLink: optionalText,
  gender: optionalText,
  ethnicity: optionalText,
  ageBracket: optionalText,
  shippingLocation: optionalText,
  notes: optionalText,
});

function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function toInput(values: z.infer<typeof registrySchema>): RegistryCreatorInput {
  const normalizedIg = normalizeInstagramUsername(values.instagramUsername);
  return {
    name: values.name,
    instagramUsername: values.instagramUsername,
    profilePicUrl: values.profilePicUrl,
    creatorLink: values.creatorLink,
    gender: values.gender,
    ethnicity: values.ethnicity,
    ageBracket: values.ageBracket as RegistryCreatorInput['ageBracket'],
    shippingLocation: values.shippingLocation,
    notes: values.notes,
    normalizedInstagram: normalizedIg,
  };
}

export async function createRegistryCreatorAction(
  _previous: RegistryActionResult | null,
  formData: FormData,
): Promise<RegistryActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = registrySchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [first] = issue.path;
      if (typeof first === 'string') fieldErrors[first] ??= issue.message;
    }
    return { ok: false, error: 'Some fields need attention.', fieldErrors };
  }

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again.' };
    }

    const row = await withGlobalScope((db) =>
      insertRegistryCreator(db, toInput(parsed.data), userId),
    );
    return { ok: true, id: row.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The creator could not be saved. Try again.' };
  }
}

export async function updateRegistryCreatorAction(
  _previous: RegistryActionResult | null,
  formData: FormData,
): Promise<RegistryActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This creator could not be identified.' };
  }

  const parsed = registrySchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [first] = issue.path;
      if (typeof first === 'string') fieldErrors[first] ??= issue.message;
    }
    return { ok: false, error: 'Some fields need attention.', fieldErrors };
  }

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again.' };
    }

    const saved = await withGlobalScope((db) =>
      updateRegistryCreator(db, id, toInput(parsed.data), userId),
    );
    if (saved === null) {
      return { ok: false, error: 'That creator is no longer available.' };
    }
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The creator could not be saved. Try again.' };
  }
}

export async function addRegistryCreatorToBrandAction(
  registryCreatorId: string,
): Promise<RegistryActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  if (typeof registryCreatorId !== 'string' || registryCreatorId === '') {
    return { ok: false, error: 'This creator could not be identified.' };
  }

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again.' };
    }

    const result = await withBrandScope(async (db, brandId) => {
      const created = await addRegistryCreatorToBrand(db, brandId, registryCreatorId, userId);
      if (created === null) {
        return { ok: false as const, error: 'That creator is no longer in the registry.' };
      }
      return { ok: true as const, id: created.id };
    });

    if (result === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!result.ok) {
      return { ...result, savedAt: 0 } as RegistryActionResult;
    }

    revalidatePath(ugcPath);
    return { ok: true, id: result.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The creator could not be added to this brand. Try again.' };
  }
}
