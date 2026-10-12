import { describe, expect, it } from 'vitest';

import {
  CLIENT_GATE_SHUT,
  NOT_NEXT_CLIENT,
  NOT_NEXT_INTERNAL,
  currentPosition,
  statusPatch,
  statusRefusal,
} from './status-guard';

const NONE = { qaVideoEditor: false, qaDesigner: false, qaStrategist: false };
const VIDEO_DONE = { qaVideoEditor: true, qaDesigner: false, qaStrategist: true };

function at(internalStatus: string, clientStatus = 'pending_for_approval', ticks = NONE) {
  return currentPosition({ type: 'Video', internalStatus, clientStatus, ...ticks });
}

describe('currentPosition', () => {
  it('narrows a stored status outside INTERNAL_STATUS to the entry state (draft), and reads the ticks', () => {
    expect(at('nonsense', 'nonsense')).toEqual({
      track: 'video',
      internal: 'draft',
      client: 'pending_for_approval',
      ticks: NONE,
    });
    // One list for both tracks (Oct 12 / 0067): a static keeps a key the old static ladder lacked.
    expect(
      currentPosition({
        type: 'Static',
        internalStatus: 'revisions_submitted',
        clientStatus: 'approved',
        ...VIDEO_DONE,
      }).internal,
    ).toBe('revisions_submitted');
  });
});

describe('statusRefusal — the machine, then the two client gates', () => {
  it('allows standing still and the ladder’s next step; refuses a skip', () => {
    expect(statusRefusal(at('ad_submitted'), 'ad_submitted', 'pending_for_approval')).toBeNull();
    expect(
      statusRefusal(at('ad_submitted'), 'revisions_needed', 'pending_for_approval'),
    ).toBeNull();
    expect(
      statusRefusal(at('sent_to_editor_or_designer'), 'approved', 'pending_for_approval'),
    ).toEqual({
      field: 'internalStatus',
      message: NOT_NEXT_INTERNAL,
    });
  });

  it('refuses internal → Approved until the type’s QA ticks are set — the second gate (Oct 12 scope 4)', () => {
    expect(statusRefusal(at('ad_submitted'), 'approved', 'pending_for_approval')).toEqual({
      field: 'internalStatus',
      message: 'Video Editor QA must be ticked before this brief can go to the client.',
    });
    // The ticks THIS save stores win over the row's: a save that ticks and approves at once is legal.
    expect(
      statusRefusal(at('ad_submitted'), 'approved', 'pending_for_approval', VIDEO_DONE),
    ).toBeNull();
    expect(
      statusRefusal(
        at('ad_submitted', 'pending_for_approval', VIDEO_DONE),
        'approved',
        'pending_for_approval',
      ),
    ).toBeNull();
    // The other track's tick is never asked for.
    expect(
      statusRefusal(
        currentPosition({
          type: 'Static',
          internalStatus: 'ad_submitted',
          clientStatus: 'pending_for_approval',
          qaVideoEditor: false,
          qaDesigner: true,
          qaStrategist: true,
        }),
        'approved',
        'pending_for_approval',
      ),
    ).toBeNull();
  });

  it('keeps the first gate: no client move below Approved', () => {
    expect(statusRefusal(at('ad_submitted'), 'ad_submitted', 'approved')).toEqual({
      field: 'status',
      message: CLIENT_GATE_SHUT,
    });
    expect(
      statusRefusal(at('under_editing_or_designing'), 'under_editing_or_designing', 'approved'),
    ).toEqual({
      field: 'status',
      message: CLIENT_GATE_SHUT,
    });
    expect(
      statusRefusal(at('approved', 'approved', VIDEO_DONE), 'approved', 'pending_for_approval'),
    ).toEqual({
      field: 'status',
      message: NOT_NEXT_CLIENT,
    });
  });

  it('gates a client resubmission on QA, and lets the client’s own decisions through', () => {
    expect(
      statusRefusal(at('approved', 'revisions_needed'), 'approved', 'revisions_submitted'),
    ).toEqual({
      field: 'status',
      message: 'Video Editor QA must be ticked before this brief can go to the client.',
    });
    expect(
      statusRefusal(
        at('approved', 'revisions_needed', VIDEO_DONE),
        'approved',
        'revisions_submitted',
      ),
    ).toBeNull();
    expect(
      statusRefusal(at('approved', 'pending_for_approval'), 'approved', 'revisions_needed'),
    ).toBeNull();
    expect(
      statusRefusal(at('approved', 'pending_for_approval'), 'approved', 'approved'),
    ).toBeNull();
  });
});

describe('statusPatch — the status write, the client stamp and the QA reset in ONE patch (scope 5)', () => {
  it('resets the three ticks on a move into an internal revision state', () => {
    expect(
      statusPatch(
        at('ad_submitted', 'pending_for_approval', VIDEO_DONE),
        'revisions_needed',
        'pending_for_approval',
      ),
    ).toEqual({
      internalStatus: 'revisions_needed',
      clientStatus: 'pending_for_approval',
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
    });
  });

  it('resets them and stamps the client track on a move into Revisions Needed', () => {
    const patch = statusPatch(
      at('approved', 'pending_for_approval', VIDEO_DONE),
      'approved',
      'revisions_needed',
    );
    expect(patch).toMatchObject({
      internalStatus: 'approved',
      clientStatus: 'revisions_needed',
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
    });
    expect(patch.clientStatusUpdatedAt).toBeInstanceOf(Date);
  });

  it('touches no tick on any other move, and no stamp when the client track stands still', () => {
    expect(statusPatch(at('ad_submitted'), 'approved', 'pending_for_approval')).toEqual({
      internalStatus: 'approved',
      clientStatus: 'pending_for_approval',
    });
    expect(statusPatch(at('revisions_needed'), 'revisions_needed', 'pending_for_approval')).toEqual(
      {
        internalStatus: 'revisions_needed',
        clientStatus: 'pending_for_approval',
      },
    );
  });
});
