'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { adPlatforms, insertCompetitorAd, updateCompetitorAd } from '@tas/db';
import { z } from 'zod';

import { withAdSpyScope } from '@/lib/ad-spy-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { adSpyPath } from '@/lib/routes';

export interface AdSpyActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface AdSpyActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type AdSpyActionResult = AdSpyActionSuccess | AdSpyActionFailure;

const text = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const schema = z.object({
  platform: z.enum(adPlatforms),
  advertiserName: z.string().trim().min(1, 'Advertiser name is required'),
  adUrl: z.string().trim().min(1, 'Ad URL is required'),
  headline: text,
  bodyText: text,
  format: z.string().trim().min(1, 'Format is required'),
  estimatedSpend: text,
  daysActive: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v)))
    .nullable(),
  firstSeen: z.string().trim().min(1, 'First seen date is required'),
  lastSeen: text,
  notes: text,
});

export async function createCompetitorAdAction(
  _previous: AdSpyActionResult | null,
  formData: FormData,
): Promise<AdSpyActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withAdSpyScope();
  try {
    const row = await insertCompetitorAd(scope.db, scope.brandId, parsed.data, userId);
    revalidatePath(adSpyPath);
    return { ok: true, id: row.id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}

export async function updateCompetitorAdAction(
  _previous: AdSpyActionResult | null,
  formData: FormData,
): Promise<AdSpyActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const id = formData.get('id') as string;
  if (!id) return { ok: false, error: 'Missing id' };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withAdSpyScope();
  try {
    await updateCompetitorAd(scope.db, scope.brandId, id, parsed.data, userId);
    revalidatePath(adSpyPath);
    return { ok: true, id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}
