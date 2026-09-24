# Ads to Launch — the media buyer's launch queue

PRD: §9 (the client track; client Approved "moves to the media buyer queue"; `launched` is the media
buyer's terminal state). New surface, built on the existing two-track model rather than a new one.

## Why this exists

Media buyers need one board of every client-approved ad that is ready to go live, and a record of
what went live recently. The status vocabulary for this already exists — `CLIENT_STATUS.launched` is
"set by the media buyer once the ad is live", and the state machine already has `approved → launched`.
So Ads to Launch is a VIEW over `creative_briefs` (client-approved, not yet launched), NOT a new table
or a new status enum. The three prompts' assumptions of a flat `approval_status` enum, `[brandSlug]`
routes and `agency_id` scoping were corrected to the real architecture (two-track state machine, flat
`/app/ads-to-launch`, `brand_id` via `withBrand`, a `*-source.ts` module — see the session notes).

## Phase 1 — schema + domain state  (DONE)

- `creative_briefs.launched_at` (timestamptz, null) and `launch_priority` (int, null). `launched_at`
  is the real moment of launch, not `updated_at` (which any edit bumps), so "Recently Launched (7
  days)" has an honest window; `launch_priority` is the media buyer's manual sort.
- `paused` added to `CLIENT_STATUS` as a media-buyer state after `launched`, with the reversible
  `launched ⇄ paused` loop in `CLIENT_TRANSITIONS`, a `warn` `chipTone`, and exclusion from the
  linear `CLIENT_TRACK_STEPS` (a branch off launched, like `revisions_needed` branches off pending).
- `paused` joins `launched` in `OFF_QUEUE_CLIENT_STATUSES`: both are the media buyer's states, so
  both are off the client-facing board — in the eligibility gate and the columns, by one list.

Migration: `drizzle/0033_ads_to_launch_fields.sql`, hand-written for exactly these two columns and
NOT run. `pnpm --filter @tas/db db:generate` could not produce an isolated migration because the
drizzle meta snapshots `0028`–`0032` are missing from `packages/db/drizzle/meta/`, so `generate`
diffs against the stale `0027` snapshot and re-emits five sprints of already-applied DDL (the
committed `TICKET-038c` junction refactor, platform-jsonb, briefs FKs). That meta gap predates this
work and is flagged for the human — see "Pending human verification" in the runbook.

## Phase 2 — source + page + action  (DONE, `6d00838`)

`/app/ads-to-launch`, in the sidebar's Approvals group (rocket icon), scoped to the active brand:

- **Ready to Launch**: client `approved`, `launched_at` null; `launch_priority` ascending with unset
  last (Postgres ASC default), then `updated_at` desc. Control: Mark as Launched.
- **Recently Launched**: client `launched` OR `paused`, `launched_at` within 7 days, newest first.
  Controls: Pause (launched) / Resume (paused). Paused rows are included deliberately — Resume is the
  only way back to live, and this is the page that draws it.
- Each row: generated creative and concept names in `font-mono`, format with a track icon, angle,
  `StatusChip` with the domain tone, `P<n>` priority, launch time (UTC), a Download link to the
  design file (PRD §11), and only the one control the state machine allows.

**Launch moves BOTH tracks to Launched** — PRD §9: "Launched needs to exist on the internal track too
… that's how our team knows a creative is finished." This also keeps the Overview's "Currently
live" tile (which counts internal `launched`) correct. Pause and resume are client-track only; the
internal track has no paused state. `launched_at` is set on launch and kept through pause/resume.

Built on the house patterns: `@tas/domain` `queue/launch-queue.ts` (status keys, 7-day window,
`launchTransition` / `launchQueueActionsFor` over `canTransitionClient`/`canTransitionInternal`;
`creative-status.ts` untouched); `@tas/db` `listLaunchQueue` and `transitionBriefLaunch`, a
compare-and-set through `withBrand` that applies only while the validated statuses still hold (so
double clicks and stale boards move a creative at most once, and never another brand's);
`ads-to-launch-source.ts` on the request connection; actions in the Client Queue's shape (demo
refusal, zod on the id only, target from the domain, rules checked against the stored row);
`loading.tsx`; a `/design-system` story (UI governance rule 4). No migration, no dependency.

Tests: domain 10, PGlite `@tas/db` 9, PGlite source 4, actions 11, projection 8.

Follow-ups, not built: setting `launch_priority` from the page (it is displayed, not editable — no
drag handle); a paused ad launched more than 7 days ago drops out of Recently Launched and can only be
resumed from elsewhere; notifications on launch (PRD §12 lists no launch trigger).

## Phase 3 — overview integration  (TODO)

Two dashboard cards reusing the phase-2 source: "Ads Ready to Launch" (count + 3 most recent) and
"Launched This Week".
