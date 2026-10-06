'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  assetCategories,
  deleteFromR2,
  getAssetById,
  insertAsset,
  isR2Available,
  softDeleteAsset,
  updateAsset,
} from '@tas/db';
import { z } from 'zod';

import { withAssetScope } from '@/lib/assets-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { assetsPath } from '@/lib/routes';
import { viewerRole } from '@/lib/viewer-role';

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

/**
 * Soft-delete one asset (CLAUDE.md: "Soft delete only. Never `DELETE FROM` a data table.") and
 * remove the backing R2 object. The paste says hard delete; the project-wide rule says soft, so the
 * row stays with `deleted_at = now()` and the audit trail is intact. The R2 object is removed
 * because the paste points at R2 lifetime being tied to the asset, and `deleteFromR2` is
 * idempotent (404 counts as success). The decision line in `docs/decisions.md` explains both halves.
 *
 * ROLE GATE: admin or CSM. Deleting an asset is a privileged action for the agency side; a
 * strategist, editor, designer, media buyer or client cannot reach it. The predicate reuses the
 * `admin OR csm` shape that `canConfigureInterface` already uses, applied inline here because the
 * domain's predicate takes a shape the viewer-role resolver does not expose.
 *
 * HTTP-free policy lives in `delete-policy.ts` for the unit tests; this Server Action is the thin
 * wiring that reads `isDemoMode()`, `auth()`, `viewerRole()`, `withAssetScope()` and the R2 helpers.
 */
export async function deleteAssetAction(
  _previous: AssetActionResult | null,
  formData: FormData,
): Promise<AssetActionResult> {
  const { runDelete } = await import('./delete-policy');
  return runDelete(formData, {
    isDemoMode,
    auth: async () => (await auth()).userId,
    role: async () => viewerRole(),
    openScope: async () => {
      const scope = await withAssetScope();
      return {
        getAsset: (id: string) => getAssetById(scope.db, scope.brandId, id),
        softDelete: (id: string) => softDeleteAsset(scope.db, scope.brandId, id),
        close: scope.close,
      };
    },
    isR2Available,
    deleteFromR2,
    revalidatePath: () => {
      revalidatePath(assetsPath);
    },
  });
}
