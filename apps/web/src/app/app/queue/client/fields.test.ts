import { describe, expect, it } from 'vitest';
import { demoBriefs } from '@tas/db';
import {
  clientQueueColumns,
  CLIENT_QUEUE_ACTIONS,
  groupByClientStatus,
  isClientTrackOpen,
  type InternalStatusKey,
} from '@tas/domain/state';

import {
  ALL_FILTER,
  CLIENT_QUEUE_CONTROLS,
  CLIENT_QUEUE_FILTER_PARAM,
  CLIENT_QUEUE_RULE_NOTE,
  clientQueueColumnView,
  clientQueueControl,
  clientQueueCountLabel,
  clientQueueFilterParam,
  clientQueueItem,
  clientStatusView,
  filteredClientQueueCountLabel,
  isOnClientQueue,
  matchesClientQueueFilter,
  mineFilterLabel,
  noMineNote,
  parseClientQueueFilter,
  sameClientQueueFilter,
  withheldNote,
  type ClientQueueSourceRow,
} from './fields';

/**
 * How the Client Queue presents what it reads (ticket `client-queue` criteria 3, 4, 5, 7 and 8).
 *
 * Every rule this page has is the domain's; what is pinned here is that this module DELEGATES rather
 * than restates. So the tests compare `isOnClientQueue` against `isClientTrackOpen` itself rather
 * than against the word "approved", and the fixtures are `demoBriefs`, so a fixture change fails
 * here instead of silently emptying a board a client reads.
 */

const ROW: ClientQueueSourceRow = {
  id: '77777777-7777-4777-8777-000000000001',
  name: 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
  internalStatus: 'approved',
  clientStatus: 'pending_for_approval',
  assignee: 'Dorian Vance',
  priority: 'Video High',
  designFileUrl: 'https://frame.example/niagara/tv1-b1-v2-master',
  inspoLinks: [],
};

describe('parseClientQueueFilter', () => {
  it('reads the one filter the board offers, however it was typed', () => {
    expect(parseClientQueueFilter('mine')).toEqual({ kind: 'mine' });
    expect(parseClientQueueFilter('  MINE  ')).toEqual({ kind: 'mine' });
    expect(parseClientQueueFilter(['mine', 'all'])).toEqual({ kind: 'mine' });
  });

  it('is total: a missing, empty or hand-edited parameter is the default board, never a throw', () => {
    for (const param of [undefined, '', '   ', 'all', '%%%', 'brand:nope', []]) {
      expect(parseClientQueueFilter(param)).toEqual(ALL_FILTER);
    }
  });

  it('round-trips, and the default writes no parameter at all', () => {
    expect(clientQueueFilterParam(ALL_FILTER)).toBeNull();
    expect(clientQueueFilterParam({ kind: 'mine' })).toBe('mine');
    expect(parseClientQueueFilter(clientQueueFilterParam({ kind: 'mine' }) ?? undefined)).toEqual({
      kind: 'mine',
    });
    expect(CLIENT_QUEUE_FILTER_PARAM).toBe('filter');
  });

  it('compares two filters without a component reaching into their parts', () => {
    expect(sameClientQueueFilter(ALL_FILTER, { kind: 'all' })).toBe(true);
    expect(sameClientQueueFilter(ALL_FILTER, { kind: 'mine' })).toBe(false);
  });
});

describe('isOnClientQueue', () => {
  it('is isClientTrackOpen and nothing else, for every internal status the fixtures carry', () => {
    for (const brief of demoBriefs) {
      const open = isClientTrackOpen(brief.internalStatus as InternalStatusKey);
      const onBoard = open && brief.clientStatus !== 'launched';

      expect(
        isOnClientQueue({
          internalStatus: brief.internalStatus,
          clientStatus: brief.clientStatus,
        }),
      ).toBe(onBoard);
    }
  });

  it('keeps a row whose internal status this build cannot place off a page the client reads', () => {
    expect(
      isOnClientQueue({
        internalStatus: 'from_a_newer_build',
        clientStatus: 'pending_for_approval',
      }),
    ).toBe(false);
  });

  it('drops a launched creative: the client owes it no further decision', () => {
    expect(isOnClientQueue({ internalStatus: 'launched', clientStatus: 'launched' })).toBe(false);
    expect(isOnClientQueue({ internalStatus: 'approved', clientStatus: 'approved' })).toBe(true);
  });
});

describe('clientQueueItem', () => {
  it('resolves the chip, the priority and the tile once, on the server', () => {
    const item = clientQueueItem(ROW, '/app/briefs/x');

    expect(item.status.label).toBe('Pending for Approval');
    expect(item.status.tone).toBe('info');
    expect(item.priority?.label).toBe('Video High');
    expect(item.thumbnail.source).toBe('design-file');
    expect(item.href).toBe('/app/briefs/x');
  });

  it('carries no chip at all for an unprioritised brief, rather than an empty pill', () => {
    expect(clientQueueItem({ ...ROW, priority: null }, '/x').priority).toBeNull();
  });

  it('places every item the loader would hand over into exactly one column', () => {
    const items = demoBriefs
      .filter((brief) =>
        isOnClientQueue({
          internalStatus: brief.internalStatus,
          clientStatus: brief.clientStatus,
        }),
      )
      .map((brief) => clientQueueItem({ ...brief, inspoLinks: brief.inspoLinks }, '/x'));

    const columns = groupByClientStatus(items);
    const placed = columns.flatMap((column) => column.rows);

    expect(placed).toHaveLength(items.length);
    expect(columns.map((column) => column.key)).toEqual(
      clientQueueColumns().map((column) => column.key),
    );
  });
});

