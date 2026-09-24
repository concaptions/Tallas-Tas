import { LaunchCardsSection } from '@/components/launch-cards';

/**
 * The Overview's launch cards (UI governance rule 4): the identical `LaunchCardsSection` the
 * Overview renders, fed the projection `buildLaunchCards` would produce — three PRD §7 creative
 * names in `font-mono` under the count, and the empty state a fresh brand shows.
 */
export function LaunchCardsStory() {
  return (
    <LaunchCardsSection
      cards={{
        readyCount: 3,
        readyNames: [
          'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
          'TS2-B2-Lux Meter-V1',
          'TV3-B1-Night Reset-V1',
        ],
        launchedThisWeek: 2,
      }}
    />
  );
}

export function LaunchCardsEmptyStory() {
  return <LaunchCardsSection cards={{ readyCount: 0, readyNames: [], launchedThisWeek: 0 }} />;
}
