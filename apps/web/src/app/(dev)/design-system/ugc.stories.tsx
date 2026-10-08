import { RatingStars } from '@tas/ui';

import { CreatorCard } from '@/app/app/ugc/creator-card';
import { PartnershipTable } from '@/app/app/ugc/partnership-table';
import { RatingWidget } from '@/app/app/ugc/rating-widget';
import {
  partnershipRow,
  type CreatorCardRow,
  type PartnershipSourceRow,
} from '@/app/app/ugc/fields';

/**
 * The three shapes the UGC Management route introduces (CLAUDE.md UI governance rule 4): the
 * creator card with its labelled three-track chip row, the avatar in both of its states, and the
 * partnership countdown at every expiry state including the highlight.
 *
 * Nothing is re-drawn here. `CreatorCard` and `PartnershipTable` are the route's own components,
 * mounted with plain objects rather than database rows, and every label, tone and countdown is
 * resolved by the same `@tas/domain` functions the page uses. A tone shown here is the tone the
 * page shows.
 */

/**
 * A stand-in headshot as an inline SVG data URI, the same shape `profile_pic_url` really holds in
 * demo mode. `hsl()` rather than hex because this is DATA standing in for an uploaded photo, not a
 * component — the token layer cannot reach inside an `<img src>`, and a remote placeholder would
 * render as a broken image on a machine with no network.
 */
