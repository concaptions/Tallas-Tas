import { randomBytes } from 'node:crypto';

export function generateClientToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isTokenExpired(expiresAt: Date | null): boolean {
  if (expiresAt === null) return false;
  return new Date() > expiresAt;
}

export function defaultTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d;
}
