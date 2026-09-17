import { isDemoMode } from '@/lib/demo-mode';
import { loadUgc } from '@/lib/ugc-source';

import { partnershipRow, tabFromParam, type CreatorCardRow, type PartnershipRow } from './fields';
import { UgcWorkspace } from './ugc-workspace';

/**
 * UGC Management (PRD §5.8): "Creators we hire, and the client approves them", with §5.8.1's
 * whitelisting partnerships on the same records.
 *
 * A server component, shaped exactly like the Personas, Themes and Copywriting pages. Both lists
 * come from one `loadUgc()` call — the in-repo fixtures in demo mode, the brand-scoped queries
 * otherwise — and the page does not know which and does not branch on it. It renders into the
 * shell's `<main>` and therefore owns no frame, padding or background of its own.
 *
 * `now` IS RESOLVED ONCE, HERE, and only here. Everything §5.8.1 shows about a partnership — the
 * lapse date, the countdown, the near-expiry highlight — is `now` applied to three stored columns,
 * so a client component that read its own clock would render a different countdown from the
 * server's and break hydration on the one row that matters. `loadUgc()` returns the instant
 * alongside the rows: the pinned `PARTNERSHIP_REFERENCE_DATE` in demo mode, so "3 days left" reads
 * the same on any day the demo is opened, and the real clock in live mode.
 *
 * EVERYTHING ELSE IS RESOLVED HERE TOO. `@/lib/ugc-source` imports `@tas/db`, so it can only be
 * read on the server; the status labels, chip tones, dates and countdown words are all resolved
 * through `@tas/domain` by `partnershipRow` and `creatorTracks` before the client components see a
 * row, and those components never import the database driver.
 *
 * Both view parameters are read here: `?tab=` narrowed by `tabFromParam` to the known vocabulary,
 * and `?q=` passed through. The rows arrive newest edit first, so this page never sorts.
 */
interface UgcPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UgcPage({ searchParams }: UgcPageProps) {
  const [{ creators, partnerships, now }, params] = await Promise.all([loadUgc(), searchParams]);
  const demo = isDemoMode();

  const cards: CreatorCardRow[] = creators.map((row) => ({
    id: row.id,
    name: row.name,
    gender: row.gender,
    ageBracket: row.ageBracket,
    platform: row.platform,
    profilePicUrl: row.profilePicUrl,
    internalCreatorStatus: row.internalCreatorStatus,
    clientStatus: row.clientStatus,
    internalAssetsStatus: row.internalAssetsStatus,
  }));

  const rows: PartnershipRow[] = partnerships.map((row) => partnershipRow(row, now));

  const requestedTab = params.tab;
  const initialTab = tabFromParam(typeof requestedTab === 'string' ? requestedTab : null);

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <UgcWorkspace
      creators={cards}
      partnerships={rows}
      demo={demo}
      initialTab={initialTab}
      initialSearch={initialSearch}
    />
  );
}
