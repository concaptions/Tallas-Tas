import { redirect } from 'next/navigation';

import { findTokenByValue, touchTokenLastUsed } from '@tas/db';
import { serverEnv } from '@tas/env';
import { isTokenExpired } from '@tas/domain';

import { resolveClientBrand } from '@/lib/client-brand-source';
import { setClientTokenCookie } from '@/lib/client-auth';
import { requestConnection } from '@/lib/request-db';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClientAuthPage({ params, searchParams }: Props) {
  const { brandSlug } = await params;
  const resolvedParams = await searchParams;
  const token = typeof resolvedParams.token === 'string' ? resolvedParams.token : null;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex max-w-md flex-col gap-4 text-center">
          <h1 className="text-xl font-semibold text-text">Invalid Link</h1>
          <p className="text-sm text-text2">
            This link is missing a token. Please use the link from your email invitation.
          </p>
        </div>
      </div>
    );
  }

  const brand = await resolveClientBrand(brandSlug);
  if (!brand) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex max-w-md flex-col gap-4 text-center">
          <h1 className="text-xl font-semibold text-text">Brand Not Found</h1>
          <p className="text-sm text-text2">The brand in this link could not be found.</p>
        </div>
      </div>
    );
  }

  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex max-w-md flex-col gap-4 text-center">
          <h1 className="text-xl font-semibold text-text">Service Unavailable</h1>
          <p className="text-sm text-text2">
            The service is not fully configured. Please contact the team.
          </p>
        </div>
      </div>
    );
  }

  const { db, close } = requestConnection(databaseUrl);
  try {
    const row = await findTokenByValue(db, token);

    if (!row || row.brandId !== brand.id || isTokenExpired(row.expiresAt)) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="flex max-w-md flex-col gap-4 text-center">
            <h1 className="text-xl font-semibold text-text">Link Expired or Invalid</h1>
            <p className="text-sm text-text2">
              This access link has expired, been revoked, or is not valid for this brand. Please
              request a new link from your account manager.
            </p>
          </div>
        </div>
      );
    }

    // Best-effort timestamp update
    try {
      await touchTokenLastUsed(db, row.id);
    } catch {
      // non-critical: the token is valid regardless
    }

    await setClientTokenCookie(token);
    redirect(`/client/${encodeURIComponent(brandSlug)}`);
  } finally {
    await close();
  }
}
