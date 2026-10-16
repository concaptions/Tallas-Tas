import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { DM_Mono, Figtree, Inter, JetBrains_Mono, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';

import { clerkPublishableKey } from '@/lib/clerk-keys';
import { appPath, signInPath, signUpPath } from '@/lib/routes';
import { HYDRATION_REPLAY_BOOT_SCRIPT } from '@/lib/hydration-replay';
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from '@/lib/theme';

import { HydrationReplay } from '@/components/shell/hydration-replay';

import './globals.css';

// The two families of the design handoff. The CSS variables are what packages/ui/src/styles/tokens.css
// reads for --sans and --mono; body copy is Inter, auto-generated system output is JetBrains Mono.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// The three Bold faces (Bold redesign commit 1, docs/design/bold-redesign-spec.md §2). They only
// hand over CSS variables here; tokens.css CONSUMES Outfit and DM Mono solely under the
// `data-ui="bold"` scope (template brand only), so the default palette keeps Inter/JetBrains Mono.
// Figtree is loaded now but consumed later, by the FB ad preview of chain commit 7.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-figtree',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TAS Creative Platform',
  description: 'Creative workflow for the TAS Digital team and their clients.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const publishableKey = clerkPublishableKey();
  const document = (
    // Warm dark is the default theme; `data-theme` is the switch the token layer reads.
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${inter.variable} ${jetBrainsMono.variable} ${outfit.variable} ${dmMono.variable} ${figtree.variable}`}
    >
      <head>
        {/* Applies the remembered theme before the first paint, so light never flashes dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Records a press that lands before hydration; HydrationReplay replays it (SMOKE-13). */}
        <script dangerouslySetInnerHTML={{ __html: HYDRATION_REPLAY_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg text-text font-sans antialiased">
        <HydrationReplay />
        {children}
      </body>
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
