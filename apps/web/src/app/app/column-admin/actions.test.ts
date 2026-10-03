import { afterEach, describe, expect, it, vi } from 'vitest';

import { reattachColumnAction, saveColumnsAction } from './actions';

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/**
 * A session would only ever be asked for after validation, and a connection only after the role
 * check. Nothing in this file should get as far as either: `auth` throwing is the proof that a
 * payload passed validation rather than being turned away by it, without needing a database.
 */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the action reached Clerk');
  }),
}));

function form(payload: unknown): FormData {
  const data = new FormData();
  data.set('payload', typeof payload === 'string' ? payload : JSON.stringify(payload));
  return data;
}

const BASE_ID = '11111111-1111-4111-8111-000000000001';

const validColumn = {
  columnKey: 'demographic',
  displayLabel: 'Description [Age Status Salary]',
  displayOrder: 3,
  isHidden: false,
  isDetached: true,
  fieldType: 'multilineText',
  source: 'parent',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to save a column before the payload is even parsed', async () => {
    const result = await saveColumnsAction(null, form('not json at all'));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to reattach a column before the payload is even parsed', async () => {
    const result = await reattachColumnAction(null, form('not json at all'));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  function configured(): void {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  }

  it('rejects a payload that is not JSON at all', async () => {
    configured();

    const result = await saveColumnsAction(null, form('{'));

    expect(result).toMatchObject({ ok: false });
  });

  it('rejects a base id that is not a uuid, so no forged id reaches a query', async () => {
    configured();

    const result = await saveColumnsAction(
      null,
      form({ baseId: 'template', tableKey: 'personas', columns: [validColumn] }),
    );

    expect(result).toEqual({ ok: false, error: 'That base could not be identified.' });
  });

  it('rejects a table the propagation registry does not have', async () => {
    configured();

    const result = await saveColumnsAction(
      null,
      form({ baseId: BASE_ID, tableKey: 'secrets', columns: [validColumn] }),
    );

    expect(result).toEqual({ ok: false, error: 'Unknown table.' });
  });

  it('rejects a column key that is not a snake_case identifier', async () => {
    configured();

    const result = await saveColumnsAction(
      null,
      form({
        baseId: BASE_ID,
        tableKey: 'personas',
        columns: [{ ...validColumn, columnKey: 'DROP TABLE personas' }],
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Use lowercase letters, numbers and underscores.',
    });
  });

  it('rejects a submission with no columns in it', async () => {
    configured();

    const result = await saveColumnsAction(
      null,
      form({ baseId: BASE_ID, tableKey: 'personas', columns: [] }),
    );

    expect(result).toMatchObject({ ok: false });
  });

  it('accepts a real save far enough to reach the session, and never throws to the client', async () => {
    configured();

    const result = await saveColumnsAction(
      null,
      form({ baseId: BASE_ID, tableKey: 'personas', columns: [validColumn] }),
    );

    expect(result).toEqual({ ok: false, error: 'The column could not be saved. Try again.' });
  });

  it('accepts a real reattach far enough to reach the session', async () => {
    configured();

    const result = await reattachColumnAction(
      null,
      form({ baseId: BASE_ID, tableKey: 'personas', columnKey: 'demographic' }),
    );

    expect(result).toEqual({ ok: false, error: 'The column could not be reattached. Try again.' });
  });
});
