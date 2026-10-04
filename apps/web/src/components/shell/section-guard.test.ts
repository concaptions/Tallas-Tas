import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NAV_SECTION_KEYS, brandRoles, canSeeNavSection, type ViewerRole } from '@tas/domain';
import { describe, expect, it } from 'vitest';

import { NAV_SECTIONS } from './nav';

/**
 * AI-65. The point of these tests is the one failure the role filter is most likely to have: a
 * section hidden from the sidebar whose ROUTE still answers. Hiding a link is not a control, so
 * every section some role is refused must either carry a `sectionGuard` segment layout or already
 * refuse that role itself — and this file reads the filesystem to check it, rather than trusting a
 * list somebody remembered to update.
 */

/** Resolved from this file, not from `process.cwd()`: vitest runs from the repo root. */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../app/app');

/**
 * The roles a SECTION guard has to discriminate between: the ones with a workspace at all.
 *
 * `client` and `member` are refused every section, which would make every section look like it
 * needs its own guard. They are refused once, higher up, by `canSeeInternalWorkspace` in the shell
 * layout — so counting them here would demand 38 guards for a decision one check already makes, and
 * hide the sections that genuinely differ between two internal roles.
 */
const ALL_ROLES: readonly ViewerRole[] = ['admin', 'member', ...brandRoles];

const WORKSPACE_ROLES: readonly ViewerRole[] = ALL_ROLES.filter((role) =>
  NAV_SECTION_KEYS.some((key) => canSeeNavSection(role, key)),
);

/**
 * Sections whose page refuses on its own, from before this item, and the guard it uses. Listed so
 * the test below can account for them WITHOUT a second guard being bolted on: two checks on one
 * page is how they come to disagree. All three are stricter than `canSeeNavSection` is for them
 * (agency admin only), so the route cannot open wider than the rail.
 */
const SELF_GUARDED: Readonly<Record<string, string>> = {
  team: 'canSeeTeamPage',
  propagation: 'canSeePropagationPage',
  'column-admin': 'canSeePropagationPage',
  'interface-config': 'canSeePropagationPage',
};

/**
 * Sections deliberately left without a segment guard of their own, and why. `design-system` is a
 * developer reference page outside `/app` entirely (`src/app/(dev)/`): it carries no brand data, no
 * client or role-scoped row, and nothing it renders comes from a brand. It is named here rather
 * than quietly skipped so that the gap is a decision on the record, not an omission.
 */
const UNGATED_BY_DESIGN: readonly string[] = ['design-system'];

/** The `/app` directory a section's href maps to, or null when the href is not under `/app`. */
function appSegmentOf(href: string | undefined): string | null {
  if (href === undefined || !href.startsWith('/app')) {
    return null;
  }
  const rest = href.slice('/app'.length).replace(/^\//u, '');
  return rest === '' ? null : rest;
}

function guardedSectionOf(segment: string): string | null {
  const file = join(APP_DIR, segment, 'layout.tsx');
  if (!existsSync(file)) {
    return null;
  }
  const source = readFileSync(file, 'utf8');
  return /sectionGuard\('([^']+)'\)/u.exec(source)?.[1] ?? null;
}

describe('section route guards', () => {
  it('every section some role is refused is closed at the route, not only in the rail', () => {
    const ungated: string[] = [];

    for (const section of NAV_SECTIONS) {
      const refusedBySomeone = WORKSPACE_ROLES.some((role) => !canSeeNavSection(role, section.key));
      if (!refusedBySomeone || UNGATED_BY_DESIGN.includes(section.key)) {
        continue;
      }
      if (section.key in SELF_GUARDED) {
        continue;
      }
      const segment = appSegmentOf(section.href);
      if (segment === null || guardedSectionOf(segment) !== section.key) {
        ungated.push(section.key);
      }
    }

    expect(ungated).toEqual([]);
  });

  it('no guard names a section that is not in the catalogue, and none guards the wrong one', () => {
    for (const section of NAV_SECTIONS) {
      const segment = appSegmentOf(section.href);
      if (segment === null) {
        continue;
      }
      const guarded = guardedSectionOf(segment);
      if (guarded === null) {
        continue;
      }
      // A layout under `/app/personas` must guard `personas`: a copy-paste that left the wrong key
      // behind would gate the section against the wrong role, which is the quiet kind of wrong.
      expect(guarded, segment).toBe(section.key);
      expect(NAV_SECTION_KEYS).toContain(guarded);
    }
  });

  it('a section every role may open carries no guard, so nothing is gated for show', () => {
    for (const section of NAV_SECTIONS) {
      if (WORKSPACE_ROLES.some((role) => !canSeeNavSection(role, section.key))) {
        continue;
      }
      const segment = appSegmentOf(section.href);
      expect(segment === null ? null : guardedSectionOf(segment), section.key).toBeNull();
    }
  });

  it('the roles with no workspace at all are refused by the shell, not by 38 guards', () => {
    // The two the section guards do not discriminate between, and the one check that stops them.
    expect(WORKSPACE_ROLES).not.toContain('client');
    expect(WORKSPACE_ROLES).not.toContain('member');
    for (const role of ['client', 'member'] as const) {
      for (const key of NAV_SECTION_KEYS) {
        expect(canSeeNavSection(role, key), `${role}/${key}`).toBe(false);
      }
    }
    // `overview` needs no guard of its own: every role that has any section has that one.
    for (const role of WORKSPACE_ROLES) {
      expect(canSeeNavSection(role, 'overview'), role).toBe(true);
    }
    expect(UNGATED_BY_DESIGN).toEqual(['design-system']);
  });
});
