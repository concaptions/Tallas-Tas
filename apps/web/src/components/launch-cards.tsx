import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tas/ui';

import { Icon } from '@/components/shell/icons';
import type { LaunchCards } from '@/lib/dashboard-source';
import { adsToLaunchPath } from '@/lib/routes';

/**
 * The Overview's two launch cards (PRD §13: "when there are approved creatives by a client … the
 * media should see ADS TO LAUNCH"; ticket `ads-to-launch` Phase 3). Same `Card` shape and grid as the
 * role tiles beside them; no business logic — `buildLaunchCards` decided every number and name.
 * The names are generated PRD §7 creative names, so they render in `font-mono` (UI governance).
 */
export function LaunchCardsSection({ cards }: { readonly cards: LaunchCards }) {
  return (
    <section
      aria-labelledby="launch-heading"
      data-slot="launch-cards"
      className="flex flex-col gap-3"
    >
      <h2 id="launch-heading" className="text-sm font-medium text-text2">
        Launch
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li>
          <Link href={adsToLaunchPath} className="block h-full rounded-card">
            <Card
              data-slot="launch-ready-card"
              className="h-full gap-3 py-4 transition-colors hover:border-accent-line"
            >
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm text-text2">
                  <Icon name="launch" className="size-4 text-text3" />
                  Ads Ready to Launch
                </CardTitle>
                <CardDescription className="text-xs text-text3">
                  Signed off by the client, not launched yet.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <p className="font-mono text-3xl leading-none text-text">{cards.readyCount}</p>
                {cards.readyNames.length === 0 ? (
                  <p className="mt-2 text-[11px] text-text3">Nothing waiting. Open the queue</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-1">
                    {cards.readyNames.map((name) => (
                      <li key={name} className="truncate font-mono text-xs text-text2">
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </Link>
        </li>
        <li>
          <Link href={adsToLaunchPath} className="block h-full rounded-card">
            <Card
              data-slot="launched-week-card"
              className="h-full gap-3 py-4 transition-colors hover:border-accent-line"
            >
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm text-text2">
                  <Icon name="check" className="size-4 text-text3" />
                  Launched This Week
                </CardTitle>
                <CardDescription className="text-xs text-text3">
                  Went live in the last seven days, paused or not.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <p className="font-mono text-3xl leading-none text-text">
                  {cards.launchedThisWeek}
                </p>
                <p className="mt-2 text-[11px] text-text3">Open the queue</p>
              </CardContent>
            </Card>
          </Link>
        </li>
      </ul>
    </section>
  );
}
