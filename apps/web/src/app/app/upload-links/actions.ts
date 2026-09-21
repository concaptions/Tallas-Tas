'use server';

import crypto from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertUploadLink, updateUploadLink } from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { uploadLinksPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/upload-links-source';

/**
 * Upload Links mutations (PRD §11). Both follow the angles/actions.ts pattern:
 *
 * 1. refuse immediately in DEMO MODE;
 * 2. parse `FormData` with zod (shape only);
 * 3. write through scoped `@tas/db` functions;
 * 4. revalidate and return a typed result.
 */

export type UploadLinkFieldName =
  'label' | 'recipientName' | 'recipientEmail' | 'maxUploads' | 'expiresAt' | 'notes' | 'isActive';

export interface UploadLinkActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface UploadLinkActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<UploadLinkFieldName, string>>;
}

export type UploadLinkActionResult = UploadLinkActionSuccess | UploadLinkActionFailure;

/** A text column: trimmed, and empty means NULL. */
const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

const uploadLinkSchema = z.object({
  label: z.string().trim().min(1, 'Label is required.'),
  recipientName: text,
  recipientEmail: text,
  maxUploads: text,
  expiresAt: text,
  notes: text,
  isActive: z.string().transform((value) => value === 'true'),
});

function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };

  return {
    label: single('label'),
    recipientName: single('recipientName'),
    recipientEmail: single('recipientEmail'),
    maxUploads: single('maxUploads'),
    expiresAt: single('expiresAt'),
    notes: single('notes'),
    isActive: single('isActive'),
  };
}

function failureFrom(error: z.ZodError): UploadLinkActionFailure {
  const fieldErrors: Partial<Record<UploadLinkFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as UploadLinkFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Creates an upload link in the actor's brand. */
export async function createUploadLinkAction(
  _previous: UploadLinkActionResult | null,
  formData: FormData,
): Promise<UploadLinkActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = uploadLinkSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const token = crypto.randomUUID().slice(0, 8);
    const created = await withBrandScope((db, brandId) =>
      insertUploadLink(
        db,
        brandId,
        {
          token,
          label: parsed.data.label,
          recipientName: parsed.data.recipientName,
          recipientEmail: parsed.data.recipientEmail,
          maxUploads: parsed.data.maxUploads,
          expiresAt: parsed.data.expiresAt !== null ? new Date(parsed.data.expiresAt) : null,
          notes: parsed.data.notes,
          isActive: parsed.data.isActive,
        },
        actor,
      ),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(uploadLinksPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The upload link could not be saved. Try again.' };
  }
}

/** Patches one upload link of the actor's brand. */
export async function updateUploadLinkAction(
  _previous: UploadLinkActionResult | null,
  formData: FormData,
): Promise<UploadLinkActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This upload link could not be identified.' };
  }

  const parsed = uploadLinkSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const saved = await withBrandScope((db, brandId) =>
      updateUploadLink(
        db,
        brandId,
        id,
        {
          label: parsed.data.label,
          recipientName: parsed.data.recipientName,
          recipientEmail: parsed.data.recipientEmail,
          maxUploads: parsed.data.maxUploads,
          expiresAt: parsed.data.expiresAt !== null ? new Date(parsed.data.expiresAt) : null,
          notes: parsed.data.notes,
          isActive: parsed.data.isActive,
        },
        actor,
      ),
    );
    if (saved === null) {
      return { ok: false, error: 'That upload link is no longer available.' };
    }
    revalidatePath(uploadLinksPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The upload link could not be saved. Try again.' };
  }
}
