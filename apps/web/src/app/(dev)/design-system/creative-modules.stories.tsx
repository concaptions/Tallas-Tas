import { demoAngles, demoBriefs, demoCreativeModules } from '@tas/db';

import {
  CreativeModulesWorkspace,
  type CreativeModuleItem,
} from '@/app/app/creative-modules/creative-modules-workspace';
import { hostLabel } from '@/app/app/creative-modules/fields';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

/**
 * The Creative Modules route (CLAUDE.md UI governance rule 4): the identical `CreativeModulesWorkspace`
 * the page renders, over the demo fixtures, in demo mode. Nothing is re-drawn here — the grid with
 * its two link-count chips and the slide-over panel with its two chip pickers are the route's own
 * components, mounted with the same server-computed items `page.tsx` builds.
 *
 * The panel is `fixed` to the viewport on the route; each story sits in a frame with layout
 * containment, which makes the frame the panel's containing block so the preview stays inside its
 * card instead of covering the design-system page.
 */

/** The reference instant the "Updated" column is read against, so this preview never drifts. */
const STORY_NOW = new Date('2026-09-17T09:00:00.000Z');

const STORY_ITEMS: readonly CreativeModuleItem[] = demoCreativeModules.map((creativeModule) => ({
  creativeModule,
  foreplayHost: hostLabel(creativeModule.foreplayLink),
  angleCount: creativeModule.angleIds.length,
  designCount: creativeModule.briefIds.length,
  updatedLabel: relativeTime(creativeModule.updatedAt, STORY_NOW),
  updatedTitle: absoluteTime(creativeModule.updatedAt),
}));

const STORY_ANGLES = demoAngles.map(({ id, name }) => ({ id, name }));
const STORY_BRIEFS = demoBriefs.map(({ id, name }) => ({ id, name }));

function StoryFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-card border border-line bg-surface p-4 [contain:layout]">
      {children}
    </div>
  );
}

/** The grid: frozen name column with the propagation badge, host of the board link, two count chips. */
export function CreativeModulesGridStory() {
  return (
    <StoryFrame>
      <CreativeModulesWorkspace
        items={STORY_ITEMS}
        angles={STORY_ANGLES}
        briefs={STORY_BRIEFS}
        demo
        initialSelection={null}
        initialSearch=""
      />
    </StoryFrame>
  );
}

/**
 * The panel, open on the first fixture: the two typed fields read-only, the Angles and Creative
 * Designs chip pickers with the module's links pressed, the counts beside each heading, and the
 * demo footer in place of a save.
 */
export function CreativeModulePanelStory() {
  const [first] = demoCreativeModules;
  return (
    <StoryFrame>
      <CreativeModulesWorkspace
        items={STORY_ITEMS}
        angles={STORY_ANGLES}
        briefs={STORY_BRIEFS}
        demo
        initialSelection={first?.id ?? null}
        initialSearch=""
      />
    </StoryFrame>
  );
}
