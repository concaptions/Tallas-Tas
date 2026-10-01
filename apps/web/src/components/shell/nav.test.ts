import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, NAV_SECTIONS, activeSectionKey, pendingSections } from './nav';

describe('NAV_SECTIONS', () => {
  it('lists every module in sidebar order (regrouped 2026-10-01 for Airtable parity)', () => {
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
      'YouTube Copywriting',
      'Campaigns & Offers',
      'Email Campaigns',
      'Email Flows',
      'SM Campaign Feed',
      'Performance',
      'Creative Reporting',
      'Ad Spy',
      'Creator Ranking',
      'Copy Types',
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
      ['YouTube Copywriting', '/app/youtube-copywriting'],
      ['Campaigns & Offers', '/app/campaigns-offers'],
      ['Email Campaigns', '/app/email-campaigns'],
      ['Email Flows', '/app/email-flows'],
      ['SM Campaign Feed', '/app/sm-campaign-feed'],
      ['Performance', '/app/performance'],
      ['Creative Reporting', '/app/creative-reporting'],
      ['Ad Spy', '/app/ad-spy'],
      ['Creator Ranking', '/app/creator-ranking'],
      ['Copy Types', '/app/copy-types'],
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
    ['/app/youtube-copywriting', 'youtube-copywriting'],
    ['/app/email-campaigns', 'email-campaigns'],
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
});
