import { describe, expect, it } from 'vitest';

import { NAV_SECTIONS, activeSectionKey } from './nav';

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
      'Client Interface',
      'Design System',
      'Admin',
    ]);
  });

  it('gives an href only to the sections that are built', () => {
    const linked = NAV_SECTIONS.filter((section) => section.href !== undefined);

    expect(linked.map((section) => [section.label, section.href])).toEqual([
      ['Overview', '/app'],
      ['Personas', '/app/personas'],
      ['Design System', '/design-system'],
    ]);
  });
});

describe('activeSectionKey', () => {
  it.each([
    ['/app', 'overview'],
    ['/app/personas', 'personas'],
    ['/app/personas/33333333-3333-4333-8333-000000000001', 'personas'],
    ['/design-system', 'design-system'],
  ])('marks %s as %s', (pathname, key) => {
    expect(activeSectionKey(pathname)).toBe(key);
  });

  it('marks nothing on an unknown path', () => {
    expect(activeSectionKey('/sign-in')).toBeNull();
  });
});
