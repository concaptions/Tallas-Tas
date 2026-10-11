import { cookies } from 'next/headers';
import { serverEnv } from '@tas/env';

export const CLIENT_TOKEN_COOKIE = 'tas_client_token';

/**
 * The cookie's attributes, stated once. The cookie is SET by the `auth/verify` Route Handler on its
 * redirect response — never from a Server Component: Next 15 throws on `cookies().set()` there, which
 * is what turned every valid magic link into a 500 (CLIENT-ACCESS-500, 2026-10-11).
 */
export function clientTokenCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: serverEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90,
    path: '/client',
  };
}

export async function getClientToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CLIENT_TOKEN_COOKIE)?.value ?? null;
}
