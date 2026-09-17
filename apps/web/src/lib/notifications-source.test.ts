import { demoNotifications, type Db } from '@tas/db';
import { NOTIFICATION_TRIGGER_KEYS, notificationTriggerLabel } from '@tas/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadNotification, loadNotifications, withBrandScope } from './notifications-source';

/**
 * The demo-mode guarantee, proved rather than asserted: with no Clerk key and a `DATABASE_URL` set,
 * the source answers from the fixtures and the connection factory is never called. The factory is
 * injected for exactly that reason — "no client was constructed" is not observable otherwise.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadNotifications in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadNotifications({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoNotifications);
    expect(result.rows).toHaveLength(8);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadNotifications({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('hands the table PRD §12 order, so no component sorts', async () => {
    const { rows } = await loadNotifications({ connect });

    expect(rows.map((row) => row.triggerKey)).toEqual(NOTIFICATION_TRIGGER_KEYS);
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('defaults every trigger to Slack on and email off (PRD §12)', async () => {
    const { rows } = await loadNotifications({ connect });

    expect(rows.every((row) => row.slackEnabled)).toBe(true);
    expect(rows.every((row) => !row.emailEnabled)).toBe(true);
  });

  it('carries a Trigger and a Recipient cell on every row, so no literal is needed in a component', async () => {
    const { rows } = await loadNotifications({ connect });

    for (const row of rows) {
      expect(row.label ?? row.triggerKey).toBe(notificationTriggerLabel(row.triggerKey));
      expect((row.recipientLabel ?? '').trim().length).toBeGreaterThan(0);
      expect(row.recipients.length).toBeGreaterThan(0);
    }
  });

  it('finds one setting by trigger key and misses an unknown key, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoNotifications;
    if (first === undefined) {
      throw new Error('the demo notification settings are empty');
    }

    await expect(loadNotification(first.triggerKey, { connect })).resolves.toEqual({
      notification: first,
      source: 'demo',
    });
    await expect(loadNotification('nope', { connect })).resolves.toEqual({
      notification: null,
      source: 'demo',
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses a write outright', async () => {
    await expect(withBrandScope(() => Promise.resolve('written'), { connect })).rejects.toThrow(
      /Demo mode/u,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('loadNotifications in live mode', () => {
  it('opens a connection from DATABASE_URL and closes it even when the query throws', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    // A handle that fails on first use: enough to prove the `finally` closes the pool.
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;
    const openings: string[] = [];

    await expect(
      loadNotifications({
        demoMode: () => false,
        connect: (url) => {
          openings.push(url);
          return { db, close };
        },
      }),
    ).rejects.toThrow('boom');

    expect(openings).toEqual(['postgres://user:pw@example.test/db']);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

/**
 * `@tas/db` does not depend on `@tas/domain` — the edge runs the other way everywhere in this repo —
 * so neither package can assert this about the other. `apps/web` depends on both, which makes this
 * file the only place the two §12 transcriptions can be pinned equal. Without it the seeded rows and
 * the domain vocabulary are free to drift apart one label at a time.
 */
describe('demoNotifications against the domain vocabulary', () => {
  it('names the same eight triggers, in the same order, with the same labels', () => {
    expect(demoNotifications.map((row) => row.triggerKey)).toEqual(NOTIFICATION_TRIGGER_KEYS);
    expect(demoNotifications.map((row) => row.label)).toEqual(
      NOTIFICATION_TRIGGER_KEYS.map((key) => notificationTriggerLabel(key)),
    );
  });
});
