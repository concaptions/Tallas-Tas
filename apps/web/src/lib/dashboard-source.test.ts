import { describe, expect, it } from 'vitest';

import type { BriefListRow } from '@tas/db';

import { buildRoleDashboard, loadRoleDashboard, roleDashboard } from './dashboard-source';

describe('roleDashboard', () => {
  it('returns three items for every role', () => {
    const roles = [
      'strategist',
      'video_editor',
      'designer',
      'csm',
      'media_buyer',
      'admin',
    ] as const;
    for (const role of roles) {
      const d = roleDashboard(role);
      expect(d.items).toHaveLength(3);
      expect(d.roleLabel.length).toBeGreaterThan(0);
      for (const item of d.items) {
        expect(item.href).toMatch(/^\/app\//);
        expect(typeof item.count).toBe('number');
      }
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

  it('admin defaults to CSM view', () => {
    const admin = roleDashboard('admin');
    const csm = roleDashboard('csm');
    expect(admin.items.map((i) => i.label)).toEqual(csm.items.map((i) => i.label));
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
      concepts: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      copy: [{ status: 'pending_for_client_review' }, { status: 'approved' }],
    };

    const buyer = buildRoleDashboard('media_buyer', data);
    expect(buyer.items.find((i) => i.label === 'Ads to launch')?.count).toBe(1);
    expect(buyer.items.find((i) => i.label === 'Currently live')?.count).toBe(1);

    const csm = buildRoleDashboard('csm', data);
    expect(csm.items.find((i) => i.label === 'Angles in library')?.count).toBe(3);

    const editor = buildRoleDashboard('video_editor', data);
    expect(editor.items.find((i) => i.label === 'Copy pending review')?.count).toBe(1);
  });

  it('is empty-counted for empty data, never a fixture count', () => {
    const empty = buildRoleDashboard('admin', { briefs: [], concepts: [], copy: [] });
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
