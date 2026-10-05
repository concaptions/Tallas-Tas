import { supportsView, type ViewType } from '@tas/domain';

import { loadCopyColumns, loadCopyWorkspace } from '@/lib/copy-source';
import { loadCopyTypes } from '@/lib/copy-types-source';
import { isDemoMode } from '@/lib/demo-mode';

import { buildCopyItems } from './build-items';
import { CopywritingWorkspace } from './copywriting-workspace';

/**
 * Meta Copywriting (PRD §5.11): "Ad copy, written separately but tied to the creative."
 *
 * A server component, shaped exactly like the YouTube Copywriting page since the Gratsi column
 * match (2026-10-04, `docs/audits/gratsi-column-diff-2026-10-04.md`): the brand's ordered,
 * labelled, visible columns come from `loadCopyColumns` (THE shared resolver loader), and the rows
 * plus every linked table the grid's lookup columns read — campaigns, collections, products, each
 * brief's angle — come from `loadCopyWorkspace()` on one connection: fixtures in demo mode, the
 * brand-scoped queries otherwise. The page does not know which and does not branch on it.
 *
 * EVERYTHING IS RESOLVED ONCE, in `buildCopyItems`: the auto-generated title over the stored
 * `copy_number` (CLAUDE.md non-negotiable 6), the status label and tone from `@tas/domain/state`,
 * both timestamp strings with a single `now`, and every Airtable LOOKUP cell through
 * `lookupRollup` — the one registered formula every lookup column names. The client components
 * below receive plain data and never import the database driver.
 *
 * TWO RECORD LINKS THE COPY SIDE OWNS. Copy Types come from `loadCopyTypes()` and are inverted
 * into `copyTypeIds` per row; the panel's picker writes them back through `updateCopyAction`.
 * Campaigns & Offers (`copywriting_campaigns`) still has no writer in `@tas/db`, so the panel
 * renders the list read-only and says so.
 *
 * ONE LINK THE COLLECTION SIDE OWNS. Airtable's "Collections" on a copy row is the inverse of
 * `collections.copywriting_id`, inverted once into `collections` per row; the panel lists them
 * read-only, because the Copywriting ID field on the collection's panel is where that link is
 * made.
 */
interface CopywritingPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CopywritingPage({ searchParams }: CopywritingPageProps) {
  const [workspace, { columns, unconfigured: unconfiguredColumns }, copyTypeResult, params] =
    await Promise.all([loadCopyWorkspace(), loadCopyColumns(), loadCopyTypes(), searchParams]);
  const demo = isDemoMode();

  const items = buildCopyItems(
    {
      rows: workspace.rows,
      campaigns: workspace.campaigns,
      collections: workspace.collections,
      products: workspace.products,
      briefLookups: workspace.briefLookups,
      copyTypes: copyTypeResult.rows,
    },
    new Date(),
  );

  const requestedSelection = params.copy;
  const selection =
    typeof requestedSelection === 'string' && requestedSelection !== '' ? requestedSelection : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const initialView: ViewType =
    typeof requestedView === 'string' && supportsView('copywriting', requestedView as ViewType)
      ? (requestedView as ViewType)
      : 'grid';

  return (
    <CopywritingWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      creatives={workspace.creatives.map((creative) => ({ id: creative.id, name: creative.name }))}
      concepts={workspace.concepts.map((concept) => ({ id: concept.id, name: concept.name }))}
      collections={workspace.collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
      }))}
      copyTypes={copyTypeResult.rows.map((copyType) => ({
        id: copyType.id,
        name: copyType.name,
      }))}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
    />
  );
}
