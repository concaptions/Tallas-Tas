import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

import { clerkKeys } from '@/lib/clerk-keys';
import { isPublicPath, signInPath, signUpPath } from '@/lib/routes';

export const config = {
  // Node.js runtime (stable since Next 15.5, D-013): `@tas/env` reads the repo-root `.env.local`
  // through node:fs, which the Edge runtime cannot bundle.
  runtime: 'nodejs',
  matcher: [
    // Every route except Next.js internals and static files (Clerk's documented matcher).
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // API routes always run through it.
    '/(api|trpc)(.*)',
  ],
};

/**
 * DEMO MODE. With no identity provider nobody can hold a session, so there is no session to protect
 * and nothing a redirect to `/sign-in` could accomplish except hiding the product: every route is
 * let through.
 *
 * What makes that safe is not this file but the data layer. `src/lib/data-source.ts` serves the
 * in-repo demo fixtures whenever `isDemoMode()` is true and never opens a database connection, even
 * with `DATABASE_URL` set, and every mutation is refused. An unauthenticated visitor on the
 * key-less Vercel deployment can therefore only ever reach fixtures.
 */
function withoutClerk(): NextResponse {
  return NextResponse.next();
}

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const keys = clerkKeys();
  if (keys === undefined) {
    return withoutClerk();
  }
  // Built per request from the keys just validated; nothing is cached at module level. Only the
  // publishable key is handed over: a `secretKey` option makes Clerk encrypt it into a request header
  // and demands a `CLERK_ENCRYPTION_KEY`, so the SDK reads the secret from the process environment
  // instead, the same variable `clerkKeys()` validated (D-013).
  const withClerk = clerkMiddleware(
    async (auth, clerkRequest) => {
      if (!isPublicPath(clerkRequest.nextUrl.pathname)) {
        await auth.protect();
      }
    },
    { publishableKey: keys.publishableKey, signInUrl: signInPath, signUpUrl: signUpPath },
  );
  return withClerk(request, event);
}
