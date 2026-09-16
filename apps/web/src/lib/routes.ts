/**
 * Route access for the middleware (TICKET-004). Everything not listed here needs a session: `/app`,
 * every `/app/*` page and any page added later. Static assets never reach the middleware; its
 * `matcher` in `src/middleware.ts` excludes them.
 */
export const signInPath = '/sign-in';
export const signUpPath = '/sign-up';
export const appPath = '/app';

/** Public trees: the path itself and everything below it (`/sign-in/factor-one`). */
const publicTrees = [signInPath, signUpPath];

/** `/`, `/sign-in(.*)` and `/sign-up(.*)` are public; every other path is protected. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    publicTrees.some((root) => pathname === root || pathname.startsWith(`${root}/`))
  );
}
