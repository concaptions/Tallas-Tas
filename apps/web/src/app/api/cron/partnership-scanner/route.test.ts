import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

/**
 * The cron route's AUTH GUARD, proved without a database. The scanner itself runs on PGlite in
 * `@tas/db`; here the only concern is that the route refuses everything without the shared secret, so
 * the public URL cannot be used to run a platform-wide job. `NODE_ENV=test` keeps `serverEnv` from
 * merging the repo-root `.env.local`, so each test controls exactly the variables it sets.
 */
function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/partnership-scanner', { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/cron/partnership-scanner', () => {
  it('is 503 when no CRON_SECRET is configured, whatever the caller sends', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CRON_SECRET', '');

    const response = await GET(request({ authorization: 'Bearer anything' }));

    expect(response.status).toBe(503);
  });

  it('is 401 for a request with the wrong bearer token', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CRON_SECRET', 'topsecret');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const response = await GET(request({ authorization: 'Bearer wrong' }));

    expect(response.status).toBe(401);
  });

  it('is 401 for a request with no Authorization header at all', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CRON_SECRET', 'topsecret');

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it('is 503 when authorised but no database is configured', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CRON_SECRET', 'topsecret');
    vi.stubEnv('DATABASE_URL', '');

    const response = await GET(request({ authorization: 'Bearer topsecret' }));

    expect(response.status).toBe(503);
  });
});
