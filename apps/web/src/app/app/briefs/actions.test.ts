import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBriefAction, toggleQaAction, updateBriefAction } from './actions';

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
