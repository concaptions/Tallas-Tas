import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPersonaAction, updatePersonaAction } from './actions';

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
  name: 'Marcus — the rotating-shift nurse',
  dayInTheLife: 'Three nights on, two days off.',
  demographic: '38, Hamilton, ICU nurse.',
  psychographic: 'Evidence first, hype never.',
  coreDesires: 'Sleep that survives a schedule he cannot change.',
  successFactors: 'Falls asleep inside twenty minutes.',
  successTransformation: 'Wakes up able to drive home safely.',
  painPoints: 'Wired at 08:00 after a night shift.',
  perceivedBarriers: 'Believes shift work simply costs you sleep.',
  problemChallenge: 'A body clock reset twice a week.',
  stageOfAwareness: 'solution_aware',
  buyingTriggers: 'A colleague on the same rota swears by it.',
  emotionalTriggers: 'Fear of a mistake on shift.',
  triggerWords: 'shift work, body clock, wired and tired',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the panel shows', async () => {
    const result = await createPersonaAction(null, form(filled));

    expect(result).toEqual({
      ok: false,
      error: 'Demo mode: connect a database to save changes.',
    });
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updatePersonaAction(null, form({ ...filled, id: 'whatever' }));

    expect(result).toEqual({
      ok: false,
      error: 'Demo mode: connect a database to save changes.',
    });
  });
});

describe('with Clerk configured', () => {
  it('rejects an empty name before any actor or database call', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createPersonaAction(null, form({ ...filled, name: '   ' }));

    if (result.ok) {
      throw new Error('an empty name was accepted');
    }
    expect(result.fieldErrors?.name).toBe('A persona needs a name.');
  });

  it('rejects an update whose id is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await updatePersonaAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'This persona could not be identified.' });
  });

  it('rejects a stage of awareness that is not one of the five stages', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await createPersonaAction(
      null,
      form({ ...filled, stageOfAwareness: 'very_aware' }),
    );

    if (result.ok) {
      throw new Error('an unknown awareness stage was accepted');
    }
    expect(result.fieldErrors?.stageOfAwareness).toBeDefined();
  });
});
