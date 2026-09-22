import { internalQueueColumns } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import {
  ALL_VIEW,
  assignedToViewer,
  brandViewLabel,
  filteredQueueCountLabel,
  matchesQueueView,
  mineViewLabel,
  noBrandNote,
  noMineNote,
  parseQueueView,
  queueColumnView,
  queueCountLabel,
  queueItem,
  queueViewParam,
  sameQueueView,
  type QueueSourceRow,
} from './fields';

const ROW: QueueSourceRow = {
  id: '77777777-7777-4777-8777-000000000001',
  name: 'TAS-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
  internalStatus: 'approved',
  brandId: '11111111-1111-4111-8111-000000000002',
  assignee: 'Dorian Vance',
  priority: 'Video High',
  designFileUrl: 'https://frame.example/niagara/tv1-b1-v2-master',
  inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
};

function rowWith(patch: Partial<QueueSourceRow>): QueueSourceRow {
  return { ...ROW, ...patch };
}

describe('parseQueueView', () => {
  it('reads the three views the board offers', () => {
    expect(parseQueueView('mine')).toEqual({ kind: 'mine' });
    expect(parseQueueView('brand:11111111-1111-4111-8111-000000000002')).toEqual({
      kind: 'brand',
      brandId: '11111111-1111-4111-8111-000000000002',
    });
    expect(parseQueueView('all')).toEqual(ALL_VIEW);
  });

  it('falls back to the whole board for anything it does not recognise, and never throws', () => {
    for (const param of [
      undefined,
      '',
      '   ',
      'All',
      'everything',
      'brand:',
      'brand:   ',
      'mine=true',
      '?view=mine',
      '../../etc/passwd',
      'brand',
      '%%%',
    ]) {
      expect(parseQueueView(param)).toEqual(ALL_VIEW);
    }
  });

  it('is case-insensitive on the words but never on the brand id', () => {
    expect(parseQueueView('MINE')).toEqual({ kind: 'mine' });
    expect(parseQueueView('  Mine  ')).toEqual({ kind: 'mine' });
    // The id is a uuid the row carries, so lowercasing it would silently match nothing.
    expect(parseQueueView('Brand:AB-CD')).toEqual({ kind: 'brand', brandId: 'AB-CD' });
  });

  it('takes the first value when Next.js hands it a repeated parameter', () => {
    expect(parseQueueView(['mine', 'all'])).toEqual({ kind: 'mine' });
    expect(parseQueueView([])).toEqual(ALL_VIEW);
  });

  it('round-trips through the parameter it writes, and writes nothing for the default', () => {
    expect(queueViewParam(ALL_VIEW)).toBeNull();
    for (const param of ['mine', 'brand:11111111-1111-4111-8111-000000000002']) {
      expect(queueViewParam(parseQueueView(param))).toBe(param);
    }
  });

  it('compares two views by what they mean, not by identity', () => {
    expect(sameQueueView(parseQueueView('mine'), { kind: 'mine' })).toBe(true);
    expect(sameQueueView(parseQueueView('brand:a'), { kind: 'brand', brandId: 'a' })).toBe(true);
    expect(sameQueueView(parseQueueView('brand:a'), { kind: 'brand', brandId: 'b' })).toBe(false);
    expect(sameQueueView(ALL_VIEW, { kind: 'mine' })).toBe(false);
  });
});

describe('assignedToViewer', () => {
  it('matches the same person however either side was typed', () => {
    expect(assignedToViewer('Dorian Vance', 'Dorian Vance')).toBe(true);
    expect(assignedToViewer('  dorian vance ', 'DORIAN VANCE')).toBe(true);
  });

  it('never matches a different person', () => {
    expect(assignedToViewer('Dorian Vance', 'Rhiannon Okafor')).toBe(false);
    expect(assignedToViewer('Dorian', 'Dorian Vance')).toBe(false);
  });

  it('owns nothing when either side is missing, rather than widening to everything', () => {
    expect(assignedToViewer(null, 'Dorian Vance')).toBe(false);
    expect(assignedToViewer('   ', 'Dorian Vance')).toBe(false);
    expect(assignedToViewer(undefined, 'Dorian Vance')).toBe(false);
    expect(assignedToViewer('Dorian Vance', '')).toBe(false);
    expect(assignedToViewer(null, '')).toBe(false);
  });
});

