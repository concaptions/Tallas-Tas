import { describe, expect, it } from 'vitest';

import { roleDashboard } from './dashboard-source';

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
    expect(d.roleLabel).toBe('Video Editor');
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
