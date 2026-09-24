import { cookies } from 'next/headers';

/**
 * The brand the person last chose in the switcher, remembered across requests.
 *
 * WHY A COOKIE. Every scoped read resolves its brand server-side through `resolveLiveBrand`
 * (`data-source.ts`), never from the client, so a selection the switcher makes has to reach the
 * server on the next request. A cookie is the smallest thing that does that without putting the
 * brand id in every URL. It is read on the server and is only ever the REQUESTED brand — never the
 * authority. `resolveLiveBrand` re-checks that the id belongs to the agency in scope on every read
 * and falls back to the agency's first brand otherwise, so a stale, forged or cross-tenant cookie
 * can only ever select nothing, never another tenant's data.
 */
export const ACTIVE_BRAND_COOKIE = 'tas_active_brand';

/**
 * The requested brand id, or null. Wrapped like `clerkActorScope`: `cookies()` throws outside a
 * request scope (a background job, a unit test), and that is not an error here — it means "no
 * request made a choice", which resolves to the agency's first brand.
 */
export async function readActiveBrandId(): Promise<string | null> {
  try {
    return (await cookies()).get(ACTIVE_BRAND_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Records the chosen brand. Callable only from a Server Action or Route Handler, which is the whole
 * reason `selectBrandAction` exists — and that action verifies the brand belongs to the actor's
 * agency BEFORE calling this, so an id written here has already been proven in scope.
 */
export async function writeActiveBrandId(brandId: string): Promise<void> {
  (await cookies()).set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}