describe('queueItem', () => {
  it('resolves the priority chip through the Creative Briefs view, never a local mapping', () => {
    expect(queueItem(ROW, '/app/briefs/x').priority).toEqual({
      label: 'Video High',
      tone: 'warn',
      sla: '24h',
    });
  });

  it('shows no chip at all for a brief nobody has prioritised', () => {
    expect(queueItem(rowWith({ priority: null }), '/app/briefs/x').priority).toBeNull();
  });

  it('prefers the design file for the tile and degrades to the name with no links at all', () => {
    expect(queueItem(ROW, '/app/briefs/x').thumbnail).toMatchObject({
      source: 'design-file',
      label: 'frame.example',
    });
    expect(queueItem(rowWith({ designFileUrl: null }), '/app/briefs/x').thumbnail).toMatchObject({
      source: 'inspiration',
      label: 'YouTube',
    });
    expect(
      queueItem(rowWith({ designFileUrl: 'not a url', inspoLinks: [] }), '/app/briefs/x').thumbnail,
    ).toMatchObject({ source: 'name', label: 'TAS', provider: null, url: null });
  });

  it('carries the stored status through untouched, so grouping stays the domain’s job', () => {
    expect(queueItem(rowWith({ internalStatus: 'images_revisions' }), '/x').internalStatus).toBe(
      'images_revisions',
    );
  });
});

describe('matchesQueueView', () => {
  const mine = queueItem(ROW, '/app/briefs/1');
  const theirs = queueItem(rowWith({ id: '2', assignee: 'Imogen Bardsley' }), '/app/briefs/2');
  const otherBrand = queueItem(rowWith({ id: '3', brandId: 'other-brand' }), '/app/briefs/3');

  it('keeps every card on the default board', () => {
    for (const item of [mine, theirs, otherBrand]) {
      expect(matchesQueueView(item, ALL_VIEW, 'Dorian Vance')).toBe(true);
    }
  });

  it('narrows "mine" to the viewer’s own cards', () => {
    expect(matchesQueueView(mine, { kind: 'mine' }, 'Dorian Vance')).toBe(true);
    expect(matchesQueueView(theirs, { kind: 'mine' }, 'Dorian Vance')).toBe(false);
  });

  it('narrows a brand view to that brand id exactly', () => {
    const view = { kind: 'brand', brandId: ROW.brandId } as const;

    expect(matchesQueueView(mine, view, 'Dorian Vance')).toBe(true);
    expect(matchesQueueView(otherBrand, view, 'Dorian Vance')).toBe(false);
  });
});

describe('queueColumnView', () => {
  it('keeps the domain’s own label and description, and adds only the tone', () => {
    const columns = internalQueueColumns().map(queueColumnView);

    expect(columns.map((column) => column.label)).toEqual(
      internalQueueColumns().map((entry) => entry.label),
    );
    expect(columns.find((column) => column.key === 'approved')?.tone).toBe('ok');
    expect(columns.find((column) => column.key === 'launched')?.tone).toBe('accent');
    expect(columns.find((column) => column.key === 'images_revisions')?.tone).toBe('warn');
    expect(columns.every((column) => column.description !== '')).toBe(true);
  });
});

describe('the board’s own copy', () => {
  it('counts in the singular at one', () => {
    expect(queueCountLabel(0)).toBe('0 briefs');
    expect(queueCountLabel(1)).toBe('1 brief');
    expect(queueCountLabel(6)).toBe('6 briefs');
    expect(filteredQueueCountLabel(2, 6)).toBe('2 of 6 briefs');
  });

  it('names the viewer in the "Mine" option and in its empty state, so nothing is implied', () => {
    expect(mineViewLabel('Dorian Vance')).toContain('Dorian Vance');
    expect(noMineNote('Dorian Vance')).toContain('Dorian Vance');
    expect(mineViewLabel('  ')).toBe('Mine');
    expect(noMineNote('')).toContain('you');
  });

  it('puts the count behind a brand option, so no option is offered with nothing behind it', () => {
    expect(brandViewLabel({ id: 'b', name: 'Niagara Sleep Solutions', count: 6 })).toBe(
      'Niagara Sleep Solutions · 6',
    );
    expect(noBrandNote('Niagara Sleep Solutions')).toContain('Niagara Sleep Solutions');
  });
});
