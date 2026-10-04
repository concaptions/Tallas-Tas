import { describe, expect, it } from 'vitest';

import type { BriefListRow } from '@tas/db';

import {
  buildRoleDashboard,
  hasSpellingIssues,
  loadRoleDashboard,
  roleDashboard,
  buildOverviewMetrics,
  buildPipeline,
  overviewMetrics,
} from './dashboard-source';

describe('hasSpellingIssues', () => {
  it('is true only for real flags, not a clean pass, blank, or null', () => {
    expect(hasSpellingIssues('Inconsistent hyphenation: day-time')).toBe(true);
    expect(hasSpellingIssues('No issues found.')).toBe(false);
    expect(hasSpellingIssues('  no issues found  ')).toBe(false);
    expect(hasSpellingIssues('   ')).toBe(false);
    expect(hasSpellingIssues('')).toBe(false);
    expect(hasSpellingIssues(null)).toBe(false);
  });
});

describe('roleDashboard', () => {
  /**
   * The tile count per role, stated rather than computed: csm is TWO since action item 8 took the
   * "Angles in library" tile out, and admin is csm's two plus the spell-check tile.
   */
  const TILE_COUNT = {
    strategist: 3,
    video_editor: 3,
    designer: 3,
    csm: 2,
    media_buyer: 3,
    admin: 3,
  } as const;

  it('returns well-formed items for every role, as many as that role is defined to have', () => {
    for (const [role, expected] of Object.entries(TILE_COUNT)) {
      const d = roleDashboard(role as keyof typeof TILE_COUNT);
      expect(d.items, role).toHaveLength(expected);
      expect(d.roleLabel.length).toBeGreaterThan(0);
      for (const item of d.items) {
        expect(item.href).toMatch(/^\/app\//);
        expect(typeof item.count).toBe('number');
      }
    }
  });

  it('carries no library tile on any role — action item 8 removed it', () => {
    for (const role of Object.keys(TILE_COUNT) as (keyof typeof TILE_COUNT)[]) {
      const labels = roleDashboard(role).items.map((i) => i.label);
      expect(labels, role).not.toContain('Angles in library');
      expect(
        labels.some((label) => /angle/i.test(label)),
        role,
      ).toBe(false);
    }
  });

  it('strategist sees concepts needing briefs and QA sign-off counts', () => {
    const d = roleDashboard('strategist');
    expect(d.roleLabel).toBe('Creative Strategist');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Concepts needing briefs');
    expect(labels).toContain('Briefs needing QA sign-off');
  });

  it('editor sees briefs in production and copy pending review', () => {
    const d = roleDashboard('video_editor');
    expect(d.roleLabel).toBe('Creative Items');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Briefs in production');
    expect(labels).toContain('Copy pending review');
  });

  it('designer sees design in progress and missing design files', () => {
    const d = roleDashboard('designer');
    expect(d.roleLabel).toBe('Designer');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Design in progress');
    expect(labels).toContain('Briefs without design file');
  });

  it('csm sees briefs in progress and ready for client', () => {
    const d = roleDashboard('csm');
    expect(d.roleLabel).toBe('Client Success Manager');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Briefs in progress');
    expect(labels).toContain('Ready for client');
  });

  it('media buyer sees ads to launch and winning creatives', () => {
    const d = roleDashboard('media_buyer');
    expect(d.roleLabel).toBe('Media Buyer');
    const labels = d.items.map((i) => i.label);
    expect(labels).toContain('Ads to launch');
    expect(labels).toContain('Winning creatives');
  });

  it('admin keeps the CSM pipeline tiles and adds the spell-check-flags tile', () => {
    const admin = roleDashboard('admin');
    const csm = roleDashboard('csm');
    const adminLabels = admin.items.map((i) => i.label);
    for (const label of csm.items.map((i) => i.label)) {
      expect(adminLabels).toContain(label);
    }
    expect(adminLabels).toContain('Briefs with spell-check flags');
    expect(admin.roleLabel).toBe('Admin');
  });

  it('counts are consistent with known demo fixtures', () => {
    const mb = roleDashboard('media_buyer');
    const launchReady = mb.items.find((i) => i.label === 'Ads to launch');
    const winning = mb.items.find((i) => i.label === 'Winning creatives');
    expect(launchReady?.count).toBe(1);
    expect(winning?.count).toBe(1);
  });
});

/**
 * 2E: the Overview must count over REAL data for a real user, not the demo fixtures. `buildRoleDashboard`
 * is the pure core both paths share, so a count that moves with the data it is handed proves the tiles
 * are not hardcoded; `loadRoleDashboard` in demo mode proves the fixtures still flow when there is no db.
 */
function brief(overrides: Partial<BriefListRow>): BriefListRow {
  return {
    internalStatus: 'sent_to_video_editor',
    clientStatus: 'pending_for_approval',
    conceptId: null,
    qaStrategist: false,
    qaVideoEditor: false,
    qaDesigner: false,
    designFileUrl: null,
    performance: null,
    // The Admin set reads this column (`hasSpellingIssues`), so the stand-in has to carry it: a
    // partial fixture that leaves it undefined throws inside the builder rather than counting 0.
    spellingFeedback: null,
    ...overrides,
  } as BriefListRow;
}

describe('buildRoleDashboard counts over the data it is handed', () => {
  it('reflects the given briefs and concepts, not the fixtures', () => {
    const data = {
      briefs: [
        brief({ internalStatus: 'approved', clientStatus: 'approved' }),
        brief({ internalStatus: 'launched' }),
      ],
      concepts: [
        { id: 'c1', approvalStatus: null },
        { id: 'c2', approvalStatus: null },
        { id: 'c3', approvalStatus: null },
      ],
      copy: [{ status: 'pending_for_client_review' }, { status: 'approved' }],
      creators: [{ clientStatus: 'draft' }],
    };

    const buyer = buildRoleDashboard('media_buyer', data);
    expect(buyer.items.find((i) => i.label === 'Ads to launch')?.count).toBe(1);
    expect(buyer.items.find((i) => i.label === 'Currently live')?.count).toBe(1);

    const csm = buildRoleDashboard('csm', data);
    // Both briefs have cleared internal review, so the CSM's queue is empty and both are ready.
    expect(csm.items.find((i) => i.label === 'Briefs in progress')?.count).toBe(0);
    expect(csm.items.find((i) => i.label === 'Ready for client')?.count).toBe(2);
    // The three concepts in `data` are no longer counted anywhere on the CSM's tiles — nor on the
    // two sets built from this one: `adminItems` spreads it and `client` aliases it.
    expect(csm.items.map((i) => i.label)).not.toContain('Angles in library');
    expect(buildRoleDashboard('admin', data).items.map((i) => i.label)).not.toContain(
      'Angles in library',
    );
    expect(buildRoleDashboard('client', data).items.map((i) => i.label)).not.toContain(
      'Angles in library',
    );

    const editor = buildRoleDashboard('video_editor', data);
    expect(editor.items.find((i) => i.label === 'Copy pending review')?.count).toBe(1);
  });

  it('is empty-counted for empty data, never a fixture count', () => {
    const empty = buildRoleDashboard('admin', { briefs: [], concepts: [], copy: [], creators: [] });
    for (const item of empty.items) {
      expect(item.count).toBe(0);
    }
  });
});

describe('loadRoleDashboard', () => {
  it('is the fixtures in demo mode, matching the sync demo dashboard', async () => {
    const live = await loadRoleDashboard('admin', { demoMode: () => true });
    expect(live).toEqual(roleDashboard('admin'));
  });
});

describe('overview metric cards (TASK 6)', () => {
  const data = {
    briefs: [
      // clientStatus pinned off the pending value: the fixture default IS pending_for_approval,
      // and the awaiting_client card must count exactly the one brief the test marks.
      brief({ internalStatus: 'sent_to_video_editor', clientStatus: 'approved' }),
      brief({ internalStatus: 'sent_to_designer', clientStatus: 'approved' }),
      brief({ internalStatus: 'video_editing_in_progress', clientStatus: 'approved' }),
      brief({ internalStatus: 'static_design_in_progress', clientStatus: 'approved' }),
      brief({ internalStatus: 'ad_submitted', clientStatus: 'approved' }),
      brief({ internalStatus: 'approved', clientStatus: 'pending_for_approval' }),
    ],
    concepts: [
      { id: 'c1', approvalStatus: null },
      { id: 'c2', approvalStatus: 'pending_client' },
      { id: 'c3', approvalStatus: 'approved' },
    ],
    copy: [],
    creators: [
      { clientStatus: null },
      { clientStatus: 'pending_for_approval' },
      { clientStatus: 'draft' },
      { clientStatus: 'approved' },
    ],
  };

  it('admin sees all eight cards, counted with the domain keys', () => {
    const cards = buildOverviewMetrics('admin', data);
    expect(cards.map((c) => c.key)).toEqual([
      'concepts_pending',
      'creators_pending',
      'sent_to_video_editor',
      'sent_to_designer',
      'video_editing_in_progress',
      'static_design_in_progress',
      'ad_submitted',
      'awaiting_client',
    ]);
    expect(cards.map((c) => c.count)).toEqual([2, 3, 1, 1, 1, 1, 1, 1]);
  });

  it('brief cards click through to the table already filtered by KEY, never a label', () => {
    const cards = buildOverviewMetrics('admin', data);
    expect(cards.find((c) => c.key === 'sent_to_video_editor')?.href).toBe(
      '/app/creative-design?status=sent_to_video_editor&view=grid',
    );
    expect(cards.find((c) => c.key === 'awaiting_client')?.href).toBe(
      '/app/creative-design?client=pending_for_approval&view=grid',
    );
  });

  it('scopes the set to the role: editor gets three video cards, client only the client one', () => {
    expect(buildOverviewMetrics('video_editor', data).map((c) => c.key)).toEqual([
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
    ]);
    expect(buildOverviewMetrics('client', data).map((c) => c.key)).toEqual(['awaiting_client']);
  });

  it('renders over the demo fixtures without throwing, eight cards for admin', () => {
    expect(overviewMetrics('admin')).toHaveLength(8);
  });
});

describe('buildPipeline (TASK 6)', () => {
  it('walks the video ladder then the static-only steps, and the counts sum to the briefs', () => {
    const briefs = [
      brief({ internalStatus: 'sent_to_video_editor' }),
      brief({ internalStatus: 'sent_to_designer' }),
      brief({ internalStatus: 'launched' }),
    ];
    const steps = buildPipeline(briefs);
    expect(steps.map((s) => s.key)).toEqual([
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
      'videos_revisions',
      'revisions_submitted',
      'approved',
      'launched',
      'sent_to_designer',
      'static_design_in_progress',
      'images_revisions',
    ]);
    expect(steps.reduce((sum, s) => sum + s.count, 0)).toBe(briefs.length);
    expect(steps.find((s) => s.key === 'sent_to_designer')?.count).toBe(1);
  });
});
