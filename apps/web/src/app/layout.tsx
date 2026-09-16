import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { clerkPublishableKey } from '@/lib/clerk-keys';
import { appPath, signInPath, signUpPath } from '@/lib/routes';

import './globals.css';

export const metadata: Metadata = {
  title: 'TAS Creative Platform',
  description: 'Creative workflow for the TAS Digital team and their clients.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const publishableKey = clerkPublishableKey();
  const document = (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );

  // Without a publishable key in the process environment the app runs identity-less (D-008, D-013):
  // no ClerkProvider, so Clerk's keyless mode never starts, and the middleware sends every private
  // route to /sign-in.
  if (publishableKey === undefined) {
    return document;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={signInPath}
      signUpUrl={signUpPath}
      signInFallbackRedirectUrl={appPath}
      signUpFallbackRedirectUrl={appPath}
      afterSignOutUrl="/"
    >
      {document}
    </ClerkProvider>
  );
}
