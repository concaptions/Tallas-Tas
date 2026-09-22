import { loadCreativeDimensions } from '@/lib/creative-dimensions-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import {
  CreativeDimensionsWorkspace,
  type CreativeDimensionItem,
} from './creative-dimensions-workspace';

/**
 * Creative Dimensions: the size/format specs (e.g. "IG Story / Reel" at "1080x1920") that a
 * creative design is exported to.
 *
 * A server component, shaped exactly like the Products and Personas pages. The rows come from
 * `loadCreativeDimensions()`, which is the in-repo fixtures in demo mode and the brand-scoped query
 * otherwise; the page does not know which and does not branch on it. Both pieces of table state are
 * query parameters — `?dimension=` for the open panel and `?q=` for the filter — so a refresh
 * restores the view and either one is shareable as a link. It renders into the shell's `<main>` and
 * owns no frame, padding or background of its own.
 *
 * The relative timestamp is formatted here, once, with a single `now`: a client that formatted it
 * itself would produce a different string from the server's and break hydration.
 */
interface CreativeDimensionsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CreativeDimensionsPage({
  searchParams,
}: CreativeDimensionsPageProps) {
  const [{ rows }, params] = await Promise.all([loadCreativeDimensions(), searchParams]);
  const demo = isDemoMode();
  const now = new Date();

  const items: CreativeDimensionItem[] = rows.map((dimension) => ({
    dimension,
    updatedLabel: relativeTime(dimension.updatedAt, now),
    updatedTitle: absoluteTime(dimension.updatedAt),
  }));

  const requested = params.dimension;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CreativeDimensionsWorkspace
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