describe('clientStatusView', () => {
  it('takes its label and tone from the domain, for every column the board has', () => {
    for (const column of clientQueueColumns()) {
      expect(clientStatusView(column.key).label).toBe(column.label);
    }
    expect(clientStatusView('approved').tone).toBe('ok');
  });

  it('renders an unknown stored status muted rather than throwing or showing a blank chip', () => {
    expect(clientStatusView('from_a_newer_build')).toEqual({
      key: 'from_a_newer_build',
      label: 'from_a_newer_build',
      tone: 'mute',
    });
  });
});

describe('clientQueueColumnView', () => {
  it('attaches a tone to every domain entry and renames nothing', () => {
    const columns = clientQueueColumns();
    const views = columns.map((entry) => clientQueueColumnView(entry));

    expect(views.map((view) => view.key)).toEqual(columns.map((column) => column.key));
    expect(views.map((view) => view.label)).toEqual(columns.map((column) => column.label));
    expect(views.map((view) => view.description)).toEqual(
      columns.map((column) => column.description),
    );
    // Pinned as values, not recomputed with chipTone: a tautology proves nothing about the tone.
    expect(views.map((view) => view.tone)).toEqual(['info', 'ok']);
  });
});

describe('matchesClientQueueFilter', () => {
  const item = clientQueueItem(ROW, '/x');

  it('keeps everything on the default filter', () => {
    expect(matchesClientQueueFilter(item, ALL_FILTER, '')).toBe(true);
  });

  it('matches Mine on the assignee name, trimmed and case-insensitively', () => {
    expect(matchesClientQueueFilter(item, { kind: 'mine' }, '  dorian vance ')).toBe(true);
    expect(matchesClientQueueFilter(item, { kind: 'mine' }, 'Imogen Bardsley')).toBe(false);
  });

  it('never widens: an unassigned creative belongs to nobody and an empty viewer owns nothing', () => {
    expect(
      matchesClientQueueFilter(
        clientQueueItem({ ...ROW, assignee: null }, '/x'),
        { kind: 'mine' },
        'Dorian Vance',
      ),
    ).toBe(false);
    expect(matchesClientQueueFilter(item, { kind: 'mine' }, '')).toBe(false);
  });
});

describe('the words the board says', () => {
  it('counts in creatives, singular at one', () => {
    expect(clientQueueCountLabel(0)).toBe('0 creatives');
    expect(clientQueueCountLabel(1)).toBe('1 creative');
    expect(clientQueueCountLabel(3)).toBe('3 creatives');
    expect(filteredClientQueueCountLabel(1, 3)).toBe('1 of 3 creatives');
  });

  it('explains why the board is short, and says nothing when nothing is withheld', () => {
    expect(withheldNote(0, 3)).toBeNull();
    expect(withheldNote(-1, 3)).toBeNull();
    expect(withheldNote(1, 7)).toContain('1 of the 7 creatives in this workspace is not here yet');
    expect(withheldNote(4, 7)).toContain('4 of the 7 creatives in this workspace are not here yet');
    expect(withheldNote(4, 7)).toContain('internal sign-off');
  });

  it('states PRD §9’s rule in words, both halves of it', () => {
    expect(CLIENT_QUEUE_RULE_NOTE).toContain('Approved');
    expect(CLIENT_QUEUE_RULE_NOTE).toContain('Launched');
  });

  it('names the viewer on Mine, and says so in words when Mine matches nothing', () => {
    expect(mineFilterLabel('Dorian Vance')).toBe('Mine · Dorian Vance');
    expect(mineFilterLabel('   ')).toBe('Mine');
    expect(noMineNote('Dorian Vance')).toContain('Dorian Vance');
    expect(noMineNote('')).toContain('assigned to you');
  });
});

describe('CLIENT_QUEUE_CONTROLS', () => {
  it('takes both labels from the domain table, never retyped here', () => {
    expect(CLIENT_QUEUE_CONTROLS.map((control) => control.label)).toEqual(
      CLIENT_QUEUE_ACTIONS.map((action) => action.label),
    );
    expect(CLIENT_QUEUE_CONTROLS.map((control) => control.key)).toEqual(
      CLIENT_QUEUE_ACTIONS.map((action) => action.key),
    );
  });

  it('gives each control the data-slot the ticket names it by', () => {
    expect(clientQueueControl('approve').slot).toBe('client-queue-approve');
    expect(clientQueueControl('request_revisions').slot).toBe('client-queue-request-revisions');
  });

  it('is total over the domain table, so a control can never be built from a missing row', () => {
    for (const action of CLIENT_QUEUE_ACTIONS) {
      expect(clientQueueControl(action.key).description).toBe(action.description);
    }
  });
});
