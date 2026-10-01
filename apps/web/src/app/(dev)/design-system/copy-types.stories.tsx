import { demoCopyTypes } from '@tas/db';

import { CopyTypesWorkspace, type CopyTypeItem } from '@/app/app/copy-types/copy-types-workspace';
import { descriptionPreview, linkedCopyLabel } from '@/app/app/copy-types/fields';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

/**
 * The Copy Types route (CLAUDE.md UI governance rule 4): the identical `CopyTypesWorkspace` the page
 * renders, over the demo fixtures, in demo mode. Nothing is re-drawn here — the grid with its two
 * link-count chips and the slide-over panel with its two read-only copy lists are the route's own
 * components, mounted with the same server-computed items `page.tsx` builds.
 *
 * The panel is `fixed` to the viewport on the route; each story sits in a frame with layout
 * containment, which makes the frame the panel's containing block so the preview stays inside its
 * card instead of covering the design-system page.
 */

/** The reference instant the "Updated" column is read against, so this preview never drifts. */
const STORY_NOW = new Date('2026-09-17T09:00:00.000Z');

const STORY_ITEMS: readonly CopyTypeItem[] = demoCopyTypes.map((copyType) => ({
  copyType,
  descriptionPreview: descriptionPreview(copyType.description),
  metaCopies: copyType.metaCopies.map(linkedCopyLabel),
  youtubeCopies: copyType.youtubeCopies.map(linkedCopyLabel),
  updatedLabel: relativeTime(copyType.updatedAt, STORY_NOW),
  updatedTitle: absoluteTime(copyType.updatedAt),
}));

function StoryFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-card border border-line bg-surface p-4 [contain:layout]">
      {children}
    </div>
  );
}

/** The grid: frozen name column with the propagation badge, the description's first line, two count chips. */
export function CopyTypesGridStory() {
  return (
    <StoryFrame>
      <CopyTypesWorkspace items={STORY_ITEMS} demo initialSelection={null} initialSearch="" />
    </StoryFrame>
  );
}

/**
 * The panel, open on the first fixture: Name and Description read-only, the Meta and YouTube copy
 * lists with the count beside each heading, and the demo footer in place of a save.
 */
export function CopyTypePanelStory() {
  const [first] = demoCopyTypes;
  return (
    <StoryFrame>
      <CopyTypesWorkspace
        items={STORY_ITEMS}
        demo
        initialSelection={first?.id ?? null}
        initialSearch=""
      />
    </StoryFrame>
  );
}
