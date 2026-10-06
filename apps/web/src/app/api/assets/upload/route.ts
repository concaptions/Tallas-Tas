import { auth } from '@clerk/nextjs/server';
import { insertAsset, isR2Available, uploadToR2 } from '@tas/db';
import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { withAssetScope } from '@/lib/assets-source';
import { isBrandSelectable } from '@/lib/data-source';
import { assetsPath } from '@/lib/routes';

import { defaultUploadDeps, handleUpload, type UploadScopeResult } from './handler';

/**
 * POST /api/assets/upload — the one upload surface. The HTTP shell: `auth()` + brand entitlement
 * check (actor from Clerk, brand from the request body, cross-checked against `isBrandSelectable`),
 * then `handleUpload` applies every other rule and returns the response shape. See `handler.ts` for
 * the policy. The pipeline degrades to 503 "Storage not configured" when R2 is unset — the
 * paste's graceful-degradation requirement.
 */
export const runtime = 'nodejs';

async function resolveScope(brandIdFromRequest: string): Promise<UploadScopeResult> {
  const { userId } = await auth();
  if (userId === null) {
    return { ok: false, status: 401, error: 'Sign in required to upload.' };
  }

  // `withAssetScope` opens the request connection and resolves the agency-scoped active brand.
  // We cross-check the posted brandId against that scope rather than trusting the request body —
  // CLAUDE.md non-negotiable 4 / 10 (no cross-brand leaks).
  const scope = await withAssetScope();
  const allowed = await isBrandSelectable(scope.db, brandIdFromRequest);
  if (!allowed) {
    await scope.close();
    return { ok: false, status: 403, error: 'That brand is not accessible from this workspace.' };
  }

  return {
    ok: true,
    scope: {
      db: scope.db,
      // The entitlement check succeeded; use the id the actor named (same shape as the active
      // brand's id, by construction above).
      brandId: brandIdFromRequest,
      actorId: userId,
      close: scope.close,
    },
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const outcome = await handleUpload(
    formData,
    defaultUploadDeps(
      resolveScope,
      isR2Available,
      uploadToR2,
      async (db, brandId, values, actorId) => {
        const row = await insertAsset(db, brandId, values, actorId);
        return row;
      },
    ),
  );
  if (outcome.status === 200) {
    revalidatePath(assetsPath);
  }
  return NextResponse.json(outcome.body, { status: outcome.status });
}
