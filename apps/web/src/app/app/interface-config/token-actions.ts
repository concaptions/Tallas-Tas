'use server';

import { auth } from '@clerk/nextjs/server';
import { brandSlugById, insertClientToken, listTokensForBrand, revokeToken } from '@tas/db';
import { generateClientToken, defaultTokenExpiry } from '@tas/domain';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/interface-config-source';

export interface TokenActionSuccess {
  readonly ok: true;
}

export interface TokenActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type TokenActionResult = TokenActionSuccess | TokenActionFailure;

export interface CreateTokenResult {
  readonly ok: true;
  readonly magicLinkUrl: string;
  readonly tokenId: string;
}

export interface TokenListItem {
  readonly id: string;
  readonly email: string;
  readonly label: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly revoked: boolean;
}

export interface TokenListResult {
  readonly ok: true;
  readonly tokens: TokenListItem[];
}

function failure(error: string): TokenActionFailure {
  return { ok: false, error };
}

async function actorId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

const createTokenSchema = z.object({
  brandId: z.uuid(),
  email: z.email(),
  label: z.string().max(200).optional(),
});

export async function createClientTokenAction(
  brandId: string,
  email: string,
  label?: string,
): Promise<CreateTokenResult | TokenActionFailure> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = createTokenSchema.safeParse({ brandId, email, label });
  if (!parsed.success) return failure('Invalid input.');

  const actor = await actorId();
  if (actor === null) return failure('Your session has expired. Sign in again.');

  const outcome = await withBrandScope(async (db, scopedBrandId) => {
    if (scopedBrandId !== parsed.data.brandId) {
      return failure('Brand mismatch.');
    }

    // The portal route is keyed by SLUG (`/client/[brandSlug]`); the id in that position answered
    // "Brand Not Found" for every link generated before 2026-10-11.
    const slug = await brandSlugById(db, scopedBrandId);
    if (slug === null) return failure('This brand is not available to clients.');

    const token = generateClientToken();
    const expiresAt = defaultTokenExpiry();

    const row = await insertClientToken(db, {
      brandId: parsed.data.brandId,
      token,
      email: parsed.data.email,
      label: parsed.data.label ?? null,
      expiresAt,
      createdBy: actor,
      updatedBy: actor,
    });

    // The magic link, on the brand slug, landing on the verify ROUTE HANDLER (the one place the
    // token cookie can be set). The caller prefixes with the origin.
    const magicLinkUrl = `/client/${encodeURIComponent(slug)}/auth/verify?token=${encodeURIComponent(token)}`;

    return { ok: true as const, magicLinkUrl, tokenId: row.id };
  });

  return outcome ?? failure('This workspace has no brand yet.');
}

const revokeTokenSchema = z.object({
  tokenId: z.uuid(),
});

export async function revokeClientTokenAction(
  tokenId: string,
): Promise<TokenActionResult | TokenActionFailure> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = revokeTokenSchema.safeParse({ tokenId });
  if (!parsed.success) return failure('Invalid token ID.');

  const actor = await actorId();
  if (actor === null) return failure('Your session has expired. Sign in again.');

  const outcome = await withBrandScope(async (db, brandId) => {
    const row = await revokeToken(db, parsed.data.tokenId, brandId, actor);
    if (!row) return failure('Token not found.');
    return { ok: true as const };
  });

  return outcome ?? failure('This workspace has no brand yet.');
}

export async function listClientTokensAction(
  brandId: string,
): Promise<TokenListResult | TokenActionFailure> {
  if (isDemoMode()) return { ok: true, tokens: [] };

  const parsed = z.uuid().safeParse(brandId);
  if (!parsed.success) return failure('Invalid brand ID.');

  const outcome = await withBrandScope(async (db, scopedBrandId) => {
    if (scopedBrandId !== parsed.data) {
      return failure('Brand mismatch.');
    }

    const rows = await listTokensForBrand(db, scopedBrandId);

    const tokens: TokenListItem[] = rows.map((r) => ({
      id: r.id,
      email: r.email,
      label: r.label,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      lastUsedAt: r.lastUsedAt,
      revoked: r.revoked,
    }));

    return { ok: true as const, tokens };
  });

  return outcome ?? failure('This workspace has no brand yet.');
}
