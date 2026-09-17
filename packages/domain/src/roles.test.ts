import { describe, expect, it } from 'vitest';

import {
  AGENCY_ROLE_LABELS,
  BRAND_ROLE_LABELS,
  agencyRoles,
  brandRoles,
  brandStatuses,
  internalBrandRoles,
  isInternalBrandRole,
  roleLabel,
} from './roles';

describe('roles', () => {
  it('lists the agency roles', () => {
    expect(agencyRoles).toEqual(['admin', 'member']);
  });

  it('lists the brand roles', () => {
    expect(brandRoles).toEqual([
      'csm',
      'strategist',
      'video_editor',
      'designer',
      'media_buyer',
      'client',
    ]);
  });

  it('derives internalBrandRoles as the brand roles minus client', () => {
    expect(internalBrandRoles).toEqual([
      'csm',
      'strategist',
      'video_editor',
      'designer',
      'media_buyer',
    ]);
    expect(internalBrandRoles).toHaveLength(brandRoles.length - 1);
    expect(internalBrandRoles as readonly string[]).not.toContain('client');
  });

  it('answers isInternalBrandRole for every brand role', () => {
    for (const role of brandRoles) {
      expect(isInternalBrandRole(role)).toBe(role !== 'client');
    }
  });

  it('lists the brand statuses', () => {
    expect(brandStatuses).toEqual(['active', 'paused', 'archived']);
  });
});

describe('role labels', () => {
  it('labels both agency roles', () => {
    expect(AGENCY_ROLE_LABELS).toEqual({ admin: 'Admin', member: 'Member' });
  });

  it('labels every brand role in PRD §11 words', () => {
    expect(BRAND_ROLE_LABELS).toEqual({
      csm: 'Client Success Manager',
      strategist: 'Creative Strategist',
      video_editor: 'Video Editor',
      designer: 'Designer',
      media_buyer: 'Media Buyer',
      client: 'Client',
    });
  });

  it('keys each map on exactly its own tuple', () => {
    expect(Object.keys(AGENCY_ROLE_LABELS).sort()).toEqual([...agencyRoles].sort());
    expect(Object.keys(BRAND_ROLE_LABELS).sort()).toEqual([...brandRoles].sort());
  });

  it('roleLabel answers for every agency role', () => {
    for (const role of agencyRoles) {
      expect(roleLabel(role)).toBe(AGENCY_ROLE_LABELS[role]);
    }
  });

  it('roleLabel answers for every brand role', () => {
    for (const role of brandRoles) {
      expect(roleLabel(role)).toBe(BRAND_ROLE_LABELS[role]);
    }
  });

  it('roleLabel spells out the two abbreviated roles', () => {
    expect(roleLabel('csm')).toBe('Client Success Manager');
    expect(roleLabel('strategist')).toBe('Creative Strategist');
  });

  it('roleLabel echoes an unknown key back rather than throwing in a render', () => {
    expect(roleLabel('ugc_manager')).toBe('ugc_manager');
    expect(roleLabel('')).toBe('');
    expect(roleLabel('toString')).toBe('toString');
  });
});
