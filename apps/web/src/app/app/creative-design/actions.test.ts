import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBriefAction, startBriefAction, toggleQaAction, updateBriefAction } from './actions';

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/**
 * Clerk is the first thing past validation, so a test that reaches it has proved the action got
 * further than it should have. Nothing in this file should ever get that far: the demo refusals
 * return before any validation, and every validation case below fails before the actor lookup.
 */
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

/** A complete, legal submission: the linked video brief the first fixture describes. */
const filled = {
  conceptId: '55555555-5555-4555-8555-000000000001',
  funnel: 'TOF',
  type: 'Video',
  version: '2',
  batch: 'B1',
  product: '',
  priority: 'Video High',
  assignee: 'Dorian Vance',
  briefToDesign: 'Cut the V2 from the 14 September rushes.',
  scriptContent: 'NURSE: Six years of nights.',
  elementsTested: 'Naming the rota as the broken thing.',
  internalStatus: 'sent_to_video_editor',
  clientStatus: 'pending_for_approval',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, with the message the page shows', async () => {
    const result = await createBriefAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateBriefAction(null, form({ ...filled, id: 'whatever' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to Start a brief, before it even looks at the id', async () => {
    const result = await startBriefAction('whatever');

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses a QA tick, before it even looks at the check', async () => {
    const result = await toggleQaAction(
      null,
      form({ id: 'whatever', check: 'qaDesigner', checked: 'true' }),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses a submission that is complete nonsense, still without throwing', async () => {
    await expect(createBriefAction(null, new FormData())).resolves.toEqual({
      ok: false,
      error: 'Sign in required to save changes.',
    });
  });
});

describe('with Clerk configured', () => {
  /** Every case below must fail in validation — before the actor lookup the mock above poisons. */
  function configured(): void {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  }

  it('rejects a type that is not one of the four', async () => {
    configured();

    const result = await createBriefAction(null, form({ ...filled, type: 'Reel' }));

    if (result.ok) {
      throw new Error('an unknown creative type was accepted');
    }
    expect(result.fieldErrors?.type).toBe('That is not one of the four creative types.');
  });

  it('rejects a funnel that is not one of the three', async () => {
    configured();

    const result = await createBriefAction(null, form({ ...filled, funnel: 'BOF' }));

    if (result.ok) {
      throw new Error('an unknown funnel was accepted');
    }
    expect(result.fieldErrors?.funnel).toBe('That is not one of the three funnels.');
  });

  it('rejects a version the dropdown does not offer, rather than clamping it', async () => {
    configured();

    const result = await createBriefAction(null, form({ ...filled, version: '7' }));

    if (result.ok) {
      throw new Error('a version outside V1…V6 was accepted');
    }
    expect(result.fieldErrors?.version).toBe('That is not a version the dropdown offers.');
  });

  it('rejects a priority outside the four the PRD names', async () => {
    configured();

    const result = await createBriefAction(null, form({ ...filled, priority: 'Urgent' }));

    if (result.ok) {
      throw new Error('an unknown priority was accepted');
    }
    expect(result.fieldErrors?.priority).toBe('That is not one of the four priorities.');
  });

  it('rejects a performance grade outside the three the schema names', async () => {
    configured();

    const result = await createBriefAction(null, form({ ...filled, performance: 'Breakeven' }));

    if (result.ok) {
      throw new Error('an unknown performance grade was accepted');
    }
    expect(result.fieldErrors?.performance).toBe(
      'That is not one of the three performance grades.',
    );
  });

  /**
   * The two legal shapes of the Performance field — empty ("not graded yet", stored as NULL) and
   * absent ("leave it where it is", the board's drag) — must both get PAST validation. The only way
   * to produce this exact message is to reach the `try` block, where the poisoned Clerk mock throws:
   * so this message is the proof that neither shape was refused, and no `fieldErrors` were raised.
   */
  it.each([
    ['empty', { ...filled, performance: '' }],
    ['absent', filled],
  ])('accepts a %s performance grade, so it reaches the actor lookup', async (_shape, values) => {
    configured();

    const result = await createBriefAction(null, form(values));

    expect(result).toEqual({ ok: false, error: 'The brief could not be saved. Try again.' });
  });

  /**
   * The detail page withholds the `performance` key while an unmapped stored grade (an Airtable
   * choice the importer wrote verbatim) is still the choice, so the UPDATE path too must read
   * "absent" as "leave it" rather than refuse the save — and must still refuse the unmapped value
   * itself when a form does submit it, which is why the page withholds it in the first place.
   */
  it('accepts an update that carries no performance key, so a legacy grade is left alone', async () => {
    configured();

    const result = await updateBriefAction(null, form({ ...filled, id: 'a-brief' }));

    expect(result).toEqual({ ok: false, error: 'The brief could not be saved. Try again.' });
  });

  it('still refuses an update that submits an unmapped grade verbatim', async () => {
    configured();

    const result = await updateBriefAction(
      null,
      form({ ...filled, id: 'a-brief', performance: 'Winning (ROAS/CPA Goal)' }),
    );

    if (result.ok) {
      throw new Error('an unmapped performance grade was accepted on update');
    }
    expect(result.fieldErrors?.performance).toBe(
      'That is not one of the three performance grades.',
    );
  });

  it('rejects a delivery ratio outside the §8 vocabulary', async () => {
    configured();
    const data = form(filled);
    data.append('dimensions', '1:1');
    data.append('dimensions', '21:9');

    const result = await createBriefAction(null, data);

    if (result.ok) {
      throw new Error('an unknown delivery ratio was accepted');
    }
    expect(result.fieldErrors?.dimensions).toBe('That is not one of the delivery ratios.');
  });

  /**
   * The Dimensions dropdown bug-fix (Oct 2026 sprint, Agent 3): the detail page now writes the
   * `dimensions` hidden inputs from React state driven by a `DropdownMenuCheckboxItem` checklist,
   * so a save carries whichever ratios the user has ticked rather than the stored array verbatim.
   * This test proves that a single-ratio submission (one legal ratio ticked, two unticked) passes
   * validation — the only way to reach the "could not be saved" message is to reach the Clerk
   * mock's throw, which is downstream of `briefSchema`. If the Dimensions wiring regresses to a
   * schema that cannot accept a shortened array, this test fails with a fieldError on `dimensions`.
   */
  it('accepts an update that ticks only one ratio, so the dropdown-edited array is saveable', async () => {
    configured();
    const data = form({ ...filled, id: 'a-brief' });
    data.append('dimensions', '1:1');

    const result = await updateBriefAction(null, data);

    expect(result).toEqual({ ok: false, error: 'The brief could not be saved. Try again.' });
  });

  /**
   * THE Oct 2026 Dimensions bug, reproduced before it was fixed. An Airtable-imported brief carries
   * the NAMES of the `(Internal) Creative Dimensions` records it linked to (`'IG Story / Reel'`),
   * not the §8 keys; the board and the detail page re-post the stored array verbatim on every save
   * and every Kanban move, so a schema that accepts only the keys refused the WHOLE update of every
   * imported brief — "the values show but the select does not fire". Reaching the poisoned Clerk
   * mock's message is the proof the legacy name got past validation.
   */
  it('accepts an update that re-posts an imported legacy dimension name, so an imported brief can be saved', async () => {
    configured();
    const data = form({ ...filled, id: 'a-brief' });
    data.append('dimensions', 'IG Story / Reel');
    data.append('dimensions', '1:1');

    const result = await updateBriefAction(null, data);

    expect(result).toEqual({ ok: false, error: 'The brief could not be saved. Try again.' });
  });

  it('still refuses a dimension that is not a placement at all: the empty string', async () => {
    configured();
    const data = form({ ...filled, id: 'a-brief' });
    data.append('dimensions', '   ');

    const result = await updateBriefAction(null, data);

    if (result.ok) {
      throw new Error('a blank delivery ratio was accepted');
    }
    expect(result.fieldErrors?.dimensions).toBe('That is not one of the delivery ratios.');
  });

  it('refuses a client move while the internal track is not Approved', async () => {
    configured();

    const result = await createBriefAction(
      null,
      form({ ...filled, internalStatus: 'ad_submitted', clientStatus: 'approved' }),
    );

    if (result.ok) {
      throw new Error('the client track opened before internal sign-off');
    }
    expect(result.fieldErrors?.clientStatus).toBe(
      'The client track opens once internal status reaches Approved.',
    );
  });

  it('refuses a video-track status on a brief graded on the static ladder', async () => {
    configured();

    const result = await createBriefAction(
      null,
      form({ ...filled, type: 'Carousel', internalStatus: 'video_editing_in_progress' }),
    );

    if (result.ok) {
      throw new Error('a video-track status was accepted on a carousel');
    }
    expect(result.fieldErrors?.internalStatus).toBe(
      'That is not a status on this brief internal track.',
    );
  });

  it('rejects an update whose id is missing', async () => {
    configured();

    const result = await updateBriefAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'This brief could not be identified.' });
  });

  it('rejects a QA tick naming a column that is not one of the three checks', async () => {
    configured();

    const result = await toggleQaAction(
      null,
      form({ id: 'a-brief', check: 'qaMediaBuyer', checked: 'true' }),
    );

    if (result.ok) {
      throw new Error('an unknown QA column was accepted');
    }
    expect(result.fieldErrors?.qa).toBe('That is not one of the three QA checks.');
  });

  it('rejects a QA tick whose new state is not submitted', async () => {
    configured();

    const result = await toggleQaAction(null, form({ id: 'a-brief', check: 'qaDesigner' }));

    if (result.ok) {
      throw new Error('a QA tick with no state was accepted');
    }
    expect(result.fieldErrors?.qa).toBe('That is not one of the three QA checks.');
  });
});
