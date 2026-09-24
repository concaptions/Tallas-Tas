import { Client } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAutoDb, createNodeDb } from './db';

/**
 * The connection is built from `DATABASE_URL` and nothing else. node-postgres fills every config
 * field left unset (or falsy) from the libpq environment — `PGHOST`, `PGPORT`, `PGUSER`,
 * `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE` — which is exactly the ambient state a hosting dashboard
 * holds after someone copies a provider's whole variable tab. These tests plant that decoy
 * environment and prove the pool still aims at the URL. No test opens a socket: `Pool` and
 * `Client` construction resolve their parameters eagerly, which is the behaviour under test.
 */

const DECOYS = {
  PGHOST: 'unreachable.invalid',
  PGPORT: '9999',
  PGUSER: 'decoy-user',
  PGPASSWORD: 'decoy-password',
  PGDATABASE: 'decoy_db',
  PGSSLMODE: 'require',
} as const;

function plantDecoys(): void {
  for (const [key, value] of Object.entries(DECOYS)) {
    vi.stubEnv(key, value);
  }
}

/** The fields node-postgres actually resolved, read off a constructed (never connected) Client. */
interface ResolvedParameters {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly ssl: unknown;
}

function resolvedParameters(config: object): ResolvedParameters {
  const client = new Client(config) as unknown as { connectionParameters: ResolvedParameters };
  return client.connectionParameters;
}

const URL_OF_RECORD = 'postgresql://real-user:real-pass@db.example.com:6543/tas';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createNodeDb', () => {
  it('connects to the URL, not to a decoy libpq environment', async () => {
    plantDecoys();

    const db = createNodeDb(URL_OF_RECORD);
    const params = resolvedParameters(db.$client.options);
    await db.$client.end();

    expect(params.host).toBe('db.example.com');
    expect(params.port).toBe(6543);
    expect(params.user).toBe('real-user');
    expect(params.password).toBe('real-pass');
    expect(params.database).toBe('tas');
  });

  it('takes ssl from the URL alone: absent means off, even with PGSSLMODE=require planted', async () => {
    plantDecoys();

    const plain = createNodeDb(URL_OF_RECORD);
    expect(resolvedParameters(plain.$client.options).ssl).toBe(false);
    await plain.$client.end();

    const required = createNodeDb(`${URL_OF_RECORD}?sslmode=require`);
    expect(resolvedParameters(required.$client.options).ssl).toBe(true);
    await required.$client.end();
  });

  it('decodes percent-encoded credentials and defaults the port', async () => {
    const db = createNodeDb('postgresql://user%40corp:p%40ss@db.example.com/tas');
    const params = resolvedParameters(db.$client.options);
    await db.$client.end();

    expect(params.user).toBe('user@corp');
    expect(params.password).toBe('p@ss');
    expect(params.port).toBe(5432);
  });
});

describe('createAutoDb', () => {
  it('routes a non-Neon URL through the hardened node adapter', async () => {
    plantDecoys();

    const db = createAutoDb('postgresql://real:pw@iriguchi.proxy.rlwy.net:48139/railway');
    const params = resolvedParameters(db.$client.options);
    await db.$client.end();

    expect(params.host).toBe('iriguchi.proxy.rlwy.net');
    expect(params.port).toBe(48139);
    expect(params.database).toBe('railway');
  });
});
