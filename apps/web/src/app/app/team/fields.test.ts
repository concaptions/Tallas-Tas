import { DEMO_TEAM_DUAL_ROLE_NAME, demoTeam, type TeamListRow } from '@tas/db';
import { describe, expect, it } from 'vitest';

import {
  ALL_BRANDS_LABEL,
  NO_BRANDS_LABEL,
  TEAM_ACCESS_ENFORCEMENT_NOTE,
  TEAM_ACCESS_NOTE,
  TEAM_COLUMNS,
  brandsCell,
  isExternalMember,
  roleChips,
  searchText,
  teamCountLabel,
  toTeamItem,
} from './fields';

const NOW = new Date('2026-09-17T12:00:00.000Z');

function member(fullName: string): TeamListRow {
  const found = demoTeam.find((row) => row.fullName === fullName);
  if (found === undefined) {
    throw new Error(`no fixture named ${fullName}`);
  }
  return found;
}

const admin = member('Marguerite Alaoui');
const strategist = member('Dorian Vance');
const dualRole = member(DEMO_TEAM_DUAL_ROLE_NAME);

describe('TEAM_COLUMNS', () => {
  it('is the four columns of the ticket, in order', () => {
    expect(TEAM_COLUMNS).toEqual(['Name', 'Role', 'Brands', 'Last active']);
  });
});

describe('roleChips', () => {
  it('labels and tones each role from the domain, never from a literal', () => {
    expect(roleChips(admin.roles)).toEqual([{ role: 'admin', label: 'Admin', tone: 'accent' }]);
  });

  it('gives a two-hat row one chip per role, in vocabulary order', () => {
    expect(roleChips(dualRole.roles).map((chip) => chip.label)).toEqual([
      'Client Success Manager',
      'Media Buyer',
    ]);
    expect(roleChips(dualRole.roles).map((chip) => chip.tone)).toEqual(['info', 'warn']);
  });
});

describe('brandsCell', () => {
  it('reads All brands for an admin, who holds no assignments at all', () => {
    expect(admin.brandNames).toEqual([]);
    expect(brandsCell(admin)).toEqual({ text: ALL_BRANDS_LABEL, muted: false });
  });

  it('reads No brands, muted, for anybody else with an empty list', () => {
    const unassigned: TeamListRow = {
      ...strategist,
      roles: ['member'],
      role: 'member',
      brandNames: [],
    };

    expect(brandsCell(unassigned)).toEqual({ text: NO_BRANDS_LABEL, muted: true });
  });

  it('joins the names the query already sorted, without re-sorting them', () => {
    expect(brandsCell(dualRole).text).toBe(dualRole.brandNames.join(', '));
    expect(brandsCell(dualRole).text).toContain('Funky Painting, Gratsi');
  });

  it('never returns an empty cell for any fixture row', () => {
    for (const row of demoTeam) {
      expect(brandsCell(row).text.length).toBeGreaterThan(0);
    }
  });
});

describe('isExternalMember', () => {
  it('is false for every fixture row: the roster is internal staff', () => {
    expect(demoTeam.some(isExternalMember)).toBe(false);
  });

  it('is true for a client, whose access is the client interface only', () => {
    const client: TeamListRow = { ...strategist, roles: ['client'], role: 'client' };

    expect(isExternalMember(client)).toBe(true);
  });
});

describe('searchText', () => {
  it('covers the name, the email, the role label and the role key', () => {
    const text = searchText(dualRole);

    expect(text).toContain('callum ashworth');
    expect(text).toContain(dualRole.email.toLowerCase());
    expect(text).toContain('client success manager');
    expect(text).toContain('media_buyer');
  });

  it('matches a role query across exactly the rows that hold it', () => {
    const matching = demoTeam.filter((row) => searchText(row).includes('designer'));

    expect(matching.map((row) => row.fullName)).toEqual(['Rhiannon Okafor']);
  });
});

describe('toTeamItem', () => {
  it('resolves every cell of a row against one now', () => {
    const item = toTeamItem(admin, NOW);

    expect(item.fullName).toBe('Marguerite Alaoui');
    expect(item.brands.text).toBe(ALL_BRANDS_LABEL);
    expect(item.lastActive).toBe('3 hours ago');
    expect(item.lastActiveTitle).toBe('2026-09-17 08:41');
    expect(item.neverActive).toBe(false);
    expect(item.external).toBe(false);
  });

  it('reads Never, with no title, for somebody who has never signed in', () => {
    const invited: TeamListRow = { ...strategist, lastActiveAt: null };
    const item = toTeamItem(invited, NOW);

    expect(item.lastActive).toBe('Never');
    expect(item.lastActiveTitle).toBeNull();
    expect(item.neverActive).toBe(true);
  });

  it('gives every fixture row a non-empty last-active phrase', () => {
    for (const item of demoTeam.map((row) => toTeamItem(row, NOW))) {
      expect(item.lastActive.length).toBeGreaterThan(0);
    }
  });
});

describe('teamCountLabel', () => {
  it('counts people, and says "of" only while the filter narrows', () => {
    expect(teamCountLabel(5, 5)).toBe('5 people');
    expect(teamCountLabel(2, 5)).toBe('2 of 5 people');
    expect(teamCountLabel(1, 1)).toBe('1 person');
    expect(teamCountLabel(0, 5)).toBe('0 of 5 people');
  });
});

describe('the access note', () => {
  it('names the two roles the guard admits, from the domain', () => {
    expect(TEAM_ACCESS_NOTE).toBe('Admin and Client Success Managers only.');
  });

  it('says the rule is enforced on the server, not by hiding the link', () => {
    expect(TEAM_ACCESS_ENFORCEMENT_NOTE).toContain('canSeeTeamPage');
    expect(TEAM_ACCESS_ENFORCEMENT_NOTE).toContain('not by hiding the sidebar link');
  });
});
