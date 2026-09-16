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
export const designSystemPath = '/design-system';

/**
 * One concept's own route segment (PRD §5.7). The Concepts detail page is a real page, not a side
 * panel, so the id belongs in the path; `encodeURIComponent` keeps a non-uuid id from ever
 * producing a second segment.
 */
export function conceptPath(id: string): string {
  return `${conceptsPath}/${encodeURIComponent(id)}`;
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
