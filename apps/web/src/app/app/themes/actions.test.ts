import { afterEach, describe, expect, it, vi } from 'vitest';

import * as actions from './actions';
import { createThemeAction } from './actions';

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** A connection would only ever be attempted after validation; nothing here should get that far. */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the action reached Clerk');
  }),
}));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

const filled = {
  name: 'Ideal Gift for X',
  category: 'Seasonal',
  notes: 'Name the recipient in the first three seconds so the buyer stops pricing it for herself.',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the dialog shows', async () => {
    const result = await createThemeAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses before validation: an unsaveable draft still gets the demo message, not a field error', async () => {
    const result = await createThemeAction(null, form({ name: '', category: '', notes: '' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  it('rejects an empty name with the domain validator message, before any actor or database call', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createThemeAction(null, form({ ...filled, name: '   ' }));

    if (result.ok) {
      throw new Error('an empty name was accepted');
    }
    expect(result.fieldErrors?.name).toBe('A theme needs a name.');
  });

  it('rejects a one-character name, the domain rule the dialog disables its save on', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createThemeAction(null, form({ ...filled, name: 'X' }));

    if (result.ok) {
      throw new Error('a one-character name was accepted');
    }
    expect(result.fieldErrors?.name).toBe('A theme name needs at least 2 characters.');
  });

  it('rejects a missing category', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createThemeAction(null, form({ ...filled, category: '' }));

    if (result.ok) {
      throw new Error('a theme with no category was accepted');
    }
    expect(result.fieldErrors?.category).toBe('Pick the kind of theme this is.');
  });

  it('rejects a category outside the shared vocabulary', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createThemeAction(null, form({ ...filled, category: 'production_style' }));

    if (result.ok) {
      throw new Error('a category outside the pg enum was accepted');
    }
    expect(result.fieldErrors?.category).toBe(
      'A theme is one of Framework, Production Style, Seasonal.',
    );
  });

  it('never throws to the client: a valid draft fails as a typed result when there is no database', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createThemeAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'The theme could not be saved. Try again.' });
  });
});

/**
 * The module used to export `updateThemeAction` as well, and nothing imported it: the Themes ticket
 * puts "editing or deleting an existing theme" out of scope, so the page ships no edit panel. An
 * exported Server Action is a callable endpoint whether or not a component imports it, so that left
 * a patch against the GLOBAL theme library — the one table every brand reads — reachable over the
 * network behind nothing but "there is a session", from a page that offered no way to reach it.
 *
 * Asserted on the module's own shape rather than on a call, because the failure being guarded is the
 * EXISTENCE of the export, not its behaviour. The edit ticket adds it back beside the panel that
 * calls it and the role check that guards it, and deletes this test in the same diff.
 */
describe('the write surface', () => {
  it('exports exactly the actions the page can reach', () => {
    const exported = Object.entries(actions)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name);

    expect(exported).toEqual(['createThemeAction', 'toggleThemeActiveAction']);
  });
});
