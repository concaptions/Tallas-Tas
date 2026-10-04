import {
  demoCampaigns,
  demoCollections,
  demoCopyTypes,
  demoProducts,
  demoYoutubeCopy,
} from '@tas/db';
import { COPY_STATUS, copyStatusLabel, copyStatusTone } from '@tas/domain/state';
import { StatusChip } from '@tas/ui';

import { buildYoutubeCopyItems } from '@/app/app/youtube-copywriting/build-items';
import { copyNumberLabel } from '@/app/app/youtube-copywriting/fields';
import { YoutubeCopywritingWorkspace } from '@/app/app/youtube-copywriting/youtube-copywriting-workspace';
import { parentColumnsFor } from '@/lib/resolved-columns-source';

/**
 * The shapes the YouTube Copywriting route introduces (CLAUDE.md UI governance rule 4), mounted as
 * the product mounts them: the whole workspace — grid, kanban, search and the slide-over panel a row
 * click opens — over the demo fixtures, the generated Copy # title, and the five status chips as
 * the grid renders them.
 *
 * A server module, like `role-dashboard.stories.tsx`: it reads the fixtures from `@tas/db` and hands
 * the client workspace plain items built by the route's own `buildYoutubeCopyItems` — lookup cells
 * included (GRATSI-MATCH, 2026-10-04) — with one fixed `now` so the relative timestamps on this
 * page never change between renders.
 */
const STORY_NOW = new Date('2026-09-18T09:00:00.000Z');

/** The identical workspace `/app/youtube-copywriting` renders, in demo mode over the fixtures. */
export function YoutubeCopyGridStory() {
  return (
    <YoutubeCopywritingWorkspace
      columns={parentColumnsFor('youtube_copy')}
      items={buildYoutubeCopyItems(
        demoYoutubeCopy,
        demoCollections.map(({ id, productName }) => ({ id, productName })),
        STORY_NOW,
      )}
      collections={demoCollections.map(({ id, name }) => ({ id, name }))}
      products={demoProducts.map(({ id, name }) => ({ id, name }))}
      campaigns={demoCampaigns.map(({ id, name, code }) => ({ id, name, code }))}
      copyTypes={demoCopyTypes.map(({ id, name }) => ({ id, name }))}
      demo
      initialSelection={null}
      initialSearch=""
    />
  );
}

/** The auto-generated title in `font-mono`, complete and before a number is assigned. */
export function YoutubeCopyNumberStory() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="font-mono text-sm font-medium text-text">{copyNumberLabel(3)}</span>
      <span className="font-mono text-sm font-medium text-text3">{copyNumberLabel(null)}</span>
    </div>
  );
}

/** The five `COPY_STATUS` chips as the grid, the kanban and the panel render them. */
export function YoutubeCopyStatusChipsStory() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COPY_STATUS.map((entry) => (
        <StatusChip
          key={entry.key}
          tone={copyStatusTone(entry.key)}
          label={copyStatusLabel(entry.key)}
        />
      ))}
    </div>
  );
}
