import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, NAV_SECTIONS, activeSectionKey, pendingSections } from './nav';

describe('NAV_SECTIONS', () => {
  it('lists every visible module in sidebar order (six hidden 2026-10-02, template-base alignment)', () => {
    expect(NAV_SECTIONS.map((section) => section.label)).toEqual([
      'Overview',
      'Products',
      'Collections',
      'Personas',
      'Angles',
      'Themes',
      'Concepts',
      'Creative Modules',
      'AI Characters',
      'Competitive Research',
      'Creative Design',
      'Creative Sheet',
      'UGC Management',
      'Client Assets',
      'Asset Library',
      'Upload Links',
      'Meta Copywriting',
      'Campaigns & Offers',
      'Performance',
      'Ad Spy',
      'Creator Ranking',
      'Creative Dimensions',
      'Internal Queue',
      'Client Queue',
      'Team',
      'Interface Config',
      'Notifications',
      'Propagation',
      'Onboarding Forms',
      'Add Brand',
      'Design System',
    ]);
  });

  it('groups them, leaving the first group unlabelled', () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      undefined,
      'Strategy',
      'Production',
      'Copy',
      'Campaigns',
      'Reporting',
      'Settings / Lookups',
      'Approvals',
      'Settings',
      'Reference',
    ]);
  });

  /**
   * The six modules the template base has no table for (template-base alignment, 2026-10-02).
   * They are HIDDEN, not dropped: the Postgres tables, the queries and the page folders are all
   * still there and each route `redirect`s to `/app`. Asserted by key AND by href, so
   * re-adding a section under a new label still fails here until the decision is revisited —
   * `docs/decisions/data-loss-blockers-2026-10-02.md`.
   */
  it('does not list the six hidden modules, by key or by href', () => {
    const hiddenKeys = [
      'copy-types',
      'youtube-copywriting',
      'email-campaigns',
      'email-flows',
      'creative-reporting',
      'sm-campaign-feed',
    ];
    const hiddenHrefs = hiddenKeys.map((key) => `/app/${key}`);

    for (const key of hiddenKeys) {
      expect(NAV_SECTIONS.map((section) => section.key)).not.toContain(key);
    }
    for (const href of hiddenHrefs) {
      expect(NAV_SECTIONS.map((section) => section.href)).not.toContain(href);
    }
  });

  /**
   * `creative-modules` is the seventh Drizzle content table with no table in the template base and
   * it stays VISIBLE on purpose: whether the template's "Themes" table feeds `themes` or
   * `creative_modules` is an unresolved product question (audit §5), so nothing is hidden on a guess.
   */
  it('keeps Creative Modules visible while the Themes question is open', () => {
    expect(NAV_SECTIONS.find((section) => section.key === 'creative-modules')?.href).toBe(
      '/app/creative-modules',
    );
  });

  it('keys are unique, so the sidebar never renders a duplicate', () => {
    const keys = NAV_SECTIONS.map((section) => section.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Not `every(section => section.href === undefined)`: that is true BY CONSTRUCTION —
   * `pendingSections` filters on exactly that predicate — so it passed with half the sidebar
   * unbuilt and would pass again on the day a section loses its href. Every section is built, so
   * the assertion that guards the run is that the list is EMPTY. A new section added to `nav.ts`
   * without an href fails here, which is the reminder to ship its page or accept a `SoonChip`.
   */
  it('has no section left waiting for a page', () => {
    expect(pendingSections()).toEqual([]);
  });

  it('gives an href only to the sections that are built', () => {
    const linked = NAV_SECTIONS.filter((section) => section.href !== undefined);

    expect(linked.map((section) => [section.label, section.href])).toEqual([
      ['Overview', '/app'],
      ['Products', '/app/products'],
      ['Collections', '/app/collections'],
      ['Personas', '/app/personas'],
      ['Angles', '/app/angles'],
      ['Themes', '/app/themes'],
      ['Concepts', '/app/concepts'],
      ['Creative Modules', '/app/creative-modules'],
      ['AI Characters', '/app/ai-characters'],
      ['Competitive Research', '/app/competitive-research'],
      ['Creative Design', '/app/creative-design'],
      ['Creative Sheet', '/app/creative-sheet'],
      ['UGC Management', '/app/ugc'],
      ['Client Assets', '/app/client-assets'],
      ['Asset Library', '/app/assets'],
      ['Upload Links', '/app/upload-links'],
      ['Meta Copywriting', '/app/meta-copywriting'],
      ['Campaigns & Offers', '/app/campaigns-offers'],
      ['Performance', '/app/performance'],
      ['Ad Spy', '/app/ad-spy'],
      ['Creator Ranking', '/app/creator-ranking'],
      ['Creative Dimensions', '/app/creative-dimensions'],
      ['Internal Queue', '/app/queue/internal'],
      ['Client Queue', '/app/queue/client'],
      ['Team', '/app/team'],
      ['Interface Config', '/app/interface-config'],
      ['Notifications', '/app/notifications'],
      ['Propagation', '/app/propagation'],
      ['Onboarding Forms', '/app/onboarding-forms'],
      ['Add Brand', '/app/onboard'],
      ['Design System', '/design-system'],
    ]);
  });
});

describe('activeSectionKey', () => {
  it.each([
    ['/app', 'overview'],
    ['/app/products', 'products'],
    ['/app/products/22222222-2222-4222-8222-000000000001', 'products'],
    ['/app/personas', 'personas'],
    ['/app/personas/33333333-3333-4333-8333-000000000001', 'personas'],
    ['/app/angles', 'angles'],
    ['/app/angles/55555555-5555-4555-8555-000000000001', 'angles'],
    ['/app/themes', 'themes'],
    ['/app/themes/44444444-4444-4444-8444-000000000003', 'themes'],
    ['/app/concepts', 'concepts'],
    ['/app/concepts/66666666-6666-4666-8666-000000000001', 'concepts'],
    ['/app/concepts/new', 'concepts'],
    ['/app/creative-design', 'briefs'],
    ['/app/creative-design/77777777-7777-4777-8777-000000000001', 'briefs'],
    ['/app/meta-copywriting', 'copywriting'],
    ['/app/ugc', 'ugc'],
    ['/app/ugc/88888888-8888-4888-8888-000000000001', 'ugc'],
    ['/app/assets', 'assets'],
    ['/app/performance', 'performance'],
    ['/app/ad-spy', 'ad-spy'],
    ['/app/creator-ranking', 'creator-ranking'],
    ['/app/upload-links', 'upload-links'],
    ['/app/collections', 'collections'],
    ['/app/creative-dimensions', 'creative-dimensions'],
    ['/app/ai-characters', 'ai-characters'],
    ['/app/competitive-research', 'competitive-research'],
    ['/app/campaigns-offers', 'campaigns'],
    ['/app/onboarding-forms', 'onboarding-forms'],
    ['/app/queue/internal', 'internal-queue'],
    ['/app/queue/client', 'client-queue'],
    ['/app/team', 'team'],
    ['/app/interface-config', 'interface-config'],
    ['/app/notifications', 'notifications'],
    ['/app/propagation', 'propagation'],
    ['/app/onboard', 'onboard'],
    ['/design-system', 'design-system'],
  ])('marks %s as %s', (pathname, key) => {
    expect(activeSectionKey(pathname)).toBe(key);
  });

  it('marks nothing on an unknown path', () => {
    expect(activeSectionKey('/sign-in')).toBeNull();
  });

  /**
   * A hidden module's route still exists — it `redirect`s to `/app` — but no section owns
   * it any more, so the longest matching href is Overview's `/app`. The sidebar therefore
   * highlights Overview on the way through, which is exactly where the redirect lands, instead of
   * lighting a stale entry for a module that is no longer listed.
   */
  it.each([
    '/app/copy-types',
    '/app/youtube-copywriting',
    '/app/email-campaigns',
    '/app/email-flows',
    '/app/creative-reporting',
    '/app/sm-campaign-feed',
  ])('falls back to Overview on the hidden route %s', (pathname) => {
    expect(activeSectionKey(pathname)).toBe('overview');
  });
});
