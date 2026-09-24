import { describe, expect, it } from 'vitest';

import { NO_ACTIVE_ORGANIZATION_MESSAGE, needsOrganization } from './organization';

describe('needsOrganization', () => {
  it('recognises the action’s own refusal, so the wizard can offer the picker', () => {
    expect(needsOrganization([{ message: NO_ACTIVE_ORGANIZATION_MESSAGE }])).toBe(true);
  });

  it('finds it alongside other errors rather than only as the sole error', () => {
    expect(
      needsOrganization([
        { message: 'Name is required.' },
        { message: NO_ACTIVE_ORGANIZATION_MESSAGE },
      ]),
    ).toBe(true);
  });

  it('is false for every other refusal, including the one that reads almost the same', () => {
    expect(needsOrganization([])).toBe(false);
    expect(needsOrganization([{ message: 'Agency not found for this organization.' }])).toBe(false);
    expect(needsOrganization([{ message: 'No organization found.' }])).toBe(false);
  });

  /**
   * The wizard matches on this string. If someone edits the copy in `organization.ts` the predicate
   * follows automatically, but if someone re-types the literal back into `actions.ts` the match
   * breaks silently and the picker stops appearing — which is the bug this whole module prevents.
   */
  it('names an organization and tells the reader what to do about it', () => {
    expect(NO_ACTIVE_ORGANIZATION_MESSAGE).toMatch(/organization/i);
    expect(NO_ACTIVE_ORGANIZATION_MESSAGE).toMatch(/choose/i);
  });
});
