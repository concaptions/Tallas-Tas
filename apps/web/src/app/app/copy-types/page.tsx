import { loadCopyTypeColumns, loadCopyTypes } from '@/lib/copy-types-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { CopyTypesWorkspace, type CopyTypeItem } from './copy-types-workspace';
import { descriptionPreview, linkedCopyLabel } from './fields';

/**
 * Copy Types (Airtable "(Internal) Copy Type", gap audit 2026-10-01 §2.13): the lookup list a Meta
 * or YouTube copy row is tagged with.
 *
 * A server component, shaped exactly like the Products page. The rows come from `loadCopyTypes()`,
 * which is the in-repo fixtures in demo mode and the brand-scoped query otherwise; the page does not
 * know which and does not branch on it. Both pieces of table state are query parameters —
 * `?copyType=` for the open panel and `?q=` for the filter — so a refresh restores the view and
 * either one is shareable as a link.
 *
 * Every derived value is computed here, once: the label of each linked copy (its headline, or the
 * auto-generated `Copy #N` title from `@tas/domain/copy` when it has none — the "Ads Copywriting
 * copy" and "Copywriting" record links Airtable shows, never a stored column and never computed
 * inside a component), the first line of the description for the grid cell, and the relative
 * timestamp with a single `now` (a client that formatted it itself would disagree with the server
 * and break hydration).
 */
interface CopyTypesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CopyTypesPage({ searchParams }: CopyTypesPageProps) {
  const [{ rows }, { columns, unconfigured: unconfiguredColumns }, params] = await Promise.all([
    loadCopyTypes(),
    loadCopyTypeColumns(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items: CopyTypeItem[] = rows.map((copyType) => ({
    copyType,
    descriptionPreview: descriptionPreview(copyType.description),
    metaCopies: copyType.metaCopies.map(linkedCopyLabel),
    youtubeCopies: copyType.youtubeCopies.map(linkedCopyLabel),
    updatedLabel: relativeTime(copyType.updatedAt, now),
    updatedTitle: absoluteTime(copyType.updatedAt),
  }));

  const requested = params.copyType;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CopyTypesWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
