/**
 * Copy and digest handling for the server-error boundary (`app/error.tsx`).
 *
 * Next.js strips a server exception's message before it reaches the browser in production and
 * serves its own unstyled "Application error: a server-side exception has occurred" screen, which
 * leaves the reader a bare digest and no way to tell a broken deployment from a broken page. These
 * constants are what the boundary renders instead.
 *
 * The copy names no environment variable, host or table. A brand client hits the same boundary as
 * the team (non-negotiable 10), so the screen carries only the digest — the one identifier shared
 * with the deployment log line — and the reader who is entitled to the cause looks it up there.
 */

export const ERROR_TITLE = 'This page could not be loaded.';

export const ERROR_BODY =
  'The server stopped while rendering it. Nothing was saved, and the rest of the workspace is unaffected.';

/** Precedes the digest. Split from it so the digest itself can be the only monospaced run. */
export const ERROR_DIGEST_PREFIX = 'Reference';

export const ERROR_DIGEST_HINT = 'Quote this when reporting the failure.';

export const RETRY_LABEL = 'Try again';

export const BACK_LABEL = 'Back to workspace';

/**
 * The digest Next.js attaches to a server exception, or `null` when there is none — a boundary that
 * caught a client-side render error has no digest, and a `Reference` line with nothing after it
 * reads as a second failure. Trimmed but never reformatted: it has to match the log line verbatim.
 */
export function digestLabel(digest: string | undefined): string | null {
  const trimmed = digest?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
