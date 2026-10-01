import Link from 'next/link';

import { appPath } from '@/lib/routes';

/**
 * What the page slot under the /app shell shows when a page calls `notFound()`. The shell streams
 * first through the Suspense boundary in `loading.tsx`, so the response is a 200 shell and this
 * page, with Next's `noindex` meta, is what says the record does not exist
 * (docs/decisions/briefs-spec-fix-2026-10-01.md). Token classes only (CLAUDE.md UI governance 1); a
 * route file, not a shared primitive.
 */
export default function AppNotFound() {
  return (
    <section
      data-slot="not-found"
      aria-labelledby="not-found-heading"
      className="flex flex-col gap-3"
    >
      <h1 id="not-found-heading" className="text-lg font-medium text-text">
        Not found
      </h1>
      <p className="text-sm text-text2">
        There is no record at this address. It may have been removed, or the link may be wrong.
      </p>
      <Link href={appPath} className="text-sm text-accent underline-offset-4 hover:underline">
        Back to the overview
      </Link>
    </section>
  );
}
