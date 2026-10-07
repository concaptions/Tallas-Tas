import { describe, expect, it } from 'vitest';

import { defaultTokenExpiry, generateClientToken, isTokenExpired } from './index';

describe('generateClientToken', () => {
  it('returns a base64url string of at least 32 characters', () => {
    const token = generateClientToken();
    expect(typeof token).toBe('string');
    // 32 bytes in base64url is 43 characters
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it('returns a different token each time', () => {
    const a = generateClientToken();
    const b = generateClientToken();
    expect(a).not.toBe(b);
  });

  it('contains only base64url characters', () => {
    const token = generateClientToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('isTokenExpired', () => {
  it('returns false when expiresAt is null (never expires)', () => {
    expect(isTokenExpired(null)).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTokenExpired(past)).toBe(true);
  });

  it('returns false when expiresAt is in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTokenExpired(future)).toBe(false);
  });
});

describe('defaultTokenExpiry', () => {
  it('returns a date roughly 90 days from now', () => {
    const before = Date.now();
    const expiry = defaultTokenExpiry();
    const after = Date.now();

    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + ninetyDaysMs - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + ninetyDaysMs + 1000);
  });

  it('returns a Date instance', () => {
    expect(defaultTokenExpiry()).toBeInstanceOf(Date);
  });
});
