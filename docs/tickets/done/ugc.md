# UGC Management · Creators and Partnership Ads (PRD §5.8, §5.8.1)

- Page: `/app/ugc`, sidebar section `ugc` (`href`-less today, so it renders with a `SoonChip`).
  Pattern: Themes for the grid, Copywriting for the table. Read-only: NO write, so no `DisabledWrite`
  — nothing on this page for demo mode to disable.

## Why

PRD §5.8: "Creators we hire, and the client approves them." §5.8.1: "Activation date + time period
(+ extension) = the date permission lapses… a manual 25-day Slack reminder… build it in properly."

## Acceptance criteria

1. `/app/ugc` renders inside the app shell with no frame, padding or background of its own, and the
   sidebar's UGC Management section is active on it (`ugcPath` added to `routes.ts` and `href` added
   to `nav.ts` in the same change, so its `SoonChip` is gone).
2. The page is two tabs and nothing else: **Creators** and **Partnership Ads**, from `@tas/ui`'s
   `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `data-slot="ugc-tabs"` on the root.
3. The tab is URL-backed as `?tab=creators|partnerships`. `page.tsx` reads it through `tabFromParam`
   in `fields.ts`, which narrows an unknown or missing value to `creators`; switching tabs writes it
   with `window.history.replaceState` as `themes-workspace.tsx` does (the default `creators`
   included), and a reload restores the tab.
4. Creators tab is a responsive grid of cards (`data-slot="creator-card"`), never a `<table>`, each
   on `rounded-card` + `border-line` carrying exactly four things: profile picture, name, gender,
   status chip.
5. The picture is a fixed-size avatar (`data-slot="creator-avatar"`) falling back to initials on
   `bg-surface3` when a creator has none — never a broken image.
6. The card status is PRD §5.8's client-facing Status track as a `StatusChip`, labels from
   `CREATOR_STATUS` in `@tas/domain/state` (no magic string, no inline status logic), in PRD order:
   Pending For Approval, Approved, Revisions Needed, Disapproved, Due Shipment, Filming In Progress,
   Video Delivered.
7. Partnership Ads tab is a `Table` from `@tas/ui` (`data-slot="partnership-table"`), one row per ad
   (`data-slot="partnership-row"`), columns: Creator Name, Instagram Username, Activity, Date of
   Partnership Activation, Expires, Days Left.
8. `PARTNERSHIP_ACTIVITY` (Active / Not Active / Ended) lives in `@tas/domain/state` beside
   `CREATOR_STATUS` and renders as a `StatusChip`; the Activity cell writes no label of its own.
9. Expiry is pure functions in `packages/domain`, never a component or a query:
   `partnershipExpiresOn({ activatedOn, periodDays, extensionDays })` gives the lapse date,
   `daysUntilPartnershipExpiry(row, now)` the whole days left (negative once lapsed), and
   `isPartnershipNearExpiry` is `0 <= daysLeft <= PARTNERSHIP_REMINDER_DAYS = 25` (the Gratsi
   reminder, one constant, exported from the same module).
10. Days Left shows the countdown in `font-mono`. A near-expiry row carries `data-near-expiry="true"`
    and is highlighted in the **warn** tone through the token layer (`text-warn` plus a warn-tinted
    background from the variables `StatusChip` uses, no hex). A lapsed row reads "Expired".
11. `now` is resolved once on the server in `page.tsx` and passed down, so no hydration mismatch.
12. `demoCreators` in `demo-data.ts` has **5 creators**, hardcoded uuids, a mix of genders, three or
    more different `CREATOR_STATUS` values, one with no picture (criterion 5).
13. `demoPartnershipAds` has **3 rows**, each linked to one of those creators: one **expiring in 3
    days** (near expiry, highlighted), one far from expiry, one Ended. The 3-day row's activation
    derives from the same `now`, so the countdown reads 3 on any day.
14. `loadUgc()` in `apps/web/src/lib/ugc-source.ts` copies `personas-source.ts` exactly: demo mode
    returns `{ creators, partnerships }` from the `@tas/db` fixtures and builds **no** database client
    even when `DATABASE_URL` is set, live mode opens Neon per call and closes it in a `finally`, and a
    connect-spy unit test proves the demo branch never calls `connect`.
15. `listCreators(db, brandId)` / `listPartnershipAds(db, brandId)` are brand-scoped through
    `withBrand` like `listPersonas`; PGlite tests assert another brand's rows are invisible.
16. Colours go through the token layer only (no hex), rounded surfaces use `rounded-card` /
    `rounded-input`, no button is `rounded-full`, every status label is a `StatusChip`.
17. `tsc --noEmit` and vitest are clean for `@tas/web`, `@tas/db`, `@tas/domain`, and
    `apps/web/e2e/ugc.spec.ts` covers: both tabs render; five creator cards with
    picture/name/gender/status; clicking Partnership Ads sets `?tab=partnerships` and reload keeps it;
    three rows; exactly one with `data-near-expiry="true"` reading 3 days.

Out of scope: the two internal status tracks, a creator detail panel, creating or editing anything,
Continue Working With / Extension / price, notes, shipping, raw assets, links, filters, search, sort.

## Files each agent touches

- domain: `packages/domain/src/state/creator-status.ts`, `state/index.ts`,
  `packages/domain/src/ugc/partnership-expiry.ts`, their `.test.ts`, `packages/domain/src/index.ts`
- schema/db: `packages/db/src/schema/{enums,creators,partnership-ads,index}.ts`, a generated migration
  in `packages/db/drizzle`, `packages/db/src/{demo-data,creators,index,seed}.ts`, `creators.test.ts`
- app: `apps/web/src/lib/ugc-source.ts` + `ugc-source.test.ts`, `routes.ts` (`ugcPath`),
  `components/shell/nav.ts`, and `app/app/ugc/{page,ugc-workspace,creator-card,partnership-table}.tsx`
  plus `fields.ts` + `fields.test.ts`
- qa: `apps/web/e2e/ugc.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); db tests run on PGlite.
