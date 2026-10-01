import { getTableCapability, type ViewType } from '@tas/domain';

import { loadBriefs } from '@/lib/briefs-source';
import { loadCreativeReports } from '@/lib/creative-reporting-source';
import { isDemoMode } from '@/lib/demo-mode';

import type { CreativeReportBriefOption } from './creative-reporting-panel';
import { CreativeReportingWorkspace } from './creative-reporting-workspace';
import { toCreativeReportItem } from './fields';

/**
 * Creative Reporting (Airtable "Creative Reporting", `tblgW4bwDSSeqihlr`; audit §2 row 14 and §14):
 * the hand-kept performance sheet the team fills per launched ad, internal only.
 *
 * A server component shaped exactly like the Products page. The rows come from
 * `loadCreativeReports()` — fixtures in demo mode, the brand-scoped query otherwise — already
 * carrying the brief name and the Difference CPA formula, so nothing is derived in a component; the
 * metric labels are formatted here, once, through `toCreativeReportItem`. The Creative picker's
 * options come from the briefs' own source (`loadBriefs`). Every piece of table state is a query
 * parameter: `?creativeReport=` for the open panel, `?q=` for the filter and `?view=` for the view
 * the capability allows.
 *
 * The relative timestamps are computed here with a single `now`, so server and client agree.
 */
interface CreativeReportingPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CAP = getTableCapability('creative-reporting');

export default async function CreativeReportingPage({ searchParams }: CreativeReportingPageProps) {
  const [{ rows }, briefRows, params] = await Promise.all([
    loadCreativeReports(),
    loadBriefs(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items = rows.map((row) => toCreativeReportItem(row, now));
  const briefOptions: CreativeReportBriefOption[] = briefRows.rows.map(({ id, name }) => ({
    id,
    name,
  }));

  const requested = params.creativeReport;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const supported = CAP?.supportedViews ?? ['grid'];
  const initialView: ViewType =
    typeof requestedView === 'string' && (supported as readonly string[]).includes(requestedView)
      ? (requestedView as ViewType)
      : 'grid';

  return (
    <CreativeReportingWorkspace
      items={items}
      briefOptions={briefOptions}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
    />
  );
}
