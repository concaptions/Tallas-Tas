import { notFound } from 'next/navigation';
import { CONCEPT_CLIENT_STATUS_DEFAULT, CONCEPT_INTERNAL_STATUS_DEFAULT } from '@tas/db';

import { loadAngles } from '@/lib/angles-source';
import { CONCEPT_TRACK, loadConceptById } from '@/lib/concepts-source';
import { loadCreators } from '@/lib/ugc-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadThemes } from '@/lib/themes-source';

import { NEW_CONCEPT } from '../fields';
import {
  ConceptDetail,
  type AngleOption,
  type ConceptFormValues,
  type CreatorOption,
  type ThemeOption,
} from './concept-detail';

/**
 * One concept (PRD §5.7). A REAL ROUTE SEGMENT, not a side panel: `/app/concepts/<id>` is the URL
 * you send to the editor who has to shoot it, and Back from here restores the list with the
 * `?view=` it was left on.
 *
 * A server component, shaped like the list page beside it. Three loaders, one per table: the
 * concept itself, and the Angles and Themes the pairing's two dropdowns offer. They are handed down
 * as plain `{ id, name, … }` data, so the client component never imports `@tas/db` at runtime and
 * the driver stays out of the browser bundle. The three reads are independent, so they run together.
 *
 * The angle options carry the five fields a concept inherits — description, pain points, USP,
 * persona and product — because the read-only block below the pairing has to re-fill the instant
 * the Angle dropdown changes, with no round trip. That is the whole of PRD §5.7's "everything
 * derivable from the Angle must auto-fill": the fields follow the CHOSEN angle, not the saved one.
 *
 * An unknown id is `notFound()`, never a crash: `loadConceptById` answers null and this page turns
 * that null into a 404. The one id that is not a row is `new`, which is the create form — a uuid
 * can never be the word `new`, so the two share a route without a second page.
 *
 * `CONCEPT_TRACK` and the two column defaults are read here, on the server, and passed down: they
 * live beside the data source and in `@tas/db`, so no component ever names a track or a status.
 */
interface ConceptPageProps {
  readonly params: Promise<{ conceptId: string }>;
}

export default async function ConceptPage({ params }: ConceptPageProps) {
  const [{ conceptId }, angleRows, themeRows, creatorRows] = await Promise.all([
    params,
    loadAngles(),
    loadThemes(),
    loadCreators(),
  ]);
  const demo = isDemoMode();
  const creating = conceptId === NEW_CONCEPT;

  const { concept } = creating ? { concept: null } : await loadConceptById(conceptId);
  if (!creating && concept === null) {
    notFound();
  }

  const angles: AngleOption[] = angleRows.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    painPoints: row.painPoints,
    usp: row.usp,
    personaName: row.personaName,
    productName: row.productName,
  }));

  const themes: ThemeOption[] = themeRows.rows
    .filter((row) => row.isActive)
    .map((row) => ({ id: row.id, name: row.name }));

  const creators: CreatorOption[] = creatorRows.rows.map((row) => ({ id: row.id, name: row.name }));

  const values: ConceptFormValues | null =
    concept === null
      ? null
      : {
          id: concept.id,
          batch: concept.batch,
          angleId: concept.angleId,
          themeId: concept.themeId,
          category: concept.category,
          conceptStyle: concept.conceptStyle,
          formats: concept.formats,
          adInspoLinks: concept.adInspoLinks,
          hookExamples: concept.hookExamples,
          scriptIdea: concept.scriptIdea,
          approvalStatus: concept.approvalStatus,
          productionStatus: concept.productionStatus,
          formatsToCreate: concept.formatsToCreate,
          creatorId: concept.creatorId,
        };

  return (
    <ConceptDetail
      concept={values}
      angles={angles}
      themes={themes}
      creators={creators}
      track={CONCEPT_TRACK}
      internal={concept?.internalStatus ?? CONCEPT_INTERNAL_STATUS_DEFAULT}
      client={concept?.clientStatus ?? CONCEPT_CLIENT_STATUS_DEFAULT}
      demo={demo}
    />
  );
}
