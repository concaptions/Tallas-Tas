'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertAdMetric, updateAdMetric } from '@tas/db';
import { z } from 'zod';

import { withPerformanceScope } from '@/lib/performance-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { performancePath } from '@/lib/routes';

export interface MetricActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface MetricActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type MetricActionResult = MetricActionSuccess | MetricActionFailure;

const text = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const schema = z.object({
  adName: z.string().trim().min(1, 'Ad name is required'),
  metaAdId: text,
  briefId: text,
  conceptId: text,
  spend: z.string().trim().min(1, 'Spend is required'),
  impressions: z.coerce.number().int().nonnegative(),
  clicks: z.coerce.number().int().nonnegative(),
  conversions: z.coerce.number().int().nonnegative(),
  ctr: text,
  cpc: text,
  cpa: text,
  roas: text,
  dateRange: z.string().trim().min(1, 'Date range is required'),
});

export async function createAdMetricAction(
  _previous: MetricActionResult | null,
  formData: FormData,
): Promise<MetricActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withPerformanceScope();
  try {
    const row = await insertAdMetric(scope.db, scope.brandId, parsed.data, userId);
    revalidatePath(performancePath);
    return { ok: true, id: row.id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}

export async function updateAdMetricAction(
  _previous: MetricActionResult | null,
  formData: FormData,
): Promise<MetricActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const id = formData.get('id') as string;
  if (!id) return { ok: false, error: 'Missing id' };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withPerformanceScope();
  try {
    await updateAdMetric(scope.db, scope.brandId, id, parsed.data, userId);
    revalidatePath(performancePath);
    return { ok: true, id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}
