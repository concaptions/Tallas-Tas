import { StatusChip } from '@tas/ui';

import {
  creatorInitials,
  creatorTracks,
  identityLine,
  platformChipLabel,
  type CreatorCardRow,
} from './fields';

interface CreatorCardProps {
  readonly creator: CreatorCardRow;
}

/**
 * One creator in the roster grid (PRD §5.8). A CARD, never a table row: a creator is a person you
 * recognise by their face and their statuses, not a record you scan a column of.
 *
 * THE THREE TRACKS ARE LABELLED. PRD §9 and CLAUDE.md non-negotiable 10 split the workspace in two,
 * and the single most expensive mistake this page could make is letting somebody read an internal
 * status as the client's answer. So each chip sits under the name of its own review — Internal,
 * Client, Assets — rather than in an unlabelled row of three colours. The labels and tones come
 * from `creatorTracks`, which resolves both through `@tas/domain/state`; nothing here compares a
 * status to a literal or picks a colour.
 *
 * The avatar falls back to initials on `bg-surface3` when a creator has no picture (ticket
 * criterion 5) — a Fiverr booking often arrives with no usable headshot, and a broken image icon on
 * the one deployment anybody looks at is worse than a plain tile with two letters in it.
 *
 * Presentational and stateless, so the `/design-system` page mounts the identical element the grid
 * renders, and it takes `CreatorCardRow` rather than `CreatorListRow` so that preview can hand it a
 * plain object without importing `@tas/db`.
 */
export function CreatorCard({ creator }: CreatorCardProps) {
  const tracks = creatorTracks(creator);

  return (
    <article
      data-slot="creator-card"
      data-creator-id={creator.id}
      className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        {creator.profilePicUrl === null ? (
          <span
            data-slot="creator-avatar"
            data-fallback="initials"
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-card border border-line bg-surface3 font-mono text-sm text-text3"
          >
            {creatorInitials(creator.name)}
          </span>
        ) : (
          // A plain `img`, not `next/image`: the fixture pictures are inline `data:` URIs, the box
          // is a fixed 48px either way, and the image optimiser cannot fetch a data URI.
          <img
            data-slot="creator-avatar"
            src={creator.profilePicUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-card border border-line bg-surface3 object-cover"
          />
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-base font-semibold text-text" data-slot="creator-name">
            {creator.name}
          </h3>
          <p className="text-sm text-text2" data-slot="creator-identity">
            {identityLine(creator)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone="mute" label={platformChipLabel(creator.platform)} />
          </div>
        </div>
      </div>

      <dl className="flex flex-col gap-2 border-t border-line pt-3" data-slot="creator-tracks">
        {tracks.map((track) => (
          <div
            key={track.key}
            className="flex min-w-0 items-center gap-2"
            data-slot="creator-track"
            data-track={track.key}
          >
            <dt className="w-16 shrink-0 font-mono text-[10.5px] tracking-wide text-text3 uppercase">
              {track.label}
            </dt>
            <dd className="min-w-0">
              <StatusChip tone={track.tone} label={track.statusLabel} />
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
