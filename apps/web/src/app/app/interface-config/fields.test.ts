import { describe, expect, it } from 'vitest';
import { demoAngles, demoConcepts, type AngleListRow } from '@tas/db';
import { INTERFACE_PAGE_KEYS, defaultInterfaceConfig, findPage } from '@tas/domain/interface';
import { CLIENT_STATUS } from '@tas/domain/state';

import { toConceptRow, type ConceptRow } from '@/lib/concepts-source';

import {
  CONCEPT_CARD_PAGE_KEY,
  INTERFACE_CONFIG_ADMIN_NOTE,
  INTERFACE_CONFIG_ENFORCEMENT_NOTE,
  INTERFACE_CONFIG_NOT_ADMIN_NOTE,
  PAGE_PREVIEW_BODY,
  clientStatusView,
  conceptPreview,
  conceptPreviewValues,
  fieldCountLabel,
  isMonoField,
  pageCountLabel,
} from './fields';

/** The newest seeded concept: the row `page.tsx` hands the preview card. */
function newestConcept(): ConceptRow {
  const [first] = demoConcepts;
  if (first === undefined) {
    throw new Error('demoConcepts is empty; the preview has nothing to render');
  }
  return toConceptRow(first);
}

/** The angle the newest seeded concept is paired with: where the card's three prose fields come from. */
function pairedAngle(concept: ConceptRow): AngleListRow {
  const angle = demoAngles.find((row) => row.id === concept.angleIds[0]);
  if (angle === undefined) {
    throw new Error('the newest demo concept is not paired with a seeded angle');
  }
  return angle;
}

/** The twelve concept fields as the domain defines them, in PRD §10 order. */
function conceptFieldNames(): readonly string[] {
  const page = findPage(defaultInterfaceConfig(), CONCEPT_CARD_PAGE_KEY);
  if (page === undefined) {
    throw new Error('defaultInterfaceConfig() has no concept page');
  }
  return page.fields.map((field) => field.fieldName);
}

/**
 * The projection the preview card depends on. Its whole risk is DRIFT: a field renamed in
 * `defaultInterfaceConfig()` would leave one card line permanently reading "—" and nothing would
 * fail, so the twelve keys are asserted against the domain's own defaults rather than eyeballed.
 */
describe('conceptPreviewValues', () => {
  it('covers exactly the concept page of defaultInterfaceConfig(), key for key', () => {
    const keys = Object.keys(conceptPreviewValues(newestConcept()));

    expect([...keys].sort()).toEqual([...conceptFieldNames()].sort());
  });

  it('prints the seeded concept, the names inherited from its angle included', () => {
    const concept = newestConcept();
    const values = conceptPreviewValues(concept);

    expect(values.concept_name).toBe(concept.name);
    expect(values.batch).toBe(concept.batch);
    expect(values.angle).toBe(concept.angleName);
    expect(values.theme).toBe(concept.themeName);
    expect(values.persona).toBe(concept.personaName);
    expect(values.hook_examples).toBe(concept.hookExamples);
  });

  /**
   * Which text the client sees under "Description (hypothesis)", "Pain Points" and "USP": the
   * ANGLE's, as PRD §5.7 derives them and as `clientConcepts` — the reader behind the real client
   * portal — prints them. The concept row carries its own prose under the same three names (Gratsi
   * parity), and the fixture's concept and angle texts differ on all three, so these assertions
   * can tell the two apart: a projection that read the concept's own columns fails here.
   */
  it('prints the ANGLE’s hypothesis, pain points and USP, never the concept’s own prose', () => {
    const concept = newestConcept();
    const angle = pairedAngle(concept);
    const values = conceptPreviewValues(concept);

    expect(values.description).toBe(angle.description);
    expect(values.pain_points).toBe(angle.painPoints);
    expect(values.usp).toBe(angle.usp);

    expect(values.description).not.toBeNull();
    expect(values.description).not.toBe(concept.description);
    expect(values.pain_points).not.toBe(concept.painPoints);
    expect(values.usp).not.toBe(concept.usp);
  });

  it('carries nothing internal: no internal status, no script idea (non-negotiable 10)', () => {
    const concept = newestConcept();
    const values = conceptPreviewValues(concept);
    const printed = Object.values(values);

    expect(Object.keys(values)).not.toContain('internal_status');
    expect(Object.keys(values)).not.toContain('script_idea');
    expect(printed).not.toContain(concept.scriptIdea);
    expect(printed).not.toContain(concept.internalStatus);
  });
});

