import type { AssetListRow, R2DeleteOutcome } from '@tas/db';

import { DEMO_WRITE_REFUSAL } from '@/lib/demo-mode';

import type { AssetActionResult } from './actions';

/**
 * HTTP-free delete policy for `deleteAssetAction`. Every dependency the Server Action pulls from
 * Next.js, Clerk, the data layer and R2 is a function here, so the test suite is the documentation
 * for the paste's acceptance criteria without starting a request or a connection.
 *
 * The order of gates matches the paste: demo refusal → id present → signed in → role gate (admin
 * or CSM) → asset exists on this brand → best-effort R2 delete (log but don't fail if unreachable)
 * → soft-delete the row → revalidate.
 */

export interface DeleteScope {
  readonly getAsset: (id: string) => Promise<AssetListRow | null>;
  readonly softDelete: (id: string) => Promise<AssetListRow | null>;
  readonly close: () => Promise<void>;
}

export interface DeleteDeps {
  readonly isDemoMode: () => boolean;
  readonly auth: () => Promise<string | null>;
  readonly role: () => Promise<string | null>;
  readonly openScope: () => Promise<DeleteScope>;
  readonly isR2Available: () => boolean;
  readonly deleteFromR2: (key: string) => Promise<R2DeleteOutcome>;
  readonly revalidatePath: () => void;
  readonly warn?: (message: string) => void;
}

export async function runDelete(formData: FormData, deps: DeleteDeps): Promise<AssetActionResult> {
  if (deps.isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const idRaw = formData.get('id');
  const id = typeof idRaw === 'string' ? idRaw : '';
  if (id === '') return { ok: false, error: 'Missing id' };

  const userId = await deps.auth();
  if (userId === null || userId === '') {
    return { ok: false, error: 'Not authenticated' };
  }

  const role = await deps.role();
  if (role !== 'admin' && role !== 'csm') {
    return {
      ok: false,
      error: 'Only an Admin or Client Success Manager can delete assets.',
    };
  }

  const scope = await deps.openScope();
  try {
    const existing = await scope.getAsset(id);
    if (existing === null) {
      return { ok: false, error: 'That asset is no longer available.' };
    }

    if (deps.isR2Available()) {
      const r2 = await deps.deleteFromR2(existing.r2Key);
      if (!r2.ok) {
        // Log but keep going: the row's deleted_at is the authoritative state.
        deps.warn?.(`R2 delete failed for ${existing.r2Key}: ${r2.error}`);
      }
    }

    const row = await scope.softDelete(id);
    if (row === null) {
      return { ok: false, error: 'That asset is no longer available.' };
    }

    deps.revalidatePath();
    return { ok: true, id, savedAt: Date.now() };
  } finally {
    await scope.close();
  }
}
