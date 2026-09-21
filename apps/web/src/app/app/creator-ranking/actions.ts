'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertCreatorRanking, updateCreatorRanking } from '@tas/db';
import { z } from 'zod';

import { withCreatorRankingScope } from '@/lib/creator-ranking-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { creatorRankingPath } from '@/lib/routes';

export interface RankingActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface RankingActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type RankingActionResult = RankingActionSuccess | RankingActionFailure;

const text = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const schema = z.object({
  creatorId: z.string().trim().min(1, 'Creator is required'),
  creatorName: z.string().trim().min(1, 'Creator name is required'),
  totalAds: z.coerce.number().int().nonnegative(),
  totalSpend: z.string().trim().min(1, 'Total spend is required'),
  totalConversions: z.coerce.number().int().nonnegative(),
  avgRoas: text,
  avgCpa: text,
  rank: z.coerce.number().int().positive(),
  periodLabel: z.string().trim().min(1, 'Period is required'),
});

export async function createCreatorRankingAction(
  _previous: RankingActionResult | null,
  formData: FormData,
): Promise<RankingActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withCreatorRankingScope();
  try {
    const row = await insertCreatorRanking(scope.db, scope.brandId, parsed.data, userId);
    revalidatePath(creatorRankingPath);
    return { ok: true, id: row.id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}

export async function updateCreatorRankingAction(
  _previous: RankingActionResult | null,
  formData: FormData,
): Promise<RankingActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const id = formData.get('id') as string;
  if (!id) return { ok: false, error: 'Missing id' };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withCreatorRankingScope();
  try {
    await updateCreatorRanking(scope.db, scope.brandId, id, parsed.data, userId);
    revalidatePath(creatorRankingPath);
    return { ok: true, id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}
