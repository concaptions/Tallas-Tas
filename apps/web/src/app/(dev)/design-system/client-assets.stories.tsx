import { demoBriefs, demoClientAssetFolders } from '@tas/db';

import {
  ClientAssetsWorkspace,
  type ClientAssetFolderItem,
} from '@/app/app/client-assets/client-assets-workspace';
import { hostLabel } from '@/app/app/client-assets/fields';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { parentColumnsFor } from '@/lib/resolved-columns-source';

/**
 * The Client Assets route (CLAUDE.md UI governance rule 4): the identical `ClientAssetsWorkspace`
 * the page renders, over the demo fixtures, in demo mode. Nothing is re-drawn here — the grid with
 * its location link and linked-designs chip and the slide-over panel with its design chip picker
 * are the route's own components, mounted with the same server-computed items `page.tsx` builds.
 *
 * The panel is `fixed` to the viewport on the route; each story sits in a frame with layout
 * containment, which makes the frame the panel's containing block so the preview stays inside its
 * card instead of covering the design-system page.
 */

/** The reference instant the "Updated" column is read against, so this preview never drifts. */
const STORY_NOW = new Date('2026-09-17T09:00:00.000Z');

const STORY_ITEMS: readonly ClientAssetFolderItem[] = demoClientAssetFolders.map((folder) => ({
  folder,
  locationHost: hostLabel(folder.locationUrl),
  designCount: folder.briefIds.length,
  updatedLabel: relativeTime(folder.updatedAt, STORY_NOW),
  updatedTitle: absoluteTime(folder.updatedAt),
}));

const STORY_BRIEFS = demoBriefs.map(({ id, name }) => ({ id, name }));

function StoryFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-card border border-line bg-surface p-4 [contain:layout]">
      {children}
    </div>
  );
}

/** The grid: frozen name column with the propagation badge, description, location host, count chip. */
export function ClientAssetsGridStory() {
  return (
    <StoryFrame>
      <ClientAssetsWorkspace
        columns={parentColumnsFor('client_asset_folders')}
        items={STORY_ITEMS}
        briefs={STORY_BRIEFS}
        demo
        initialSelection={null}
        initialSearch=""
      />
    </StoryFrame>
  );
}

/**
 * The panel, open on the first fixture: the three typed fields read-only (the description a text
 * area), the Creative Designs chip picker with the folder's two links pressed, the count beside the
 * heading, and the demo footer in place of a save.
 */
export function ClientAssetPanelStory() {
  const [first] = demoClientAssetFolders;
  return (
    <StoryFrame>
      <ClientAssetsWorkspace
        columns={parentColumnsFor('client_asset_folders')}
        items={STORY_ITEMS}
        briefs={STORY_BRIEFS}
        demo
        initialSelection={first?.id ?? null}
        initialSearch=""
      />
    </StoryFrame>
  );
}