describe('CONCEPT_CARD_PAGE_KEY', () => {
  it("is the page carrying PRD §10's twelve concept fields, not a hand-written key", () => {
    const page = findPage(defaultInterfaceConfig(), CONCEPT_CARD_PAGE_KEY);

    expect(page?.fields.map((field) => field.label)).toEqual([
      'Batch',
      'Category',
      'Concept name',
      'Concept Style',
      'Angle',
      'Theme',
      'Product',
      'Description (hypothesis)',
      'Pain Points',
      'USP',
      'Persona',
      'Hook examples',
    ]);
  });
});

describe('PAGE_PREVIEW_BODY', () => {
  it('has a body for every page the domain knows, and none for a page it does not', () => {
    expect(Object.keys(PAGE_PREVIEW_BODY).sort()).toEqual([...INTERFACE_PAGE_KEYS].sort());
    for (const body of Object.values(PAGE_PREVIEW_BODY)) {
      expect(body.length).toBeGreaterThan(10);
    }
  });
});

describe('clientStatusView', () => {
  it('takes its label from CLIENT_STATUS and its tone from that label', () => {
    const [pending] = CLIENT_STATUS;

    expect(clientStatusView(pending.key)).toEqual({
      key: pending.key,
      label: pending.label,
      tone: 'info',
    });
    expect(clientStatusView('approved').tone).toBe('ok');
  });

  it('renders an unknown key on a muted chip rather than throwing', () => {
    expect(clientStatusView('not_a_status')).toEqual({
      key: 'not_a_status',
      label: 'not_a_status',
      tone: 'mute',
    });
  });
});

describe('conceptPreview', () => {
  it('pairs the client status chip with the values, and never the internal status', () => {
    const concept = newestConcept();
    const preview = conceptPreview({ ...concept, clientStatus: 'pending_for_approval' });

    expect(preview.status.label).toBe('Pending for Approval');
    expect(preview.values.concept_name).toBe(concept.name);
  });
});

describe('the worded counts', () => {
  it.each([
    [0, 12, '0 of 12 fields visible'],
    [1, 1, '1 of 1 field visible'],
    [0, 0, 'no fields'],
  ])('fieldCountLabel(%i, %i) is %s', (visible, total, expected) => {
    expect(fieldCountLabel(visible, total)).toBe(expected);
  });

  it.each([
    [5, 5, '5 of 5 pages on'],
    [0, 1, '0 of 1 page on'],
  ])('pageCountLabel(%i, %i) is %s', (on, total, expected) => {
    expect(pageCountLabel(on, total)).toBe(expected);
  });
});

describe('isMonoField', () => {
  it('marks the auto-generated values and nothing a human wrote', () => {
    expect(isMonoField('concept_name')).toBe(true);
    expect(isMonoField('batch')).toBe(true);
    expect(isMonoField('description')).toBe(false);
    expect(isMonoField('hook_examples')).toBe(false);
  });
});

describe("the gate's copy (2026-10-03: this page had no role check at all)", () => {
  it('says the page is admin only, and what a change here does', () => {
    expect(INTERFACE_CONFIG_ADMIN_NOTE).toContain('admin only');
    expect(INTERFACE_CONFIG_ADMIN_NOTE).toContain('client');
  });

  it('names the role a refused reader has to go to', () => {
    expect(INTERFACE_CONFIG_NOT_ADMIN_NOTE).toContain('Admin');
  });

  it('says the save checks the rule again, so the page gate is not the only gate', () => {
    expect(INTERFACE_CONFIG_ENFORCEMENT_NOTE).toContain('again on the server');
  });
});
