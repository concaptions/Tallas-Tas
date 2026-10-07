import { cookies } from 'next/headers';
import { serverEnv } from '@tas/env';

const CLIENT_TOKEN_COOKIE = 'tas_client_token';

export async function getClientToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CLIENT_TOKEN_COOKIE)?.value ?? null;
}

export async function setClientTokenCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(CLIENT_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: serverEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90,
    path: '/client',
  });
}
