'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertClientAccessToken, revokeClientAccessToken } from '@tas/db';
import { generateClientToken, defaultTokenExpiry } from '@tas/domain';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/interface-config-source';
import { interfaceConfigPath } from '@/lib/routes';

/**
 * Client Access Token management actions (Phase 2 magic-link auth). Admins create tokens for
 * their brand's client portal; each token carries an email, an optional label, and a 90-day
 * expiry by default. Revoking a token is soft: `revoked = true` and the token stops resolving.
 */

export interface TokenActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly token?: string;
  readonly savedAt: number;
}

export interface TokenActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<string, string>>;
}

export type TokenActionResult = TokenActionSuccess | TokenActionFailure;

const createSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address.')),
  label: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v)),
});

export async function createClientTokenAction(
  _previous: TokenActionResult | null,
  formData: FormData,
): Promise<TokenActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = createSchema.safeParse({
    email: formData.get('email'),
    label: formData.get('label') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [first] = issue.path;
      if (typeof first === 'string') fieldErrors[first] ??= issue.message;
    }
    return { ok: false, error: 'Some fields need attention.', fieldErrors };
  }

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again.' };
    }

    const token = generateClientToken();
    const result = await withBrandScope(async (db, brandId) => {
      const row = await insertClientAccessToken(
        db,
        brandId,
        {
          token,
          email: parsed.data.email,
          label: parsed.data.label,
          expiresAt: defaultTokenExpiry(),
        },
        userId,
      );
      return { ok: true as const, id: row.id };
    });

    if (result === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }

    revalidatePath(interfaceConfigPath);
    return { ok: true, id: result.id, token, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The token could not be created. Try again.' };
  }
}

export async function revokeClientTokenAction(tokenId: string): Promise<TokenActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  if (typeof tokenId !== 'string' || tokenId === '') {
    return { ok: false, error: 'This token could not be identified.' };
  }

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again.' };
    }

    const result = await withBrandScope(async (db, brandId) => {
      const revoked = await revokeClientAccessToken(db, brandId, tokenId, userId);
      if (revoked === null) {
        return { ok: false as const, error: 'That token is no longer available.' };
      }
      return { ok: true as const, id: revoked.id };
    });

    if (result === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!result.ok) {
      return { ...result, savedAt: 0 } as TokenActionResult;
    }

    revalidatePath(interfaceConfigPath);
    return { ok: true, id: result.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The token could not be revoked. Try again.' };
  }
}
