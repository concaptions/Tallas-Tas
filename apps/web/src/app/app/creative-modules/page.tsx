import { loadAngles } from '@/lib/angles-source';
import { loadBriefs } from '@/lib/briefs-source';
import { loadCreativeModules } from '@/lib/creative-modules-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { CreativeModulesWorkspace, type CreativeModuleItem } from './creative-modules-workspace';
import { hostLabel } from './fields';

/**
 * Creative Modules (Airtable "(Internal) Creative Modules", audit §2.4): the per-brand creative
 * patterns briefs are grouped under, each with a Foreplay board as its reference.
 *
 * A server component, shaped exactly like the Products page. The rows come from
 * `loadCreativeModules()`, which is the in-repo fixtures in demo mode and the brand-scoped query
 * otherwise; the page does not know which and does not branch on it. The two chip pickers in the
 * panel need the brand's angles and briefs, loaded through the same demo/live seam the Angles and
 * Creative Design pages use, so a picker never offers a record of another brand. Both pieces of
 * table state are query parameters — `?module=` for the open panel and `?q=` for the filter.
 *
 * Every derived value is computed here, once: the two link counts (Airtable's record-link counts,
 * never a stored column), the relative timestamp with a single `now` (a client that formatted it
 * itself would disagree with the server and break hydration) and the host of each board link, so
 * the grid never has to shorten a URL while it renders.
 */
interface CreativeModulesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CreativeModulesPage({ searchParams }: CreativeModulesPageProps) {
  const [{ rows }, angleResult, briefResult, params] = await Promise.all([
    loadCreativeModules(),
    loadAngles(),
    loadBriefs(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items: CreativeModuleItem[] = rows.map((creativeModule) => ({
    creativeModule,
    foreplayHost: hostLabel(creativeModule.foreplayLink),
    angleCount: creativeModule.angleIds.length,
    designCount: creativeModule.briefIds.length,
    updatedLabel: relativeTime(creativeModule.updatedAt, now),
    updatedTitle: absoluteTime(creativeModule.updatedAt),
  }));

  const angleOptions = angleResult.rows.map(({ id, name }) => ({ id, name }));
  const briefOptions = briefResult.rows.map(({ id, name }) => ({ id, name }));

  const requested = params.module;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CreativeModulesWorkspace
      items={items}
      angles={angleOptions}
      briefs={briefOptions}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
