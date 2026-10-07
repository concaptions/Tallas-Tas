import { describe, expect, it } from 'vitest';

import { defaultTokenExpiry, generateClientToken, isTokenExpired } from './index';

describe('client-auth', () => {
  it('generateClientToken returns a base64url string of 43 chars', () => {
    const token = generateClientToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generates unique tokens', () => {
    const a = generateClientToken();
    const b = generateClientToken();
    expect(a).not.toBe(b);
  });

  it('isTokenExpired returns false for null (never expires)', () => {
    expect(isTokenExpired(null)).toBe(false);
  });

  it('isTokenExpired returns true for a past date', () => {
    const past = new Date('2020-01-01');
    expect(isTokenExpired(past)).toBe(true);
  });

  it('isTokenExpired returns false for a future date', () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isTokenExpired(future)).toBe(false);
  });

  it('defaultTokenExpiry returns a date ~90 days from now', () => {
    const now = Date.now();
    const expiry = defaultTokenExpiry();
    const diffDays = (expiry.getTime() - now) / 86_400_000;
    expect(diffDays).toBeGreaterThan(89);
    expect(diffDays).toBeLessThan(91);
  });
});
