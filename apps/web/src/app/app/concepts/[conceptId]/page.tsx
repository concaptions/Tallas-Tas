import { notFound } from 'next/navigation';
import { CONCEPT_CLIENT_STATUS_DEFAULT, CONCEPT_INTERNAL_STATUS_DEFAULT } from '@tas/db';

import { loadAngles } from '@/lib/angles-source';
import { loadCampaigns } from '@/lib/campaigns-source';
import { loadBriefsByConceptId } from '@/lib/briefs-source';
import { loadCollections } from '@/lib/collections-source';
import { CONCEPT_TRACK, loadConceptById } from '@/lib/concepts-source';
import { loadCreators } from '@/lib/ugc-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadPersonas } from '@/lib/personas-source';
import { loadProducts } from '@/lib/products-source';
import { loadThemes } from '@/lib/themes-source';

import { briefPath } from '@/lib/routes';

import { internalStatusView as briefStatusView } from '../../creative-design/fields';
import { NEW_CONCEPT, type ConceptCampaignLink } from '../fields';
import {
  ConceptDetail,
  type AngleOption,
  type ConceptCollectionItem,
  type ConceptFormValues,
  type ConceptCreativeItem,
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
 * The concept's OWN description, pain points, USP and client comments (Gratsi module parity) are a
 * different thing: four stored columns of the concept row, mapped into the form values below and
 * edited in the Brief like the hook examples and the script idea.
 *
 * An unknown id is `notFound()`, never a crash: `loadConceptById` answers null and this page turns
 * that null into a 404. The one id that is not a row is `new`, which is the create form — a uuid
 * can never be the word `new`, so the two share a route without a second page.
 *
 * `CONCEPT_TRACK` and the two column defaults are read here, on the server, and passed down: they
 * live beside the data source and in `@tas/db`, so no component ever names a track or a status.
 *
 * CAMPAIGNS & OFFERS (module parity, phase 2) is the one link read from the far side: the campaign
 * panel owns `campaign_concepts` (Airtable's "Angles" field, which links to concepts despite its
 * name), and this page lists the campaigns running on the concept read-only, in the rail next to
 * the creatives. The inversion is `campaignLinksFor` in `../fields`, fed campaign rows that carry
 * their `conceptIds`. `@tas/db` has no reader for the junction yet — `listCampaigns` returns the
 * bare row, the demo fixtures carry no concept ids, and neither the seed nor the importer writes
 * it — so until that reader ships the rail is handed the empty list and renders its empty state,
 * which says where the link is made. The shape is the one this page fills then.
 *
 * COLLECTIONS (Gratsi "Collection", module parity 2026-10-01) is read the same way: the concept row
 * carries its `concept_collections` ids, this page names them from the brand's collections
 * (demo-aware, through the one Collections loader) and the rail lists them read-only after the
 * campaigns. Only the id and the name travel down; the deep link into the collection's panel is
 * built in the client component, which owns the Collections workspace's query key.
 */
interface ConceptPageProps {
  readonly params: Promise<{ conceptId: string }>;
}

export default async function ConceptPage({ params }: ConceptPageProps) {
  const [{ conceptId }, angleRows, themeRows, creatorRows, personaRows, productRows] =
    await Promise.all([
      params,
      loadAngles(),
      loadThemes(),
      loadCreators(),
      loadPersonas(),
      loadProducts(),
    ]);
  const personaNames = new Map(personaRows.rows.map((row) => [row.id, row.name]));
  const productNames = new Map(productRows.rows.map((row) => [row.id, row.name]));
  const demo = isDemoMode();
  const creating = conceptId === NEW_CONCEPT;

  const { concept } = creating ? { concept: null } : await loadConceptById(conceptId);
  if (!creating && concept === null) {
    notFound();
  }

  // The creatives already built on this concept (TASK 5: Briefs → Concepts, the concept side).
  // Status views are computed here so the client component never touches the state machine.
  const creativeRows = creating ? [] : (await loadBriefsByConceptId(conceptId)).rows;
  const creatives: ConceptCreativeItem[] = creativeRows.map((row) => {
    const status = briefStatusView(row.track, row.internalStatus);
    return {
      id: row.id,
      name: row.name,
      statusLabel: status.label,
      statusTone: status.tone,
      href: briefPath(row.id),
    };
  });

  // The campaigns linked through `campaign_concepts` and the collections linked through
  // `concept_collections`, each read from the concept row's own ids and named from the brand's
  // rows (demo-aware); the two reads are independent, so they run together.
  const [campaignRows, collectionRows] = await Promise.all([loadCampaigns(), loadCollections()]);
  const campaignNames = new Map(campaignRows.rows.map((c) => [c.id, c.name]));
  const campaigns: ConceptCampaignLink[] = (concept?.campaignIds ?? []).flatMap((id) => {
    const label = campaignNames.get(id);
    return label === undefined ? [] : [{ id, label }];
  });

  // A collection id the brand's scope cannot see (another brand's, or soft-deleted) resolves to no
  // name and is dropped, never rendered as a bare id.
  const collectionNames = new Map(collectionRows.rows.map((c) => [c.id, c.name]));
  const collections: ConceptCollectionItem[] = (concept?.collectionIds ?? []).flatMap((id) => {
    const name = collectionNames.get(id);
    return name === undefined ? [] : [{ id, name }];
  });

  const angles: AngleOption[] = angleRows.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    painPoints: row.painPoints,
    usp: row.usp,
    personaName: row.personaName,
    productName: row.productName,
    // Every linked persona and product (LINK-02): read-only lookups on the concept, never stored.
    personaNames: row.personaIds.flatMap((id) => personaNames.get(id) ?? []),
    productNames: row.productIds.flatMap((id) => productNames.get(id) ?? []),
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
          angleIds: concept.angleIds,
          creatorIds: concept.creatorIds,
          themeId: concept.themeIds[0] ?? null,
          category: concept.category,
          conceptStyle: concept.conceptStyle,
          formats: concept.formats,
          adInspoLinks: concept.adInspoLinks,
          hookExamples: concept.hookExamples,
          scriptIdea: concept.scriptIdea,
          description: concept.description,
          painPoints: concept.painPoints,
          usp: concept.usp,
          clientComments: concept.clientComments,
          clientApprovalStatus: concept.clientApprovalStatus,
          productionStatus: concept.productionStatus,
          formatsToCreate: concept.formatsToCreate,
          clientStatusNote: concept.clientStatusNote,
        };

  return (
    <ConceptDetail
      concept={values}
      creatives={creatives}
      campaigns={campaigns}
      collections={collections}
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
