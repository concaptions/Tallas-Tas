'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertCollaboration, updateCollaboration, type CollaborationInput } from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { ugcPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/ugc-source';

export interface CollabActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface CollabActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type CollabActionResult = CollabActionSuccess | CollabActionFailure;

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

const collabSchema = z.object({
  creatorId: z.string().min(1),
  conceptId: text,
  briefId: text,
  costUsd: optionalInt,
  startDate: optionalDate,
  endDate: optionalDate,
  internalStatus: z.string().min(1),
  clientStatus: z.string().min(1),
  assetsStatus: z.string().min(1),
  notes: text,
});

function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  return {
    creatorId: single('creatorId'),
    conceptId: single('conceptId'),
    briefId: single('briefId'),
    costUsd: single('costUsd'),
    startDate: single('startDate'),
    endDate: single('endDate'),
    internalStatus: single('internalStatus'),
    clientStatus: single('clientStatus'),
    assetsStatus: single('assetsStatus'),
    notes: single('notes'),
  };
}

export async function createCollabAction(
  _previous: CollabActionResult | null,
  formData: FormData,
): Promise<CollabActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }
  const parsed = collabSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return { ok: false, error: 'Some fields need attention before this can be saved.' };
  }
  try {
    const actor = (await auth()).userId;
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope(async (db, brandId) => {
      const input: CollaborationInput = {
        creatorId: parsed.data.creatorId,
        conceptId: parsed.data.conceptId,
        briefId: parsed.data.briefId,
        costUsd: parsed.data.costUsd,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        internalStatus: parsed.data.internalStatus,
        clientStatus: parsed.data.clientStatus,
        assetsStatus: parsed.data.assetsStatus,
        notes: parsed.data.notes,
      };
      return insertCollaboration(db, brandId, input, actor);
    });
    if (saved === null) {
      return { ok: false, error: 'No workspace found.' };
    }
    revalidatePath(ugcPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The collaboration could not be saved. Try again.' };
  }
}

export async function updateCollabAction(
  _previous: CollabActionResult | null,
  formData: FormData,
): Promise<CollabActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }
  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'Missing collaboration id.' };
  }
  const parsed = collabSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return { ok: false, error: 'Some fields need attention before this can be saved.' };
  }
  try {
    const actor = (await auth()).userId;
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope(async (db, brandId) => {
      const patch: Partial<CollaborationInput> = {
        conceptId: parsed.data.conceptId,
        briefId: parsed.data.briefId,
        costUsd: parsed.data.costUsd,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        internalStatus: parsed.data.internalStatus,
        clientStatus: parsed.data.clientStatus,
        assetsStatus: parsed.data.assetsStatus,
        notes: parsed.data.notes,
      };
      return updateCollaboration(db, brandId, id, patch, actor);
    });
    if (saved === null) {
      return { ok: false, error: 'That collaboration is no longer available.' };
    }
    revalidatePath(ugcPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The collaboration could not be saved. Try again.' };
  }
}
