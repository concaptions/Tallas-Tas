import type { AssetListRow } from '@tas/db';

/**
 * HTTP-free handler for GET /api/assets/[assetId]. The route (`route.ts`) wires
 * `loadAssetById` (which already brand-scopes with the shipped resolver) and `presignedGetUrl` into
 * these dependency slots and returns a 302 or a JSON body. Three branches, matching the paste:
 *
 *   1. Asset not found or not accessible to the actor → 403 (we never leak "not found" against a
 *      different brand; a wrong id and a wrong brand look identical).
 *   2. R2 configured and a signer is available → 302 to a 1-hour presigned GET URL.
 *   3. R2 unset → 503 "Storage not configured".
 *
 * The paste also allows a public URL fallback: `R2_PUBLIC_URL` is not in the shipped env schema
 * (nothing reads it today), so we only use the presigned path. The branch is still here as a code
 * path in case a later ticket wires a public URL — passed through `publicUrl` dep.
 */

export type ServeOutcome =
  | { readonly kind: 'redirect'; readonly url: string }
  | {
      readonly kind: 'json';
      readonly status: 401 | 403 | 404 | 503;
      readonly body: { readonly error: string };
    };

export interface ServeHandlerDeps {
  readonly loadAsset: (assetId: string) => Promise<AssetListRow | null>;
  readonly authenticated: () => Promise<boolean>;
  readonly presignedGetUrl: (key: string, expiresSeconds?: number) => string | null;
  readonly publicUrl?: (key: string) => string | null;
}

export async function handleServe(assetId: string, deps: ServeHandlerDeps): Promise<ServeOutcome> {
  // Auth gate: a signed-out caller cannot reach this at all. Demo mode doesn't log in, so there is
  // no demo path for a serve — any attempt returns 401, which is what the UI reads when it hides
  // the Download button on a card without a signed session.
  if (!(await deps.authenticated())) {
    return { kind: 'json', status: 401, body: { error: 'Sign in required.' } };
  }

  const asset = await deps.loadAsset(assetId);
  if (asset === null) {
    // 403 (not 404) so a probe cannot distinguish "wrong id" from "another brand's id".
    return { kind: 'json', status: 403, body: { error: 'That asset is not available.' } };
  }

  const signed = deps.presignedGetUrl(asset.r2Key, 3600);
  if (signed !== null) {
    return { kind: 'redirect', url: signed };
  }

  const publicHref = deps.publicUrl?.(asset.r2Key) ?? null;
  if (publicHref !== null) {
    return { kind: 'redirect', url: publicHref };
  }

  return {
    kind: 'json',
    status: 503,
    body: { error: 'Storage not configured — set R2 credentials in the environment.' },
  };
}
