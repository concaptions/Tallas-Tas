import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, NAV_SECTIONS, activeSectionKey, pendingSections } from './nav';

describe('NAV_SECTIONS', () => {
  it('lists every product section of the PRD in order', () => {
    expect(NAV_SECTIONS.map((section) => section.label)).toEqual([
      'Overview',
      'Products',
      'Personas',
      'Angles',
      'Themes',
      'Concepts',
      'Creative Briefs',
      'Copywriting',
      'UGC Management',
      'Internal Queue',
      'Client Queue',
      'Team',
      'Interface Config',
      'Notifications',
      'Propagation',
      'Design System',
    ]);
  });

  it('groups them, leaving the first group unlabelled', () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      undefined,
      'Approvals',
      'Settings',
      'Reference',
    ]);
  });

  it('keys are unique, so the sidebar never renders a duplicate', () => {
    const keys = NAV_SECTIONS.map((section) => section.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports the sections still waiting for a page', () => {
    expect(pendingSections().every((section) => section.href === undefined)).toBe(true);
  });

  it('gives an href only to the sections that are built', () => {
    const linked = NAV_SECTIONS.filter((section) => section.href !== undefined);

    expect(linked.map((section) => [section.label, section.href])).toEqual([
      ['Overview', '/app'],
      ['Products', '/app/products'],
      ['Personas', '/app/personas'],
      ['Angles', '/app/angles'],
      ['Themes', '/app/themes'],
      ['Concepts', '/app/concepts'],
      ['Creative Briefs', '/app/briefs'],
      ['Copywriting', '/app/copywriting'],
      ['UGC Management', '/app/ugc'],
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
    ['/app/briefs', 'briefs'],
    ['/app/briefs/77777777-7777-4777-8777-000000000001', 'briefs'],
    ['/app/copywriting', 'copywriting'],
    ['/app/ugc', 'ugc'],
    ['/app/ugc/88888888-8888-4888-8888-000000000001', 'ugc'],
    ['/design-system', 'design-system'],
  ])('marks %s as %s', (pathname, key) => {
    expect(activeSectionKey(pathname)).toBe(key);
  });

  it('marks nothing on an unknown path', () => {
    expect(activeSectionKey('/sign-in')).toBeNull();
  });
});
