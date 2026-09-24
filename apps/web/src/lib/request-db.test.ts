import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The wiring of the per-request connection. React only memoizes `cache` inside a real server render
 * (in Vitest it is a passthrough), so this supplies a render-scoped `cache`, captures what is handed
 * to `after`, and stubs the pool factory — and then asserts the three properties the performance fix
 * rests on: one pool per request however many loaders ask, the pool ended AFTER the response and
 * exactly once, and no loader able to end it early through `close`.
 */
const hoisted = vi.hoisted(() => ({
  end: vi.fn(() => Promise.resolve()),
  created: [] as object[],
  afterTasks: [] as (() => unknown)[],
}));

vi.mock('@tas/db', () => ({
  createAutoDb: () => {
    const db = { $client: { end: hoisted.end } };
    hoisted.created.push(db);
    return db;
  },
}));

vi.mock('next/server', () => ({
  after: (task: () => unknown) => {
    hoisted.afterTasks.push(task);
  },
}));

vi.mock('react', () => ({
  // One render's memo: the same argument returns the first call's result.
  cache: <Result>(fn: (key: string) => Result) => {
    const memo = new Map<string, Result>();
    return (key: string): Result => {
      const hit = memo.get(key);
      if (hit !== undefined) {
        return hit;
      }
      const value = fn(key);
      memo.set(key, value);
      return value;
    };
  },
}));

const URL = 'postgresql://user:pw@db.example.test:5432/tas';

beforeEach(() => {
  hoisted.end.mockClear();
  hoisted.created.length = 0;
  hoisted.afterTasks.length = 0;
  vi.resetModules();
});

describe('requestConnection', () => {
  it('hands every loader in a request the same pool, created once', async () => {
    const { requestConnection } = await import('./request-db');

    const first = requestConnection(URL);
    const second = requestConnection(URL);
    const third = requestConnection(URL);

    expect(hoisted.created).toHaveLength(1);
    expect(second.db).toBe(first.db);
    expect(third.db).toBe(first.db);
  });

  it('ends the pool after the response, exactly once, and never through a loader close', async () => {
    const { requestConnection } = await import('./request-db');

    const connection = requestConnection(URL);
    await connection.close();
    await requestConnection(URL).close();
    expect(hoisted.end).not.toHaveBeenCalled();

    expect(hoisted.afterTasks).toHaveLength(1);
    await hoisted.afterTasks[0]?.();
    expect(hoisted.end).toHaveBeenCalledTimes(1);
  });
});
