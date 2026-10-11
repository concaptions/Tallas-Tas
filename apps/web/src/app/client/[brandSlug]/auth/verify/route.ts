import { NextResponse } from 'next/server';

import { findTokenByValue, touchTokenLastUsed } from '@tas/db';
import { isTokenExpired } from '@tas/domain';
import { serverEnv } from '@tas/env';

import { CLIENT_TOKEN_COOKIE, clientTokenCookieOptions } from '@/lib/client-auth';
import { resolveClientBrand } from '@/lib/client-brand-source';
import { requestConnection } from '@/lib/request-db';

export const dynamic = 'force-dynamic';

/** Why a link did not open the portal; `auth/page.tsx` renders the matching message. */
export type AuthRefusal = 'missing' | 'brand' | 'unconfigured' | 'expired';

/**
 * The magic link's landing: `/client/<slug>/auth/verify?token=…` (CLIENT-ACCESS-500, 2026-10-11).
 * A ROUTE HANDLER, because the token cookie can only be set from one (or a Server Action) — the
 * Server Component that did this before threw on `cookies().set()` after touching the token row.
 * A good token sets the cookie on a 307 to the portal; anything else is a 307 back to the auth
 * page with the reason, so the user always lands on a page, never on an error.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ brandSlug: string }> },
): Promise<NextResponse> {
  const { brandSlug } = await params;
  const slug = encodeURIComponent(brandSlug);
  const back = (reason: AuthRefusal): NextResponse =>
    NextResponse.redirect(new URL(`/client/${slug}/auth?reason=${reason}`, request.url), 307);

  const token = new URL(request.url).searchParams.get('token');
  if (token === null || token === '') return back('missing');

  const brand = await resolveClientBrand(brandSlug);
  if (!brand) return back('brand');

  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) return back('unconfigured');

  const { db, close } = requestConnection(databaseUrl);
  try {
    const row = await findTokenByValue(db, token);
    if (!row || row.brandId !== brand.id || isTokenExpired(row.expiresAt)) return back('expired');

    // Best-effort: the token is valid whether or not the timestamp lands.
    try {
      await touchTokenLastUsed(db, row.id);
    } catch {
      // non-critical
    }

    const response = NextResponse.redirect(new URL(`/client/${slug}`, request.url), 307);
    response.cookies.set(CLIENT_TOKEN_COOKIE, token, clientTokenCookieOptions());
    return response;
  } finally {
    await close();
  }
}
