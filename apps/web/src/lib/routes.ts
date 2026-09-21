/**
 * Route access for the middleware (TICKET-004). Everything not listed here needs a session: `/app`,
 * every `/app/*` page and any page added later. Static assets never reach the middleware; its
 * `matcher` in `src/middleware.ts` excludes them.
 */
export const signInPath = '/sign-in';
export const signUpPath = '/sign-up';
export const appPath = '/app';
export const personasPath = '/app/personas';
export const productsPath = '/app/products';
export const anglesPath = '/app/angles';
export const themesPath = '/app/themes';
export const conceptsPath = '/app/concepts';
export const briefsPath = '/app/briefs';
export const copywritingPath = '/app/copywriting';
export const ugcPath = '/app/ugc';
/**
 * The Internal Queue board (PRD §9, §13). It lives under a `queue` segment rather than at
 * `/app/internal-queue` because the Client Queue is the next page in the same group: two boards of
 * the same shape, one per track, and the segment is what keeps them siblings instead of two
 * unrelated top-level words. The sidebar section key stays `internal-queue`.
 */
export const internalQueuePath = '/app/queue/internal';
/**
 * The Client Queue board (PRD §9, §10). Sibling of `internalQueuePath` under the same `queue`
 * segment: two boards of the same shape, one per track. The sidebar section key stays
 * `client-queue`.
 */
export const clientQueuePath = '/app/queue/client';
/**
 * The Team roster (PRD §11, §3). One flat page under `/app`, not a `settings` segment: the sidebar
 * group is called `settings`, but the page is a roster of people, and the two other pages that
 * group will hold (brands, billing) are siblings of it rather than children.
 */
export const teamPath = '/app/team';
/**
 * The Interface Config page (PRD §10: which pages and which fields the client's interface shows).
 * A flat page under `/app` beside `teamPath`, not a `settings` segment, for the reason `teamPath`
 * gives: `settings` is the sidebar GROUP, and the pages in it are siblings rather than children.
 * The sidebar section key stays `interface-config`.
 */
export const interfaceConfigPath = '/app/interface-config';
/**
 * The Notifications page (PRD §12: one row per trigger, a Slack DM switch and an email switch).
 * A flat page under `/app` beside `interfaceConfigPath`, for the reason `teamPath` gives: `settings`
 * is the sidebar GROUP, and the pages in it are siblings rather than children. The sidebar section
 * key stays `notifications`.
 */
export const notificationsPath = '/app/notifications';
/**
 * The Propagation page (PRD §5, §14.1: a child brand asks to promote a change to the template, and
 * the agency admin approves or rejects it here). A flat page under `/app` beside
 * `notificationsPath`, for the reason `teamPath` gives: `settings` is the sidebar GROUP, and the
 * pages in it are siblings rather than children. The sidebar section key stays `propagation`.
 */
export const propagationPath = '/app/propagation';
/**
 * The brand onboarding wizard (PRD §3). Creates a new client workspace with team assignments,
 * interface config and notification defaults seeded from the template.
 */
export const onboardPath = '/app/onboard';
export const assetsPath = '/app/assets';
export const clientPortalPath = '/client';
export const designSystemPath = '/design-system';

/**
 * One concept's own route segment (PRD §5.7). The Concepts detail page is a real page, not a side
 * panel, so the id belongs in the path; `encodeURIComponent` keeps a non-uuid id from ever
 * producing a second segment.
 */
export function conceptPath(id: string): string {
  return `${conceptsPath}/${encodeURIComponent(id)}`;
}

/**
 * One brief's own route segment (PRD §5.10, ticket criterion 3). The Creative Briefs detail page is
 * a real route, not a side panel, so the id belongs in the path and Back restores the list;
 * `encodeURIComponent` keeps a non-uuid id from ever producing a second segment.
 */
export function briefPath(id: string): string {
  return `${briefsPath}/${encodeURIComponent(id)}`;
}

/** Public trees: the path itself and everything below it (`/sign-in/factor-one`). */
const publicTrees = [signInPath, signUpPath];

/** `/`, `/sign-in(.*)` and `/sign-up(.*)` are public; every other path is protected. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    publicTrees.some((root) => pathname === root || pathname.startsWith(`${root}/`))
  );
}
