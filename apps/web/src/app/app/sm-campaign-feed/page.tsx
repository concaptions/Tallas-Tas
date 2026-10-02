import { redirect } from 'next/navigation';

import { appPath } from '@/lib/routes';

/**
 * SM Campaign Feed is HIDDEN as of 2026-10-02: the Airtable TEMPLATE base `appnaSGAgOUbJ0f9m` became the
 * source of truth and has no table for it (`docs/audits/template-base-diff-2026-10-02.md`, "Drizzle
 * tables with no table in the template base").
 *
 * Hidden, not dropped. The `sm_campaign_feed_tasks` table, every query function over it, its demo fixtures and
 * this folder's workspace, panel, `fields.ts` and Server Actions are all untouched — only the
 * sidebar entry (`apps/web/src/components/shell/nav.ts`) is gone and this route redirects, so
 * nothing that was imported is lost and un-hiding the module is this file plus that section.
 * `docs/decisions/data-loss-blockers-2026-10-02.md` records what the table holds.
 *
 * `redirect` (307), NOT `permanentRedirect` (308). The hide is reversible by design, and a 308 is
 * cached indefinitely by browsers and intermediaries: anyone who opened this route once would keep
 * being bounced to the Overview after the module came back, until they cleared site data. The
 * legacy routes under `apps/web/src/app/app/briefs/` use 308 correctly, because that move is
 * permanent — the page really did move to `/app/creative-design`. This one is a hide, so the
 * redirect is temporary and a stale deep link still lands on the Overview rather than on a 404.
 */
export default function LegacySmCampaignFeedRedirect() {
  redirect(appPath);
}
