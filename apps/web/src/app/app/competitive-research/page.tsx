import { isDemoMode } from '@/lib/demo-mode';
import { loadCompetitiveResearch } from '@/lib/competitive-research-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

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
 * otherwise; the page does not know which and does not branch on it. Both pieces of table state are
 * query parameters — `?entry=` for the open panel and `?q=` for the filter — so a refresh restores
 * the view and either one is shareable as a link. It renders into the shell's `<main>` and owns no
 * frame, padding or background of its own.
 *
 * Both derived strings are computed here, once: the relative timestamp with a single `now` (a client
 * that formatted it itself would disagree with the server and break hydration) and the host of the
 * website link, so the table never has to shorten a URL while it renders.
 */
interface CompetitiveResearchPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CompetitiveResearchPage({
  searchParams,
}: CompetitiveResearchPageProps) {
  const [{ rows }, params] = await Promise.all([loadCompetitiveResearch(), searchParams]);
  const demo = isDemoMode();
  const now = new Date();

  const items: CompetitiveResearchItem[] = rows.map((entry) => ({
    entry,
    websiteHost: hostLabel(entry.website),
    updatedLabel: relativeTime(entry.updatedAt, now),
    updatedTitle: absoluteTime(entry.updatedAt),
  }));

  const requested = params.entry;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CompetitiveResearchWorkspace
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
