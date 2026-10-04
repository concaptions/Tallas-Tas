import { supportsView, type ViewType } from '@tas/domain';

import { isDemoMode } from '@/lib/demo-mode';
import { loadYoutubeCopyColumns, loadYoutubeCopyWorkspace } from '@/lib/youtube-copywriting-source';

import { buildYoutubeCopyItems } from './build-items';
import { SEARCH_PARAM, SELECTION_PARAM } from './fields';
import { YoutubeCopywritingWorkspace } from './youtube-copywriting-workspace';

/**
 * YouTube Copywriting (Airtable `tblVR1UmkbDoDzJ7z`, gap audit 2026-10-01 §2.12): the pre-roll
 * copy, a separate table from Meta Copywriting with its own wider funnel vocabulary.
 *
 * A server component, shaped exactly like the Products page. The rows and the four pickers' options
 * come from `loadYoutubeCopyWorkspace()`, which is the in-repo fixtures in demo mode and the
 * brand-scoped queries otherwise; the page does not know which and does not branch on it.
 *
 * EVERYTHING IS RESOLVED HERE, ONCE. `buildYoutubeCopyItems` turns each row into plain data: the
 * generated Copy # title, the status label and tone from `@tas/domain/state`, the CTA and funnel
 * labels from the schema vocabularies, every Airtable LOOKUP cell through `lookupRollup`
 * (GRATSI-MATCH, 2026-10-04), and both timestamp strings with a single `now` (a client that
 * formatted them itself would disagree with the server and break hydration). The client
 * components below receive plain data and never import the database driver.
 *
 * The open row lives in `?youtube-copy=`, the search in `?q=` and the view in `?view=`, so each is
 * a shareable link. The rows arrive newest edit first, so this page never sorts.
 */
interface YoutubeCopywritingPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TABLE_KEY = 'youtube-copywriting';

export default async function YoutubeCopywritingPage({
  searchParams,
}: YoutubeCopywritingPageProps) {
  const [
    { rows, collections, collectionProducts, products, campaigns, copyTypes },
    { columns, unconfigured: unconfiguredColumns },
    params,
  ] = await Promise.all([loadYoutubeCopyWorkspace(), loadYoutubeCopyColumns(), searchParams]);
  const demo = isDemoMode();

  const items = buildYoutubeCopyItems(rows, collectionProducts, new Date());

  const requested = params[SELECTION_PARAM];
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params[SEARCH_PARAM];
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const initialView: ViewType =
    typeof requestedView === 'string' && supportsView(TABLE_KEY, requestedView as ViewType)
      ? (requestedView as ViewType)
      : 'grid';

  return (
    <YoutubeCopywritingWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      collections={collections}
      products={products}
      campaigns={campaigns}
      copyTypes={copyTypes}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
    />
  );
}
