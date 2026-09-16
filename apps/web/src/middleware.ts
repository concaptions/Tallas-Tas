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
 * With no identity provider nobody can hold a session, so every private route goes to sign-in. This
 * is the D-008 substitute that keeps `pnpm dev` and the always-on E2E test working without keys.
 */
function withoutClerk(request: NextRequest): NextResponse {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL(signInPath, request.url));
}

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const keys = clerkKeys();
  if (keys === undefined) {
    return withoutClerk(request);
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
