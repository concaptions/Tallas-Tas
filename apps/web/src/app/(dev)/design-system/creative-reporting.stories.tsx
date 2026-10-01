import { demoBriefs, demoCreativeReports } from '@tas/db';
import { StatusChip } from '@tas/ui';

import { CreativeReportingWorkspace } from '@/app/app/creative-reporting/creative-reporting-workspace';
import { differenceCpaView, toCreativeReportItem } from '@/app/app/creative-reporting/fields';

/**
 * The Creative Reporting module on the design-system page (CLAUDE.md UI governance rule 4): the
 * identical `CreativeReportingWorkspace` the route renders over the demo fixtures, plus the two
 * tones the Difference CPA formula can take. A server module, so the fixtures come straight from
 * `@tas/db` and never reach the browser bundle; the workspace receives plain data. Click a row to
 * open the same panel the route opens.
 */
const STORY_NOW = new Date('2026-09-20T12:00:00.000Z');

const ITEMS = demoCreativeReports.map((row) => toCreativeReportItem(row, STORY_NOW));
const BRIEF_OPTIONS = demoBriefs.map(({ id, name }) => ({ id, name }));

/** The grid: frozen name, mono brief name, right-aligned metrics, the formula as a chip. */
export function CreativeReportingGridStory() {
  return (
    <CreativeReportingWorkspace
      items={ITEMS}
      briefOptions={BRIEF_OPTIONS}
      demo
      initialSelection={null}
      initialSearch=""
    />
  );
}

/** Difference CPA at, under and over target: ok up to zero, bad above it, the dash when unset. */
export function CreativeReportDifferenceCpaStory() {
  const samples: readonly { heading: string; difference: number | null }[] = [
    { heading: 'Under target', difference: -2.2 },
    { heading: 'On target', difference: 0 },
    { heading: 'Over target', difference: 2.5 },
    { heading: 'No target yet', difference: null },
  ];
  return (
    <div className="flex flex-wrap gap-6" data-slot="creative-report-difference-cpa-chips">
      {samples.map((sample) => {
        const view = differenceCpaView(sample.difference);
        return (
          <div key={sample.heading} className="flex flex-col gap-2">
            <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              {sample.heading}
            </span>
            {view === null ? (
              <span className="font-mono text-sm text-text4">—</span>
            ) : (
              <StatusChip tone={view.tone} label={view.label} />
            )}
          </div>
        );
      })}
    </div>
  );
}
