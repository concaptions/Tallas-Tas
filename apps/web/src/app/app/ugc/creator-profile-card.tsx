'use client';

import { useEffect, useRef, useState } from 'react';
import { RatingStars } from '@tas/ui';

import { creatorInitials, EM_DASH } from './fields';

export interface CreatorProfileCardProps {
  readonly name: string;
  readonly profilePicUrl: string | null;
  readonly instagramUsername: string | null | undefined;
  /** The agency's 1–5 verdict for this brand, as a read-only strip; `null` renders "Not rated yet". */
  readonly rating: number | null | undefined;
}

/**
 * The prominent, bordered card at the top of the creator panel (Ticket 14): the profile picture or
 * initials, the creator's name, their @handle in `font-mono`, and a read-only `RatingStars` strip
 * when the agency has rated them. The editable rating lives in the "Performance rating" section
 * below — this one is a glanceable summary, so the identity, the handle and the current verdict read
 * together without scrolling.
 *
 * Dead URL safety matches the frozen name cell (AI-26): a stored link that answers an error flips to
 * initials rather than keeping a broken image. The same `creatorInitials` helper is used, so one
 * `?` fallback governs an unnamed row everywhere.
 */
export function CreatorProfileCard({
  name,
  profilePicUrl,
  instagramUsername,
  rating,
}: CreatorProfileCardProps) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement | null>(null);
  // A URL that died BEFORE hydration never fires onError at React: by the time the handler attaches
  // the error is history. Read what the element already knows — complete with no pixels is a failure.
  useEffect(() => {
    const node = image.current;
    if (node !== null && node.complete && node.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  const handle =
    instagramUsername === null || instagramUsername === undefined || instagramUsername.trim() === ''
      ? EM_DASH
      : `@${instagramUsername.replace(/^@/, '')}`;

  const avatar =
    profilePicUrl === null || failed ? (
      <span
        data-slot="profile-card-avatar"
        data-fallback="initials"
        aria-hidden="true"
        className="flex size-20 shrink-0 items-center justify-center rounded-card border border-line bg-surface3 font-mono text-lg text-text3"
      >
        {creatorInitials(name)}
      </span>
    ) : (
      <img
        ref={image}
        data-slot="profile-card-avatar"
        src={profilePicUrl}
        alt=""
        width={80}
        height={80}
        className="size-20 shrink-0 rounded-card border border-line bg-surface3 object-cover"
        onError={() => {
          setFailed(true);
        }}
      />
    );

  return (
    <section
      data-slot="creator-profile-card"
      aria-label="Creator profile"
      className="flex items-center gap-4 rounded-card border border-line bg-surface2 px-4 py-3 sm:px-5"
    >
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className="truncate text-base font-semibold text-text"
          data-slot="profile-card-name"
          title={name}
        >
          {name}
        </p>
        <p className="truncate font-mono text-xs text-text3" data-slot="profile-card-handle">
          {handle}
        </p>
        <div className="mt-0.5" data-slot="profile-card-rating">
          <RatingStars
            value={rating ?? null}
            readOnly
            size="sm"
            label={`${name} performance rating`}
          />
        </div>
      </div>
    </section>
  );
}
