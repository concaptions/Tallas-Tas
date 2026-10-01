import { copyTitle } from '@tas/domain/copy';
import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';

import { loadCampaigns } from '@/lib/campaigns-source';
import { loadCollections } from '@/lib/collections-source';
import { loadCopyWorkspace } from '@/lib/copy-source';
import { loadCopyTypes } from '@/lib/copy-types-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { briefPath } from '@/lib/routes';

import { CopywritingWorkspace } from './copywriting-workspace';
import { campaignLinks, collectionsByCopy, copyTypeIdsByCopy, type CopyItem } from './fields';

/**
 * Copywriting (PRD §5.11): "Ad copy, written separately but tied to the creative. Keep this table
 * lean."
 *
 * A server component, shaped exactly like the Personas, Products, Angles, Themes, Concepts and
 * Creative Briefs pages. The rows come from `loadCopyWorkspace()`, which is the in-repo fixtures in
 * demo mode and the brand-scoped query otherwise; the page does not know which and does not branch
 * on it. It renders into the shell's `<main>` and therefore owns no frame, padding or background of
 * its own.
 *
 * EVERYTHING IS RESOLVED HERE, ONCE. `@/lib/copy-source` imports `@tas/db`, so it can only be read
 * on the server. The auto-generated title is `copyTitle` applied to the stored `copy_number`
 * (CLAUDE.md non-negotiable 4 — it is never an input and never a column), the status label and chip
 * tone are `@tas/domain/state`, and both timestamp strings are formatted here with a single `now`:
 * a client that formatted them itself would render a different string from the server's and break
 * hydration. The client components below receive plain data and never import the database driver.
 *
 * The open row lives in `?copy=` and the search in `?q=`, so both are shareable links. The rows
 * arrive newest edit first from `loadCopyWorkspace()`, so this page never sorts.
 *
 * TWO RECORD LINKS THE COPY SIDE OWNS (module parity, phase 2). Copy Types come from
 * `loadCopyTypes()` — demo fixtures or the scoped query, each type already carrying its Meta copies
 * — and are inverted here, once, into `copyTypeIds` per row; the panel's picker writes them back
 * through `updateCopyAction`. Campaigns & Offers (`copywriting_campaigns`) has neither a reader nor
 * a writer in `@tas/db` yet — nothing loads the junction and nothing, importer included, writes it
 * — so every row's `campaigns` list is empty until `loadAllCopywritingCampaigns` ships, and the
 * panel renders the list read-only and says so. The shape is the one the page fills then.
 *
 * ONE LINK THE COLLECTION SIDE OWNS. Airtable's "Collections" on a copy row is the inverse of
 * `collections.copywriting_id`, so the brand's collections come from `loadCollections()` (fixtures
 * or the scoped query) and are inverted here, once, into `collections` per row; the panel lists
 * them read-only, because the Copywriting ID field on the collection's panel is where that link
 * is made.
 */
interface CopywritingPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CopywritingPage({ searchParams }: CopywritingPageProps) {
  const [{ rows, creatives, concepts }, copyTypeResult, campaignRows, collectionRows, params] =
    await Promise.all([
      loadCopyWorkspace(),
      loadCopyTypes(),
      loadCampaigns(),
      loadCollections(),
      searchParams,
    ]);
  const demo = isDemoMode();
  const now = new Date();
  const typeIdsByCopy = copyTypeIdsByCopy(copyTypeResult.rows);
  const linkedCollectionsByCopy = collectionsByCopy(collectionRows.rows);

  const campaignsById = new Map(campaignRows.rows.map((c) => [c.id, c.name]));
  const items: CopyItem[] = rows.map((row) => ({
    id: row.id,
    title: copyTitle(row.copyNumber),
    headline: row.headline,
    primaryCopy: row.primaryCopy,
    linkDescription: row.linkDescription,
    cta: row.cta,
    status: row.status,
    statusLabel: copyStatusLabel(row.status),
    statusTone: copyStatusTone(row.status),
    creativeBriefId: row.creativeBriefId,
    creativeName: row.creativeName,
    creativeHref: row.creativeBriefId === null ? null : briefPath(row.creativeBriefId),
    conceptId: row.conceptId,
    conceptName: row.conceptName,
    funnel: row.funnel,
    used: row.used,
    winning: row.winning,
    metaRating: row.metaRating,
    spellingFeedback: row.spellingFeedback,
    clientComment: row.clientComment,
    copyTypeIds: typeIdsByCopy.get(row.id) ?? [],
    campaigns: campaignLinks(row.campaignIds, campaignsById),
    collections: linkedCollectionsByCopy.get(row.id) ?? [],
    updatedLabel: relativeTime(row.updatedAt, now),
    updatedTitle: absoluteTime(row.updatedAt),
  }));

  const requestedSelection = params.copy;
  const selection =
    typeof requestedSelection === 'string' && requestedSelection !== '' ? requestedSelection : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CopywritingWorkspace
      items={items}
      creatives={creatives.map((creative) => ({ id: creative.id, name: creative.name }))}
      concepts={concepts.map((concept) => ({ id: concept.id, name: concept.name }))}
      copyTypes={copyTypeResult.rows.map((copyType) => ({
        id: copyType.id,
        name: copyType.name,
      }))}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
