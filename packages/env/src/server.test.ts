import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createEnv, serverEnv, serverSource } from './server';

const valid = { DATABASE_URL: 'postgresql://user:secret@db.example.neon.tech/tas' };

describe('serverEnv', () => {
  it('parses a valid env and defaults NODE_ENV to development', () => {
    expect(serverEnv(valid)).toEqual({ ...valid, NODE_ENV: 'development' });
  });

  it('keeps optional variables when they are present', () => {
    expect(serverEnv({ ...valid, SLACK_BOT_TOKEN: 'xoxb-1' }).SLACK_BOT_TOKEN).toBe('xoxb-1');
  });

  it('accepts a missing DATABASE_URL (optional for the Clerk-only transitional state)', () => {
    expect(serverEnv({ NODE_ENV: 'test' }).DATABASE_URL).toBeUndefined();
  });

  it('throws naming DATABASE_URL when it is not a url', () => {
    expect(() => serverEnv({ DATABASE_URL: 'not a url' })).toThrow(/DATABASE_URL/);
  });

  it('treats an empty string as unset', () => {
    expect(serverEnv({ DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
    expect(serverEnv({ ...valid, RESEND_API_KEY: '' }).RESEND_API_KEY).toBeUndefined();
  });

  it('rejects an optional variable that is present but malformed', () => {
    expect(() => serverEnv({ ...valid, CLERK_SECRET_KEY: 'pk_live_1' })).toThrow(
      /CLERK_SECRET_KEY/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => serverEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});

describe('createEnv', () => {
  it('validates on first call and memoises the result', () => {
    const env = createEnv(valid);
    expect(env.serverEnv()).toBe(env.serverEnv());
    expect(env.clientEnv()).toBe(env.clientEnv());
  });

  it('does not validate at creation and accepts empty source', () => {
    const env = createEnv({});
    expect(env.serverEnv().DATABASE_URL).toBeUndefined();
  });
});

describe('serverSource', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tas-env-'));
  const envFile = join(dir, '.env.local');
  writeFileSync(envFile, 'DATABASE_URL=postgresql://file/db\nRESEND_API_KEY=re_file\n');

  it('merges .env.local under the process environment in development', () => {
    const source = serverSource({ RESEND_API_KEY: 're_shell' }, envFile);
    expect(source).toEqual({ DATABASE_URL: 'postgresql://file/db', RESEND_API_KEY: 're_shell' });
  });

  it('ignores .env.local outside development', () => {
    const env = { NODE_ENV: 'production' };
    expect(serverSource(env, envFile)).toBe(env);
  });

  it('tolerates a missing .env.local', () => {
    expect(serverSource({ DATABASE_URL: 'x' }, join(dir, 'missing'))).toEqual({
      DATABASE_URL: 'x',
    });
  });
});
