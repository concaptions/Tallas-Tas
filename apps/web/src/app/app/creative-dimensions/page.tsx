import { loadBriefs } from '@/lib/briefs-source';
import {
  loadCreativeDimensionColumns,
  loadCreativeDimensions,
} from '@/lib/creative-dimensions-source';
import { isDemoMode } from '@/lib/demo-mode';

import {
  CreativeDimensionsWorkspace,
  type CreativeDimensionItem,
} from './creative-dimensions-workspace';
import { linkedDesignsForDimension } from './fields';

/**
 * Creative Dimensions: the size/format specs (e.g. "IG Story / Reel" at "1080x1920") that a
 * creative design is exported to.
 *
 * A server component, shaped exactly like the Products and Personas pages. The rows come from
 * `loadCreativeDimensions()`, which is the in-repo fixtures in demo mode and the brand-scoped
 * query otherwise; the page does not know which and does not branch on it. The column set comes
 * from `loadCreativeDimensionColumns()` — the resolver — and the `(Internal) Creative Design`
 * reverse link is resolved HERE, in one pass over the briefs the demo-aware `loadBriefs()`
 * already returns: the briefs whose `dimensions` placement names carry the row's name, plus the
 * brief the stored `creative_design_id` points at. Never a per-row query. Both pieces of table
 * state are query parameters — `?dimension=` for the open panel and `?q=` for the filter — so a
 * refresh restores the view and either one is shareable as a link.
 */
interface CreativeDimensionsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CreativeDimensionsPage({
  searchParams,
}: CreativeDimensionsPageProps) {
  const [{ rows }, { columns, unconfigured }, briefRows, params] = await Promise.all([
    loadCreativeDimensions(),
    loadCreativeDimensionColumns(),
    loadBriefs(),
    searchParams,
  ]);
  const demo = isDemoMode();

  const items: CreativeDimensionItem[] = rows.map((dimension) => ({
    dimension,
    linkedDesigns: linkedDesignsForDimension(dimension, briefRows.rows),
  }));

  const requested = params.dimension;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CreativeDimensionsWorkspace
      columns={columns}
      unconfiguredColumns={unconfigured}
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
