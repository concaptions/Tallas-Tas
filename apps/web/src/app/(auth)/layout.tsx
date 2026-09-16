import type { ReactNode } from 'react';

import { clerkPublishableKey } from '@/lib/clerk-keys';

function ClerkNotConfigured() {
  return (
    <section className="max-w-md space-y-2 rounded-lg border p-6">
      <h1 className="text-lg font-semibold">Sign-in is not configured</h1>
      <p className="text-sm text-muted-foreground">
        Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> (see
        docs/runbook.md), then restart the app.
      </p>
    </section>
  );
}

/**
 * Centres Clerk's sign-in and sign-up components. Without a publishable key there is no
 * `ClerkProvider` to mount them in, so the page explains what is missing instead (D-008, D-013).
 */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      {clerkPublishableKey() === undefined ? <ClerkNotConfigured /> : children}
    </main>
  );
}
