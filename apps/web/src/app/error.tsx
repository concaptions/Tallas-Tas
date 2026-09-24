'use client';

import Link from 'next/link';

import { Button } from '@tas/ui';

import {
  BACK_LABEL,
  ERROR_BODY,
  ERROR_DIGEST_HINT,
  ERROR_DIGEST_PREFIX,
  ERROR_TITLE,
  RETRY_LABEL,
  digestLabel,
} from '@/lib/error-notice';
import { appPath } from '@/lib/routes';

/**
 * The server-error boundary for every segment below the root layout.
 *
 * It sits at the ROOT segment, not under `/app`, because the throw this exists for happens in
 * `app/app/layout.tsx`: that layout awaits `currentBrand()`, so a database that is configured but
 * unreachable — or reachable but unmigrated — fails in the layout itself, and a boundary inside a
 * segment never catches its own layout. Only the parent segment's boundary does. Placed here it
 * covers the shell layout and every page under it.
 *
 * A client component, as React requires of an error boundary, and styled from the token layer: it
 * renders inside the root layout, so `globals.css` and both font variables are already loaded.
 */
export default function AppError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const digest = digestLabel(error.digest);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6">
        <h1 className="text-sm font-semibold tracking-tight text-text">{ERROR_TITLE}</h1>
        <p className="mt-2 text-sm text-text2">{ERROR_BODY}</p>
        {digest === null ? null : (
          <p className="mt-4 text-xs text-text3">
            {ERROR_DIGEST_PREFIX}{' '}
            <span className="rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-text2">
              {digest}
            </span>{' '}
            {ERROR_DIGEST_HINT}
          </p>
        )}
        <div className="mt-6 flex items-center gap-2">
          <Button type="button" onClick={reset}>
            {RETRY_LABEL}
          </Button>
          <Button asChild variant="ghost">
            <Link href={appPath}>{BACK_LABEL}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
