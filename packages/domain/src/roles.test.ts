import { describe, expect, it } from 'vitest';

import {
  agencyRoles,
  brandRoles,
  brandStatuses,
  internalBrandRoles,
  isInternalBrandRole,
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
