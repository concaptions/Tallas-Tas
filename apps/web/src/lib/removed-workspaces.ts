import {
  REMOVED_WORKSPACE_REDIRECTS,
  isRemovedWorkspace,
  type NavSectionKey,
  type RemovedWorkspaceKey,
  type RemovedWorkspaceRedirectTarget,
} from '@tas/domain';

import { appPath, assetsPath, copywritingPath, creativeSheetPath } from './routes';

/**
 * THE WEB APP'S READING OF `REMOVED_WORKSPACES` (Talal, 2026-10-07 — docs/decisions.md
 * "2026-10-09 — Template cleanup"). The list and the redirect targets are `@tas/domain`'s; this
 * module only turns a target into a URL and a retired key into the refusal a Server Action returns.
 *
 * It is NOT in `routes.ts` on purpose: `routes.ts` is imported by `src/middleware.ts`, which runs
 * at the edge, and the one thing this module needs that `routes.ts` does not is a VALUE import of
 * `@tas/domain`. Keeping it here keeps the whole domain barrel out of the middleware bundle.
 */

/** Where each redirect target lands. The Asset Library opens on its client-folders tab, which is the page Client Assets became (Task C, 2026-10-07). */
const TARGET_PATHS: Readonly<Record<RemovedWorkspaceRedirectTarget, string>> = {
  'creative-sheet': creativeSheetPath,
  assets: `${assetsPath}?tab=client-folders`,
  copywriting: copywritingPath,
  overview: appPath,
};

/** The query string a page received, as Next hands it to a server component. */
export type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * The URL a retired workspace's old address redirects to, with the visitor's own query string
 * carried over (a `?copy=` or `?q=` bookmark keeps its meaning where the target understands it, and
 * is harmless where it does not). The target's own query — the Asset Library's tab — wins over a
 * visitor's key of the same name, because it is what makes the landing page the right one.
 */
export function removedWorkspaceRedirect(
  key: RemovedWorkspaceKey,
  searchParams?: SearchParams,
): string {
  const target = TARGET_PATHS[REMOVED_WORKSPACE_REDIRECTS[key]];
  const [pathname, targetQuery = ''] = target.split('?', 2);
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === 'string') params.set(name, value);
  }
  for (const [name, value] of new URLSearchParams(targetQuery)) {
    params.set(name, value);
  }
  const query = params.toString();
  return query === '' ? (pathname ?? target) : `${pathname ?? target}?${query}`;
}

/** The sentence a retired workspace's Server Action answers with. One constant, like `DEMO_WRITE_REFUSAL`. */
export const REMOVED_WORKSPACE_REFUSAL =
  'This workspace has been retired and no longer accepts changes.';

/** The failure half of every Server Action's result union, which is what makes one helper fit all of them. */
export interface RemovedWorkspaceRefusal {
  readonly ok: false;
  readonly error: string;
}

/**
 * Defence in depth for a retired workspace's Server Actions. The sidebar hides the link, the
 * segment layout redirects the route, and this refuses the write — because a Server Action is a
 * POST endpoint that a stale tab or a hand-built request can still reach after both of those.
 *
 * Returns the refusal for a key in `REMOVED_WORKSPACES` and `null` for a live one, so an action's
 * first two lines are `const retired = assertWorkspaceLive('copy-types'); if (retired) return
 * retired;` and the code beneath them stays exactly as it was for the day the key is deleted.
 */
export function assertWorkspaceLive(key: NavSectionKey): RemovedWorkspaceRefusal | null {
  return isRemovedWorkspace(key) ? { ok: false, error: REMOVED_WORKSPACE_REFUSAL } : null;
}
