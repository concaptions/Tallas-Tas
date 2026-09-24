import { RECENTLY_LAUNCHED_DAYS } from '@tas/domain/state';

import { loadAdsToLaunch } from '@/lib/ads-to-launch-source';
import { currentBrand } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { briefPath } from '@/lib/routes';

import { launchCountLabel, launchQueueItem, type LaunchQueueItem } from './fields';
import { LaunchQueueRow } from './launch-queue-row';

/**
 * Ads to Launch (PRD §11, §13; ticket `ads-to-launch` Phase 2): the media buyer's queue. "When there
 * are approved creatives by a client … the media should see ADS TO LAUNCH" — every creative the
 * client signed off and nobody has launched yet, the media buyer's priority first, and below it what
 * went live (or was paused) in the last week, where Pause and Resume live.
 *
 * A server component in the shape of the queue pages: `loadAdsToLaunch()` is the fixtures in demo
 * mode and the brand-scoped read otherwise, the brand comes from the session, and every label, tone
 * and control is resolved here by `launchQueueItem` so the client row never imports `@tas/db`.
 */
export const metadata = {
  title: 'Ads to Launch — TAS Creative Platform',
};

interface LaunchSectionProps {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly empty: string;
  readonly items: readonly LaunchQueueItem[];
  readonly demo: boolean;
}

function LaunchSection({ id, title, note, empty, items, demo }: LaunchSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-sm font-medium text-text2">
          {title}
        </h2>
        <span className="font-mono text-xs text-text3">
          {launchCountLabel(items.length, 'creative')}
        </span>
      </div>
      <p className="text-xs text-text3">{note}</p>
      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-8 text-center text-sm text-text3">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <LaunchQueueRow key={item.id} item={item} demo={demo} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdsToLaunchPage() {
  const demo = isDemoMode();
  const [{ ready, recent }, brand] = await Promise.all([loadAdsToLaunch(), currentBrand()]);

  const readyItems = ready.map((row) => launchQueueItem(row, briefPath(row.id)));
  const recentItems = recent.map((row) => launchQueueItem(row, briefPath(row.id)));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Approvals</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Ads to Launch</h1>
        <p className="text-sm text-text2">
          {brand === null ? 'No brand yet.' : brand.name}
          {' · '}
          {launchCountLabel(readyItems.length, 'ad')} waiting to launch
        </p>
      </header>

      <LaunchSection
        id="ready-to-launch"
        title="Ready to Launch"
        note="Signed off by the client and not launched yet. Priority first, then the newest."
        empty="Nothing is waiting. Creatives appear here once the client approves them."
        items={readyItems}
        demo={demo}
      />

      <LaunchSection
        id="recently-launched"
        title="Recently Launched"
        note={`Live or paused, launched in the last ${String(RECENTLY_LAUNCHED_DAYS)} days. Most recent first.`}
        empty={`Nothing launched in the last ${String(RECENTLY_LAUNCHED_DAYS)} days.`}
        items={recentItems}
        demo={demo}
      />
    </div>
  );
}
