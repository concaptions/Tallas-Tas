import { auth } from '@clerk/nextjs/server';
import { presignedGetUrl } from '@tas/db';
import { NextResponse, type NextRequest } from 'next/server';

import { loadAssetById } from '@/lib/assets-source';
import { isDemoMode } from '@/lib/demo-mode';

import { handleServe } from './handler';

/**
 * GET /api/assets/[assetId] — serve one asset. The route resolves auth and brand scope and asks
 * `handleServe` for the response shape (302 to a presigned URL, or 503 when R2 is unset). The
 * shipped `loadAssetById` already scopes by the active brand, so a cross-brand id returns null and
 * the handler translates to 403 (never 404 — a probe cannot distinguish).
 */
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<NextResponse | Response> {
  const { assetId } = await params;

  // Demo mode has no Clerk middleware, so `auth()` would throw. We short-circuit to a 503 "Storage
  // not configured" because the demo fixtures carry fictional `/demo/assets/...` URLs that are not
  // reachable here either — nothing useful to serve, same user-facing copy as a missing R2.
  const demoActive = isDemoMode();

  const outcome = await handleServe(assetId, {
    authenticated: async () => {
      if (demoActive) return false;
      return (await auth()).userId !== null;
    },
    loadAsset: async (id) => (await loadAssetById(id)).asset,
    presignedGetUrl: (key, expires) => presignedGetUrl(key, expires),
  });

  if (outcome.kind === 'redirect') {
    // 302 so the browser follows but does not cache the signed URL (a 301 would).
    return NextResponse.redirect(outcome.url, 302);
  }
  return NextResponse.json(outcome.body, { status: outcome.status });
}
