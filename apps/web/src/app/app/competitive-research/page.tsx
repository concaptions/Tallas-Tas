import { isDemoMode } from '@/lib/demo-mode';
import {
  loadCompetitiveResearch,
  loadCompetitiveResearchColumns,
} from '@/lib/competitive-research-source';

import { hostLabel } from './fields';
import {
  CompetitiveResearchWorkspace,
  type CompetitiveResearchItem,
} from './competitive-research-workspace';

/**
 * Competitive Research: the competitor intelligence table strategists write angles against.
 *
 * A server component, shaped exactly like the Products page. The rows come from
 * `loadCompetitiveResearch()`, which is the in-repo fixtures in demo mode and the brand-scoped query
 * otherwise; the column set comes from `loadCompetitiveResearchColumns()` — the resolver — and the
 * page does not know which mode answered and does not branch on it. Both pieces of table state are
 * query parameters — `?entry=` for the open panel and `?q=` for the filter — so a refresh restores
 * the view and either one is shareable as a link. It renders into the shell's `<main>` and owns no
 * frame, padding or background of its own.
 *
 * The host of the website link is computed here, once, so the table never has to shorten a URL
 * while it renders.
 */
interface CompetitiveResearchPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CompetitiveResearchPage({
  searchParams,
}: CompetitiveResearchPageProps) {
  const [{ rows }, { columns, unconfigured }, params] = await Promise.all([
    loadCompetitiveResearch(),
    loadCompetitiveResearchColumns(),
    searchParams,
  ]);
  const demo = isDemoMode();

  const items: CompetitiveResearchItem[] = rows.map((entry) => ({
    entry,
    websiteHost: hostLabel(entry.website),
  }));

  const requested = params.entry;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CompetitiveResearchWorkspace
      columns={columns}
      unconfiguredColumns={unconfigured}
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
