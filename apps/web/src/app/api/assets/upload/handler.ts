import type { AssetCategory, AssetInput, Db } from '@tas/db';
import { assetCategories } from '@tas/db';
import { serverEnv } from '@tas/env';

import { isDemoMode } from '@/lib/demo-mode';
import {
  ASSET_MAX_BYTES,
  composeAssetKey,
  isAllowedAssetMime,
  sanitizeAssetFilename,
  type R2UploadOutcome,
} from '@/lib/r2-upload';

/**
 * HTTP-agnostic upload logic. The route (`route.ts`) wires `auth()`, `withAssetScope()`,
 * `uploadToR2`, `insertAsset` and `crypto.randomUUID` into these dependency slots and translates
 * the discriminated `UploadOutcome` to a `NextResponse`. This split exists for two reasons:
 *
 *   1. Unit tests pass fakes for every dependency and never touch the Clerk SDK, R2 or the database.
 *   2. The validation and policy decisions sit in one function the reviewer can read top to bottom
 *      — demo refusal, auth, brand entitlement, R2 availability, size cap, MIME allowlist, upload,
 *      insert — in the same order the paste lists them.
 *
 * The 503 path when R2 is unset is the whole paste's "graceful degradation": the pipeline works
 * on Vercel (where the vars live) and shows a clear not-configured response locally. No fallback
 * write path.
 */

export type UploadOutcome =
  | { readonly status: 200; readonly body: UploadSuccessBody }
  | {
      readonly status: 400 | 401 | 403 | 413 | 415 | 500 | 502 | 503;
      readonly body: UploadErrorBody;
    };

export interface UploadSuccessBody {
  readonly asset: {
    readonly id: string;
    readonly filename: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly category: AssetCategory;
    readonly createdAt: string;
  };
}

export interface UploadErrorBody {
  readonly error: string;
  readonly detail?: string;
}

/** The actor + brand resolution the handler needs before it will trust the request body. */
export interface UploadScope {
  readonly db: Db;
  readonly brandId: string;
  readonly actorId: string;
  readonly close: () => Promise<void>;
}

export type UploadScopeResult =
  | { readonly ok: true; readonly scope: UploadScope }
  | { readonly ok: false; readonly status: 401 | 403; readonly error: string };

export interface UploadHandlerDeps {
  readonly demoMode?: () => boolean;
  readonly resolveScope: (brandIdFromRequest: string) => Promise<UploadScopeResult>;
  readonly randomUUID: () => string;
  readonly isR2Available: () => boolean;
  readonly uploadToR2: (
    key: string,
    body: ArrayBuffer,
    contentType: string,
  ) => Promise<R2UploadOutcome>;
  readonly insertAsset: (
    db: Db,
    brandId: string,
    values: AssetInput,
    actorId: string,
  ) => Promise<{
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    category: AssetCategory;
    createdAt: Date;
  }>;
  readonly nodeEnv?: 'development' | 'test' | 'production';
}

/** Narrows an incoming category string to the enum; `null` on any other value. */
function narrowCategory(raw: unknown): AssetCategory | null {
  return typeof raw === 'string' && (assetCategories as readonly string[]).includes(raw)
    ? (raw as AssetCategory)
    : null;
}

/**
 * Pure (HTTP-free) upload. Takes a FormData and the dependencies above, returns the response that
 * `route.ts` will serialise. All refusals go through this one function so the test suite is the
 * documentation.
 */
export async function handleUpload(
  formData: FormData,
  deps: UploadHandlerDeps,
): Promise<UploadOutcome> {
  const demoActive = (deps.demoMode ?? isDemoMode)();
  if (demoActive) {
    // Demo mode never reaches R2 or the database: the paste makes this the first gate, after only
    // auth. Returned as 403 so the UI's modal shows the shipped sign-in-required copy.
    return { status: 403, body: { error: 'Sign in required to upload.' } };
  }

  // The scope resolver answers the two questions the handler cannot: who is asking, and are they
  // allowed to post against the brand named in the form.
  const rawBrandId = formData.get('brandId');
  const brandIdFromRequest = typeof rawBrandId === 'string' ? rawBrandId : '';
  if (brandIdFromRequest === '') {
    return { status: 400, body: { error: 'brandId is required.' } };
  }

  const scopeResult = await deps.resolveScope(brandIdFromRequest);
  if (!scopeResult.ok) {
    return { status: scopeResult.status, body: { error: scopeResult.error } };
  }

  const { scope } = scopeResult;
  try {
    // Fail fast on misconfigured storage — the paste's "Storage not configured" copy lives here.
    if (!deps.isR2Available()) {
      return {
        status: 503,
        body: {
          error: 'Storage not configured — set R2 credentials in the environment.',
        },
      };
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return { status: 400, body: { error: 'file is required.' } };
    }

    if (file.size > ASSET_MAX_BYTES) {
      return {
        status: 413,
        body: {
          error: `File is larger than the ${String(ASSET_MAX_BYTES / 1024 / 1024)} MB limit.`,
        },
      };
    }

    const contentType = file.type || 'application/octet-stream';
    if (!isAllowedAssetMime(contentType)) {
      return {
        status: 415,
        body: {
          error: 'That file type is not accepted. Allowed: images, videos, PDF.',
        },
      };
    }

    const category = narrowCategory(formData.get('category'));
    if (category === null) {
      return { status: 400, body: { error: 'category is required and must be a known value.' } };
    }

    const caption = formData.get('caption');
    const captionValue =
      typeof caption === 'string' && caption.trim() !== '' ? caption.trim() : null;

    const sanitized = sanitizeAssetFilename(file.name);
    const key = composeAssetKey(scope.brandId, deps.randomUUID(), sanitized);
    const body = await file.arrayBuffer();

    const upload = await deps.uploadToR2(key, body, contentType);
    if (!upload.ok) {
      // 502: a dependency returned a non-ok response. In development we hand the SigV4 error back
      // for inspection; in production it is a short message so no credential detail leaks.
      const detail = (deps.nodeEnv ?? 'development') === 'production' ? undefined : upload.error;
      return { status: 502, body: { error: 'Upload to storage failed.', detail } };
    }

    const row = await deps.insertAsset(
      scope.db,
      scope.brandId,
      {
        filename: sanitized,
        contentType,
        sizeBytes: file.size,
        r2Key: upload.r2Key,
        url: upload.url,
        category,
        conceptId: null,
        creatorId: null,
        caption: captionValue,
        legacyAirtableId: null,
      },
      scope.actorId,
    );

    return {
      status: 200,
      body: {
        asset: {
          id: row.id,
          filename: row.filename,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          category: row.category,
          createdAt: row.createdAt.toISOString(),
        },
      },
    };
  } finally {
    await scope.close();
  }
}

/**
 * Production dependency wiring, read by `route.ts`. The handler is still testable because the
 * real deps are a plain record this function builds.
 */
export function defaultUploadDeps(
  resolveScope: UploadHandlerDeps['resolveScope'],
  r2Available: UploadHandlerDeps['isR2Available'],
  uploadToR2: UploadHandlerDeps['uploadToR2'],
  insertAsset: UploadHandlerDeps['insertAsset'],
): UploadHandlerDeps {
  return {
    resolveScope,
    isR2Available: r2Available,
    uploadToR2,
    insertAsset,
    randomUUID: () => crypto.randomUUID(),
    nodeEnv: serverEnv().NODE_ENV,
  };
}