const SAMPLE_AVATAR = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">' +
    '<rect width="96" height="96" rx="14" fill="hsl(26 15% 13%)"/>' +
    '<text x="48" y="49" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="system-ui, sans-serif" font-size="34" font-weight="600" ' +
    'fill="hsl(30 9% 54%)">DO</text></svg>',
)}`;

const SAMPLE_CREATORS: readonly CreatorCardRow[] = [
  {
    id: 'story-with-picture',
    name: 'Danielle Okonkwo',
    gender: 'Female',
    ageBracket: '25-34',
    platform: ['Direct Management'],
    profilePicUrl: SAMPLE_AVATAR,
    videoIntroUrl: null,
    internalCreatorStatus: 'approved',
    clientStatus: 'approved',
    internalAssetsStatus: 'approved',
    rawAssetsUrl: null,
    conceptIds: [],
    legacyConceptIds: [],
    productIds: [],
    ethnicity: 'Black Canadian',
    creatorLink: 'https://www.instagram.com/danielle.sleeps.late',
    shippingLocation: 'Hamilton, ON',
    trackingNumber: null,
    internalBrief: null,
    costUsd: 350,
    partnershipPricePer30Days: 750,
    paymentDate: new Date('2026-09-12T00:00:00.000Z'),
    creatorInfoRequest: 'Please send your shipping address and the handle to whitelist.',
    slackNotified: false,
  },
  {
    id: 'story-without-picture',
    name: 'Tomás Ferreira',
    gender: 'Male',
    ageBracket: '18-24',
    platform: ['Fiverr'],
    profilePicUrl: null,
    videoIntroUrl: null,
    internalCreatorStatus: 'pending_for_cs_approval',
    clientStatus: 'due_shipment',
    internalAssetsStatus: 'pending_for_cs_approval',
    rawAssetsUrl: null,
    conceptIds: [],
    legacyConceptIds: [],
    productIds: [],
    ethnicity: 'Brazilian',
    creatorLink: null,
    shippingLocation: null,
    trackingNumber: null,
    internalBrief: null,
    costUsd: null,
    partnershipPricePer30Days: null,
    paymentDate: null,
    creatorInfoRequest: null,
    slackNotified: false,
  },
];

/**
 * The card: picture or initials, name, gender and bracket, the platform as a mute chip, and the
 * three status tracks each under the name of the review it belongs to. The second card is the
 * fallback case — a creator sourced off a marketplace arrives with no usable headshot.
 */
export function CreatorCardStory() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SAMPLE_CREATORS.map((creator) => (
        <CreatorCard key={creator.id} creator={creator} />
      ))}
    </div>
  );
}

/** The reference instant the sample countdowns are read against, so this preview never drifts. */
const STORY_NOW = new Date('2026-09-17T09:00:00.000Z');

const SAMPLE_PARTNERSHIPS: readonly PartnershipSourceRow[] = [
  {
    id: 'story-expiring',
    name: 'Danielle Okonkwo',
    instagramUsername: '@danielle.sleeps.late',
    partnershipActivity: 'active',
    partnershipActivatedAt: new Date('2026-07-22T09:00:00.000Z'),
    partnershipPeriodDays: 60,
    extensionDays: 0,
  },
  {
    id: 'story-active',
    name: 'Marcus Delacroix',
    instagramUsername: '@marcus.after.midnight',
    partnershipActivity: 'active',
    partnershipActivatedAt: new Date('2026-07-09T09:00:00.000Z'),
    partnershipPeriodDays: 60,
    extensionDays: 30,
  },
  {
    id: 'story-expired',
    name: 'Priya Raghunathan',
    instagramUsername: '@priya.at.3am',
    partnershipActivity: 'ended',
    partnershipActivatedAt: new Date('2026-04-15T09:00:00.000Z'),
    partnershipPeriodDays: 30,
    extensionDays: 0,
  },
  {
    id: 'story-none',
    name: 'Hannah Whitcombe',
    instagramUsername: null,
    partnershipActivity: 'not_active',
    partnershipActivatedAt: null,
    partnershipPeriodDays: null,
    extensionDays: 0,
  },
];

/**
 * The table at all four expiry states: three days left (warn rule and tint, `data-near-expiry`),
 * twenty days left with the extension shown as its own term, a lapsed window reading Expired in the
 * `bad` tone, and a row that was never activated — muted, not coloured as though it were a problem.
 */
export function PartnershipCountdownStory() {
  return (
    <PartnershipTable rows={SAMPLE_PARTNERSHIPS.map((row) => partnershipRow(row, STORY_NOW))} />
  );
}

/**
 * The star primitive (Oct 8 Talal ask) in both of its forms: read-only rows at every value on the
 * scale, including unrated, and the editable `radiogroup` — arrow keys step, Home/End jump, Enter
 * or Space select. Filled stars are the `--warn` token; there is no other amber in the palette.
 */
export function RatingStarsStory() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        {[null, 1, 2, 3, 4, 5].map((value) => (
          <RatingStars key={value ?? 'unrated'} value={value} readOnly label="Sample" />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <RatingStars value={3} readOnly size="sm" label="Small" />
        <RatingStars value={4} onChange={() => undefined} label="Editable" />
        <RatingStars value={2} onChange={() => undefined} disabled label="Disabled" />
      </div>
    </div>
  );
}

/** The instant the rating receipts are read against, pinned so "3 days ago" never drifts. */
const RATING_STORY_NOW = new Date('2026-10-08T09:00:00.000Z');

/**
 * The panel's rating widget three ways: an admin editing an existing rating, an admin rating for
 * the first time, and a non-admin who sees the verdict read-only. The Clerk id in the receipt is
 * auto-generated system output, so it renders in `font-mono`. The Save posts to the real action,
 * which refuses in demo mode exactly as the panel's own Save does.
 */
export function RatingWidgetStory() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-card border border-line bg-surface p-4">
        <RatingWidget
          creatorId="story-rated"
          rating={4}
          note="Hit every deadline; the second hook needed one re-take."
          ratedAt={new Date('2026-10-05T14:30:00.000Z')}
          ratedBy="user_2nX8kQ3vTzYwLm9c"
          canRate
          now={RATING_STORY_NOW}
        />
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <RatingWidget
          creatorId="story-unrated"
          rating={null}
          note={null}
          ratedAt={null}
          ratedBy={null}
          canRate
          now={RATING_STORY_NOW}
        />
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <RatingWidget
          creatorId="story-read-only"
          rating={2}
          note="Late twice; assets arrived in the wrong aspect ratio."
          ratedAt={new Date('2026-09-28T11:00:00.000Z')}
          ratedBy="user_2nX8kQ3vTzYwLm9c"
          canRate={false}
          now={RATING_STORY_NOW}
        />
      </div>
    </div>
  );
}
