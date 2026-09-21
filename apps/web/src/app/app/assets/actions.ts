'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { assetCategories, insertAsset, updateAsset } from '@tas/db';
import { z } from 'zod';

import { withAssetScope } from '@/lib/assets-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { assetsPath } from '@/lib/routes';

export interface AssetActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly savedAt: number;
}

export interface AssetActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type AssetActionResult = AssetActionSuccess | AssetActionFailure;

const text = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const schema = z.object({
  filename: z.string().trim().min(1, 'Filename is required'),
  contentType: z.string().trim().min(1, 'Content type is required'),
  sizeBytes: z.coerce.number().int().nonnegative(),
  r2Key: z.string().trim().min(1, 'R2 key is required'),
  url: z.string().trim().min(1, 'URL is required'),
  category: z.enum(assetCategories),
  conceptId: text,
  caption: text,
});

export async function createAssetAction(
  _previous: AssetActionResult | null,
  formData: FormData,
): Promise<AssetActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withAssetScope();
  try {
    const row = await insertAsset(scope.db, scope.brandId, parsed.data, userId);
    revalidatePath(assetsPath);
    return { ok: true, id: row.id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}

export async function updateAssetAction(
  _previous: AssetActionResult | null,
  formData: FormData,
): Promise<AssetActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const id = formData.get('id') as string;
  if (!id) return { ok: false, error: 'Missing id' };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const scope = await withAssetScope();
  try {
    await updateAsset(scope.db, scope.brandId, id, parsed.data, userId);
    revalidatePath(assetsPath);
    return { ok: true, id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}
