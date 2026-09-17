import { describe, expect, it } from 'vitest';

import { agencyRoles, brandRoles, type Role } from '../roles';
import { ROLE_LABELS, isRole, roleTone } from './role-labels';

const EVERY_ROLE: readonly Role[] = [...agencyRoles, ...brandRoles];

describe('ROLE_LABELS', () => {
  it('gives PRD §11 its own words for every role', () => {
    expect(ROLE_LABELS).toEqual({
      admin: 'Admin',
      member: 'Member',
      csm: 'Client Success Manager',
      strategist: 'Creative Strategist',
      video_editor: 'Video Editor',
      designer: 'Designer',
      media_buyer: 'Media Buyer',
      client: 'Client',
    });
  });

  it('covers every agency role and every brand role, and nothing else', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...EVERY_ROLE].sort());
  });

  it('labels every role with a non-empty string that is not the key', () => {
    for (const role of EVERY_ROLE) {
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
      expect(ROLE_LABELS[role]).not.toBe(role);
    }
  });
});

describe('roleTone', () => {
  it('gives the admin the accent tone', () => {
    expect(roleTone('admin')).toBe('accent');
  });

  it('tones the two client-facing owners as info', () => {
    expect(roleTone('csm')).toBe('info');
    expect(roleTone('strategist')).toBe('info');
  });

  it('mutes the production roles', () => {
    expect(roleTone('video_editor')).toBe('mute');
    expect(roleTone('designer')).toBe('mute');
  });

  it('warns on the media buyer, the only role that can put spend behind a creative', () => {
    expect(roleTone('media_buyer')).toBe('warn');
  });

  it('gives the external client role the ok tone', () => {
    expect(roleTone('client')).toBe('ok');
  });

  it('mutes member, the fallback for somebody with no brand assignment', () => {
    expect(roleTone('member')).toBe('mute');
  });

  it('returns a tone for every role in the vocabulary', () => {
    for (const role of EVERY_ROLE) {
      expect(['ok', 'warn', 'bad', 'info', 'accent', 'mute']).toContain(roleTone(role));
    }
  });

  it('falls back to mute for a role it does not recognise', () => {
    expect(roleTone('ugc_manager')).toBe('mute');
    expect(roleTone('')).toBe('mute');
  });

  it('never invents a bad tone: no role on this page is an error state', () => {
    for (const role of EVERY_ROLE) {
      expect(roleTone(role)).not.toBe('bad');
    }
  });
});

describe('isRole', () => {
  it('accepts every agency and brand role', () => {
    for (const role of EVERY_ROLE) {
      expect(isRole(role)).toBe(true);
    }
  });

  it('rejects anything else, including Object.prototype keys', () => {
    expect(isRole('ugc_manager')).toBe(false);
    expect(isRole('')).toBe(false);
    expect(isRole('toString')).toBe(false);
    expect(isRole('constructor')).toBe(false);
  });
});
