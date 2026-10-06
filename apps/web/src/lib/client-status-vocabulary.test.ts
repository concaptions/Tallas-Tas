import { describe, expect, it } from 'vitest';
import { CLIENT_STATUS, COPY_STATUS, CREATOR_STATUS } from '@tas/domain/state';

import {
  NOTE_REQUIRED_STATUSES,
  clientStatusRequiresNote,
  clientStatusVocabulary,
  narrowClientStatusKey,
} from './client-status-vocabulary';

/**
 * The required-note predicate and the vocabulary helpers around the Oct 5 client-status workflow,
 * extended by the Oct 6 Talal ruling that promoted `disapproved` to an explicit CLIENT_STATUS
 * terminal (`docs/decisions.md` 2026-10-07).
 *
 * These are synchronous helpers around domain vocabularies: no DB, no clock, no network.
 */

describe('clientStatusVocabulary — one list per table, straight from the domain', () => {
  it('returns CLIENT_STATUS keys for concepts and creative_briefs', () => {
    expect(clientStatusVocabulary('concepts')).toEqual(CLIENT_STATUS.map((entry) => entry.key));
    expect(clientStatusVocabulary('creative_briefs')).toEqual(
      CLIENT_STATUS.map((entry) => entry.key),
    );
  });

  it('returns CREATOR_STATUS for creators and COPY_STATUS for copywriting', () => {
    expect(clientStatusVocabulary('creators')).toEqual(CREATOR_STATUS.map((entry) => entry.key));
    expect(clientStatusVocabulary('copywriting')).toEqual(COPY_STATUS.map((entry) => entry.key));
  });

  it('includes disapproved on every table that carries it, concepts and briefs included (Oct 6)', () => {
    expect(clientStatusVocabulary('concepts')).toContain('disapproved');
    expect(clientStatusVocabulary('creative_briefs')).toContain('disapproved');
    expect(clientStatusVocabulary('creators')).toContain('disapproved');
    expect(clientStatusVocabulary('copywriting')).toContain('disapproved');
  });
});

describe('clientStatusRequiresNote — the dropdown gate and the server gate agree', () => {
  it('is false for the states that need no reason, on every table', () => {
    for (const table of ['concepts', 'creative_briefs', 'creators', 'copywriting'] as const) {
      expect(clientStatusRequiresNote(table, 'pending_for_approval')).toBe(false);
      expect(clientStatusRequiresNote(table, 'approved')).toBe(false);
    }
  });

  it('is true for revisions_needed on every table that carries that key', () => {
    for (const table of ['concepts', 'creative_briefs', 'creators', 'copywriting'] as const) {
      expect(clientStatusRequiresNote(table, 'revisions_needed')).toBe(true);
    }
  });

  it('is true for disapproved on every table — concepts and briefs included after the Oct 6 ruling', () => {
    expect(clientStatusRequiresNote('concepts', 'disapproved')).toBe(true);
    expect(clientStatusRequiresNote('creative_briefs', 'disapproved')).toBe(true);
    expect(clientStatusRequiresNote('creators', 'disapproved')).toBe(true);
    expect(clientStatusRequiresNote('copywriting', 'disapproved')).toBe(true);
  });

  it('is false for a status this build has no row for, on every table', () => {
    for (const table of ['concepts', 'creative_briefs', 'creators', 'copywriting'] as const) {
      expect(clientStatusRequiresNote(table, 'from_a_newer_build')).toBe(false);
    }
  });

  it('refuses a note-required key when the table has no edge to it', () => {
    // COPY_STATUS has its own vocabulary that uses `pending_for_client_review` rather than
    // `pending_for_approval`, so `pending_for_approval` on copywriting is unknown — and must not
    // slip into the note-required set just because the shared key list includes it.
    expect(clientStatusRequiresNote('copywriting', 'pending_for_approval')).toBe(false);
  });

  it('NOTE_REQUIRED_STATUSES is exactly the two keys the dropdown treats as reason-required', () => {
    expect([...NOTE_REQUIRED_STATUSES].sort()).toEqual(['disapproved', 'revisions_needed']);
  });
});

describe('narrowClientStatusKey', () => {
  it('narrows disapproved to the right typed key for concepts and creative_briefs', () => {
    expect(narrowClientStatusKey('concepts', 'disapproved')).toBe('disapproved');
    expect(narrowClientStatusKey('creative_briefs', 'disapproved')).toBe('disapproved');
  });

  it('narrows disapproved for creators and copywriting too', () => {
    expect(narrowClientStatusKey('creators', 'disapproved')).toBe('disapproved');
    expect(narrowClientStatusKey('copywriting', 'disapproved')).toBe('disapproved');
  });

  it('returns null for a key this build has no row for', () => {
    expect(narrowClientStatusKey('concepts', 'from_a_newer_build')).toBeNull();
  });
});
