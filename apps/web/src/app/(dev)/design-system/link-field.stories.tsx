'use client';

import { useState } from 'react';

import { LinkField } from '@/components/links/link-field';

/**
 * The two-way link control (Sprint 9, LINK-01; UI governance rule 4): the same component on both
 * sides of every junction. Shown here from the concept side (its creators) and from the creator
 * side (its concepts), with local state only — the real field writes the junction on every change.
 */
const CREATORS = [
  { id: 'c1', name: 'Danielle Okonkwo' },
  { id: 'c2', name: 'Marcus Delacroix' },
  { id: 'c3', name: 'Priya Raman' },
];

const CONCEPTS = [
  { id: 'k1', name: 'B1-Your Body Clock Is Not Broken-Problem/Solution' },
  { id: 'k2', name: 'B2-It Is Not Just Your Age-Green Screen' },
];

export function LinkFieldStory() {
  const [creatorIds, setCreatorIds] = useState<readonly string[]>(['c1']);
  const [conceptIds, setConceptIds] = useState<readonly string[]>(['k1', 'k2']);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LinkField
        link="concept-creators"
        sourceId={null}
        options={CREATORS}
        selectedIds={creatorIds}
        onChange={setCreatorIds}
        label="Creators"
        demo={false}
        slot="story-concept-creators"
      />
      <LinkField
        link="creator-concepts"
        sourceId={null}
        options={CONCEPTS}
        selectedIds={conceptIds}
        onChange={setConceptIds}
        label="Linked Concepts"
        demo={false}
        slot="story-creator-concepts"
      />
    </div>
  );
}

/** Demo mode: read-only chips, the add control disabled with the usual reason. */
export function LinkFieldDemoStory() {
  return (
    <LinkField
      link="angle-personas"
      sourceId="angle-story"
      options={CREATORS}
      selectedIds={['c2']}
      label="Persona"
      demo
      slot="story-angle-personas"
    />
  );
}
