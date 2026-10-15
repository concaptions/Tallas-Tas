import { serverEnv } from '@tas/env';
import { NextResponse } from 'next/server';

/**
 * GET /api/version — the deploy-proof endpoint (Phase B5 Fix B, 2026-10-15 coordinator gate).
 *
 * Returns the git SHA the running build was deployed from, read from Vercel's own
 * `VERCEL_GIT_COMMIT_SHA` environment variable (which Vercel sets automatically on every
 * deployment). A later commit's `curl` against this route proves the deployment matches
 * the local HEAD — nothing lands as "shipped" until this endpoint says so.
 *
 * `null` when the variable is unset, which indicates a Vercel build-config problem rather
 * than a transient failure. The route is intentionally public: the SHA is public already
 * (every commit's hash is on GitHub), so no auth gate is warranted. The env is read through
 * `@tas/env` per the repo rule — `process.env` is lint-restricted outside that package.
 */
export const runtime = 'nodejs';

export function GET(): NextResponse {
  const sha = serverEnv().VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json({ sha });
}
