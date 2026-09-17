import { describe, expect, it } from 'vitest';

import { brandRoles } from '../roles';
import { DEMO_TEAM_ACTOR, canSeePropagationPage, canSeeTeamPage } from '../team/access';
import { canReviewPromotion, type PromotionReviewer } from './review';

describe('canReviewPromotion', () => {
  it('lets an agency admin review, because PRD §5 sends requests to the ADMIN dashboard', () => {
    expect(canReviewPromotion({ agencyRole: 'admin', brandRoles: [] })).toBe(true);
    expect(canReviewPromotion({ agencyRole: 'admin', brandRoles: ['csm'] })).toBe(true);
  });

  it('refuses a plain agency member', () => {
    expect(canReviewPromotion({ agencyRole: 'member', brandRoles: [] })).toBe(false);
  });

  it('refuses a CSM, who may see the roster but may not change every brand’s template', () => {
    const csm: PromotionReviewer = { agencyRole: 'member', brandRoles: ['csm'] };
    expect(canReviewPromotion(csm)).toBe(false);
    // The two guards disagree on purpose; this is the disagreement, pinned.
    expect(canSeeTeamPage(csm)).toBe(true);
  });

  it('refuses every brand role held alone, client included', () => {
    for (const role of brandRoles) {
      expect(canReviewPromotion({ agencyRole: 'member', brandRoles: [role] })).toBe(false);
      expect(canReviewPromotion({ agencyRole: null, brandRoles: [role] })).toBe(false);
    }
    expect(brandRoles).toEqual([
      'csm',
      'strategist',
      'video_editor',
      'designer',
      'media_buyer',
      'client',
    ]);
  });

  it('denies by default when the actor is missing, empty or unresolved', () => {
    expect(canReviewPromotion(null)).toBe(false);
    expect(canReviewPromotion(undefined)).toBe(false);
    expect(canReviewPromotion({})).toBe(false);
    expect(canReviewPromotion({ agencyRole: null, brandRoles: null })).toBe(false);
  });

  it('is pure: the same actor answers the same twice', () => {
    const actor: PromotionReviewer = { agencyRole: 'admin' };
    expect(canReviewPromotion(actor)).toBe(canReviewPromotion(actor));
  });
});

describe('canSeePropagationPage', () => {
  it('is the same rule as canReviewPromotion, not a second one that agrees today', () => {
    const actors: readonly (PromotionReviewer | null | undefined)[] = [
      { agencyRole: 'admin' },
      { agencyRole: 'member' },
      { agencyRole: 'member', brandRoles: ['csm'] },
      { agencyRole: null, brandRoles: ['client'] },
      {},
      null,
      undefined,
    ];
    for (const actor of actors) {
      expect(canReviewPromotion(actor)).toBe(canSeePropagationPage(actor));
    }
  });

  it('opens the page for an admin and closes it for everyone else', () => {
    expect(canSeePropagationPage({ agencyRole: 'admin' })).toBe(true);
    expect(canSeePropagationPage({ agencyRole: 'member' })).toBe(false);
  });
});

describe('demo mode', () => {
  it('stands the stub actor in for an admin, so the queue renders locally', () => {
    expect(canReviewPromotion(DEMO_TEAM_ACTOR)).toBe(true);
    expect(canSeePropagationPage(DEMO_TEAM_ACTOR)).toBe(true);
  });
});
