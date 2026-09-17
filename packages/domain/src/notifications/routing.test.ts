import { describe, expect, it } from 'vitest';

import { NOTIFICATION_ROUTING_LINK_LABEL, NOTIFICATION_ROUTING_NOTE, routingNote } from './routing';

describe('routingNote', () => {
  it('is the fixed note, identical to the exported constant', () => {
    expect(routingNote()).toBe(NOTIFICATION_ROUTING_NOTE);
  });

  it('returns the same sentence every time, so the page and a future email cannot drift', () => {
    expect(routingNote()).toBe(routingNote());
  });

  it('says routing comes from the team assignment made at onboarding', () => {
    expect(routingNote()).toContain('team assignment');
    expect(routingNote()).toContain('onboarding');
  });

  it('says the recipient is not editable here, which is why the column is text', () => {
    expect(routingNote()).toContain('not from this page');
    expect(routingNote()).toContain('nothing to pick here');
  });

  it('is one short paragraph of plain text: no markup, no link, no colour', () => {
    const note = routingNote();
    expect(note.length).toBeGreaterThan(80);
    expect(note.length).toBeLessThan(320);
    expect(note).not.toMatch(/[<>#]|href|text-|bg-|rounded-/);
    expect(note.trim()).toBe(note);
  });
});

describe('NOTIFICATION_ROUTING_LINK_LABEL', () => {
  it('gives the note’s Team link its words, so no component writes copy', () => {
    expect(NOTIFICATION_ROUTING_LINK_LABEL).toBe('Manage team assignment');
  });

  it('is not repeated inside the note itself', () => {
    expect(routingNote()).not.toContain(NOTIFICATION_ROUTING_LINK_LABEL);
  });
});
