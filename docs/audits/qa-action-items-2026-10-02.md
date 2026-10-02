# QA: status of all 69 Sep 28 action items (2026-10-02)

Source of the items: `/Users/macbook/Downloads/action_items.md` — "TAS Digital Dev Sync — Action
Items (Sep 28)", 69 numbered items in three batches. The batch and section headings below are that
file's own. Item text is abbreviated; the numbers and the section a number sits under are verbatim.

Repository audited: `/Users/macbook/tallas-tas`, branch `main` at `d5fd450`, working tree clean.
Read-only audit: no source file was changed, nothing was committed, no migration was applied and no
database was written.

## How to read the status column

- **DONE** — a commit on `main` implements it. The row gives the short SHA **and** the file. A claim
  with no SHA is not DONE.
- **PARTIAL** — part of it is on `main`; the row names the missing piece as a file and says what is
  absent from it.
- **NOT STARTED** — nothing implements it; the row names the file or route it would land in.
- **UNCLEAR** — the wording determines no observable outcome; the row says what is ambiguous.
- **BLOCKED-ON-TALAL** — needs a product decision before it can be built. Listed, not touched. The
  numbered questions are in the last section.

Some commit subjects do not describe their contents (for example `8fb2b72 feat: add Airtable table
schema display` is the commit that adds `packages/db/src/r2.ts`, `packages/db/src/url-migration.ts`
and `packages/db/src/scripts/migrate-airtable-urls.ts`). SHAs below were taken from
`git log --diff-filter=A -- <path>` and `git log -S"<symbol>"`, so they are the commit that actually
introduced the named code, not the commit whose subject reads best.

## What I could not establish

- **Whether migration `0039_gratsi-field-parity.sql` has been applied to the production database.**
  The migration file and its journal entry (`packages/db/drizzle/meta/_journal.json`, idx 39) are on
  `main` at `66d8ed7`. I attempted a read-only `information_schema.columns` query against
  `DATABASE_URL` and the sandbox refused the production read. I could not establish it, so every row
  that depends on those seven columns (`angles.status`, `concepts.description`,
  `concepts.pain_points`, `concepts.usp`, `concepts.client_comments`, `creators.payment_date`,
  `creators.creator_info_request`) says so rather than assuming either answer. The same applies to
  migrations 0040–0043.
- **Why creator profile images were missing from the first import (item 26).** The mapping that
  reads them exists now, but no root cause is recorded in `docs/decisions.md`,
  `docs/decisions/`, `docs/audits/` or any commit message I read. I could not establish it.
- **Which of the two Gratsi bases is the correct one.** The item records that as confirmed in the
  meeting; the repository resolves tables by name against whichever base id is passed on the command
  line (`packages/db/src/scripts/airtable-fetch.ts:54`), so the confirmation is not checkable from
  the code.
- **What "the other client's platform Usama showed" looks like** (items 47, 53). No screenshot,
  spec, URL or ticket in the repository describes it.

Credentials: `/Users/macbook/Tallas Tas/.env.local` holds four variable names —
`AIRTABLE_PAT`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. It holds no
`R2_*`, no `ANTHROPIC_API_KEY`, no `META_*`, no `SLACK_*`, no `RESEND_*`. No value was read, copied
or printed. Several rows below note a feature that is coded but cannot be exercised here for that
reason; that is a credential gap, not a missing implementation.

---

## Summary

| Status | Count | Items |
| --- | --- | --- |
| DONE | 27 | 1, 5, 7, 10, 11, 12, 14, 15, 19, 20, 21, 23, 24, 25, 28, 29, 31, 36, 38, 40, 41, 45, 46, 50, 51, 56, 58 |
| PARTIAL | 27 | 2, 3, 6, 8, 9, 13, 16, 17, 18, 22, 26, 27, 30, 32, 34, 35, 42, 49, 52, 54, 55, 57, 64, 65, 66, 67, 68 |
| NOT STARTED | 4 | 37, 48, 53, 59 |
| UNCLEAR | 2 | 47, 69 |
| BLOCKED-ON-TALAL | 9 | 4, 33, 39, 43, 44, 60, 61, 62, 63 |
| **Total** | **69** | |

Of the owner's nine pinned blockers, eight are confirmed blocked (33, 39, 43, 44, 60, 61, 62, 63)
and one is not: **item 30 (image storage) is already wired** and is reported PARTIAL. One further
item is added to the blocked list: **item 4**, because only Talal can say which imported tables TAS
does not need. Details in the last section.

---

## Batch 1 — 0:00 to 25:00

### Org, auth & data setup

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 1 | Keep a single organization, TAS Digital; no multi-org | **DONE** | `docs/decisions.md` D-003 ("One Clerk Organization represents the agency (TAS Digital). Brands are rows in our database, never Clerk orgs"), added in `a48eee3`. `apps/web/src/lib/ensure-organization.ts:13` creates one org per signed-in user and returns early when `session.orgId` is set (`e6ef122`); brands are rows in `packages/db/src/schema/brands.ts`. | — |
| 2 | Expand roles beyond Member/Admin, with access control | **PARTIAL** | Six brand roles exist: `packages/domain/src/roles.ts:11-19` (`csm`, `strategist`, `video_editor`, `designer`, `media_buyer`, `client`) with labels at `:53-60` (`0961137`). Access control is enforced in exactly two places: `canSeeTeamPage` / `TEAM_ACCESS_ROLES` in `packages/domain/src/team/access.ts:28` used by `apps/web/src/app/app/team/page.tsx:1` (`554421c`), and `requireAdmin` in `apps/web/src/app/app/propagation/custom-field-actions.ts:69`. | Missing: `apps/web/src/components/shell/nav.ts:68` — `NAV_GROUPS` is a static constant with no role parameter, so every role sees every module; and no `/app/<module>/page.tsx` carries a role check. Smallest step: give `NAV_GROUPS` a role argument in `apps/web/src/components/shell/nav.ts` and filter it in `apps/web/src/components/shell/sidebar.tsx` from the role `loadActiveRole()` already resolves. |
| 3 | Remove the per-client AdSpy table, rebuild as a separate tab | **PARTIAL** | The tab exists: `apps/web/src/components/shell/nav.ts:222` (`{ key: 'ad-spy', label: 'Ad Spy', … href: adSpyPath }`) → `apps/web/src/app/app/ad-spy/page.tsx` (`0083dcc`). | Still per-client: `packages/db/src/schema/competitor-ads.ts:11-13` keeps `brandId: uuid('brand_id').notNull()`, and `packages/db/src/competitor-ads.ts:14-16` scopes every read with `withBrand(db, brandId)`. Smallest step: decide whether Ad Spy is agency-wide; if so make `brand_id` nullable in `packages/db/src/schema/competitor-ads.ts` with a global check constraint, the way `packages/db/src/schema/themes.ts` does, plus a migration. |
| 4 | Review the imported Airtable tables and drop the ones not needed | **BLOCKED-ON-TALAL** | The code went the other way: `73035dc` (PARITY-27) removed the skip list entirely — `packages/db/src/scripts/import-mappings.ts:1298` records "`SKIPPED_AIRTABLE_TABLES` list is gone with its last entry". All 21 tables are now imported (`packages/db/src/airtable-tables.ts:20-42`, `GRATSI_TABLES`). Nothing in `docs/decisions.md` or `docs/audits/` records a table being dropped. | See question 1 in the last section. |
| 5 | Niagara Sleep Solutions and Gratsi are the relevant demo clients; Mattress Central does not matter | **DONE** | Both are demo brands: `packages/db/src/demo-data.ts:1947` (`Niagara Sleep Solutions`) and `:1957` (`Gratsi`), with Niagara's three products at `:206-230`. The seed roster is asserted as `['Funky Painting', 'Gratsi', 'Mattress Central']` in `packages/db/src/seed.test.ts:83-87`. Gratsi is the base every import and parity script points at (`packages/db/src/airtable-tables.ts:20`, `GRATSI_TABLES`). | Mattress Central fixtures are still seeded; the item does not ask for their removal, so nothing is outstanding. I could not establish from the code which of the two Gratsi bases is the confirmed one. |

### Overview dashboard

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 6 | Redesign the Overview to match the reference dashboard Talal shared | **PARTIAL** | The reference is captured as `docs/prd-assets/dashboard-reference.png`, described in `docs/PRD.md:278` as "per-CSM cards with counts of concepts, creators, sent to editor/designer, in progress, awaiting internal/client, **revisions**, **ads to launch**". The eight pipeline cards landed in `c1f15a9` (`apps/web/src/lib/dashboard-source.ts:208-277`, rendered by `apps/web/src/components/overview/metric-cards.tsx`). | Two reference cards are absent from `allMetricCards` in `apps/web/src/lib/dashboard-source.ts:212-276`: a revisions card and an "ads to launch" card (the latter exists only inside the media-buyer tile set, `:136`). The reference's **per-CSM** cards are not built — `loadOverviewPanels` (`:377`) counts one brand. The remaining work is written up as P3-2/P3-3/P3-5 in `docs/tickets/backlog/sprint-p3-overview-dashboard.md`. |
| 7 | Show the eight pipeline metrics | **DONE** | `apps/web/src/lib/dashboard-source.ts:212-276` defines exactly the eight the item lists, keyed `concepts_pending`, `creators_pending`, `sent_to_video_editor`, `sent_to_designer`, `video_editing_in_progress`, `static_design_in_progress`, `ad_submitted` ("Awaiting Internal Review"), `awaiting_client` ("Awaiting Client Review"). Commit `c1f15a9`. | — |
| 8 | Remove irrelevant metrics such as "Angles in library" | **PARTIAL** | The tile still exists. `apps/web/src/lib/dashboard-source.ts:125`: `{ label: 'Angles in library', count: concepts.length, href: anglesPath }` inside `csmItems`, which `adminItems` spreads at `:165`. Introduced in `f0cbb7e`; never removed. (It is also wrong twice over: it is labelled "Angles" and counts `concepts`.) | Delete that object from `csmItems` in `apps/web/src/lib/dashboard-source.ts:122-126`, and update whatever tile-count assertion covers it in the dashboard tests. |
| 9 | Role-based overviews; CSM / PM sees totals across all their clients | **PARTIAL** | Role scoping of the cards exists: `CARD_KEYS_BY_ROLE` (`apps/web/src/lib/dashboard-source.ts:280-288`) covers `admin`, `csm`, `strategist`, `video_editor`, `designer`, `media_buyer`, `client`; the per-role tile builders are `:50-173`; the page resolves the role first (`apps/web/src/app/app/page.tsx:39`). Commits `b9c36f3`, `c1f15a9`. | Cross-client totals are missing: `loadOverviewPanels` (`apps/web/src/lib/dashboard-source.ts:377-398`) calls `loadBriefs`/`loadConcepts`/`loadCopy`/`loadUgc`, each of which resolves the one brand in scope. Smallest step: add a cross-brand loader in `apps/web/src/lib/dashboard-source.ts` that aggregates over the actor's `brand_assignments` rows (the ticket is P3-2 in `docs/tickets/backlog/sprint-p3-overview-dashboard.md`). |
| 10 | Make metrics clickable | **DONE** | Each card is a `<Link>` (`apps/web/src/components/overview/metric-cards.tsx:17-22`) to a filtered table: `briefHref` builds `?status=<key>&view=grid` / `?client=<key>&view=grid` (`apps/web/src/lib/dashboard-source.ts:210-211`), and the Briefs page applies it at `apps/web/src/app/app/creative-design/page.tsx:143-152`. Commit `c1f15a9`. | Two of the eight (`concepts_pending`, `creators_pending`) land on their table unfiltered — a deliberate choice recorded in the module comment at `apps/web/src/lib/dashboard-source.ts:205-206`. |
| 11 | Present pipeline data more visually | **DONE** | `apps/web/src/components/overview/pipeline-chart.tsx` — a horizontal bar per internal status, built from `buildPipeline` (`apps/web/src/lib/dashboard-source.ts:310-324`); each metric card carries an emoji (`metric-cards.tsx:25`). Commit `c1f15a9`. | Bars are sized divs, not a chart library; the reason is recorded in the module header (`pipeline-chart.tsx:4-6`). |

### Visual design

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 12 | Make the system feel friendly: emojis, icons, images | **DONE** | `9848775` (P2D). `apps/web/src/components/shell/nav.ts` carries 31 `emoji:` entries (`:72` 🏠 Overview, `:79` 📦 Products, `:87` 🎭 Personas, `:88` 🎯 Angles, `:89` 🎨 Themes, `:90` 💡 Concepts …), rendered at `apps/web/src/components/shell/sidebar.tsx:42-51`; metric cards carry emojis (`apps/web/src/lib/dashboard-source.ts:215, 221, …`); gallery cards carry record images (`apps/web/src/components/views/gallery-view.tsx`). | — |
| 13 | Apply the TAS colour scheme: purple gradient + white | **PARTIAL** | The purple palette is the token layer: `packages/ui/src/styles/tokens.css:26-29` (`--accent: #a855f7`, `--accent-gradient: linear-gradient(135deg, #8b5cf6 0%, #c026d3 100%)`) with white surfaces in light mode at `:44-58` (`--bg: #ffffff`, `--surface: #ffffff`). Re-paletted in `9848775`; the header comment cites the Sep 28 feedback verbatim. | **The gradient is never rendered.** The `.bg-brand-gradient` utility is declared at `apps/web/src/app/globals.css:22-23` and has no call site anywhere in `apps/web/src` or `packages/ui/src`. Smallest step: apply `bg-brand-gradient` to the top bar or the Overview header in `apps/web/src/components/shell/top-bar.tsx`, and add a story for it on `/design-system`. |

### Table views (Products, Personas, Angles, Themes, Concepts, UGC Management)

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 14 | Test the automatic Linked Concepts field on Products | **DONE** | It is computed, not stored: `packages/db/src/products.ts:89` sets `conceptCount: linked.counts.get(row.id) ?? 0` (`05be4fc`, junction-backed since `acce183`). Unit test `packages/db/src/products.test.ts:53` asserts `[2, 2, 0]`; E2E `apps/web/e2e/products.spec.ts:94-116` asserts the panel chip reads `2 concepts` and `0 concepts`. The grid column is `apps/web/src/app/app/products/products-workspace.tsx:164-169` (`dc822f5`). | — |
| 15 | Grid view (Airtable-style table), default on all six tables | **DONE** | `defaultViewType: 'grid'` in all six workspaces: `products-workspace.tsx:241`, `personas-workspace.tsx:201`, `angles-workspace.tsx:320`, `themes-workspace.tsx:284`, `concepts-workspace.tsx:289`, `ugc-workspace.tsx:438` (all under `apps/web/src/app/app/`). Commits `dc822f5`, `54911e3`, `a788865`, `2b3f6ba`, `afdc308`, `9bf87ff`, `e42801f`. | — |
| 16 | Gallery view with "customize card": which fields show, which image field is the cover | **PARTIAL** | Gallery exists on all six (`packages/domain/src/views/table-views.ts` — `supportedViews` includes `gallery` for products `:231`, personas `:188`, angles `:215`, themes `:204`, concepts `:145`, creators `:170`), built from the grid's own columns by `galleryItemsFrom` (`apps/web/src/components/views/gallery-items.ts:19`), and the Fields popover hides card lines as well as columns (`apps/web/src/components/views/fields-menu.tsx:25-27`). Commits `e42801f`, `c4014d7`. | **No cover-image picker.** The cover is hard-coded per page through `identity(row).imageUrl` (`apps/web/src/components/views/gallery-items.ts:26`); the capability registry's `galleryFields` list (e.g. `packages/domain/src/views/table-views.ts:179-182`, Profile Pic / Video Intro) is read by **nothing** — `grep -rn galleryFields apps/web/src packages/domain/src` returns only `table-views.ts` itself. Smallest step: add a `coverField` to `UserViewConfig` in `packages/domain/src/views/user-views.ts` and a picker in `apps/web/src/components/views/view-toolbar.tsx` fed from `galleryFields`. |
| 17 | Keep the List view (the current popup/sidebar behaviour) | **PARTIAL** | The popup/sidebar survives on five of six: `apps/web/src/app/app/products/product-panel.tsx`, `personas/persona-panel.tsx`, `angles/angle-panel.tsx`, `themes/theme-panel.tsx` (new in `2b3f6ba`), `ugc/creator-panel.tsx`; each is opened by a query parameter (`?product=`, `?theme=`, …) so a refresh restores it. | **Concepts has no popup.** A concepts row navigates to the route `apps/web/src/app/app/concepts/[conceptId]/page.tsx`; there is no `concept-panel.tsx`. Also, no view type named "List" is offered — `ViewType` is `'grid' \| 'kanban' \| 'gallery' \| 'timeline'` (`packages/domain/src/views/table-views.ts:1`). Smallest step: decide whether Concepts needs a quick-look panel like the brief's (`apps/web/src/app/app/creative-design/brief-panel.tsx` is the pattern) and add `apps/web/src/app/app/concepts/concept-panel.tsx`. |
| 18 | Drop Kanban from products, personas, angles, themes, concepts | **PARTIAL** | Only Products complied: `packages/domain/src/views/table-views.ts:231` — `supportedViews: ['grid', 'gallery']`. | **Kanban is still offered on the other four**: personas `:188` with `kanbanFields: [{ field: 'stageOfAwareness' … }]`, themes `:204-208` (Category, Status), angles `:215-216` (Potential), concepts `:145-151` (Approval Status, **Production Status**, Internal Status, Client Status). Each workspace passes the capability straight through to the switcher (`concepts-workspace.tsx:401`, `personas-workspace.tsx:311`, `angles-workspace.tsx:441`, `themes-workspace.tsx:432`). Smallest step: remove `'kanban'` from those four `supportedViews` arrays in `packages/domain/src/views/table-views.ts` and drop their now-dead `kanbanFields`; then reconcile the four Playwright specs that exercise Kanban on them. |
| 19 | Grid needs horizontal scrolling so every field is visible | **DONE** | `apps/web/src/components/views/airtable-grid.tsx:145` — `className="w-full overflow-x-auto rounded-card …"` wrapping a `min-w-max` table (`:146`); the shell prevents the page itself scrolling sideways (`apps/web/src/app/app/layout.tsx:42`, `overflow-x-hidden`, and `:48` `min-w-0`). Commits `dc822f5`…`9bf87ff`. | — |
| 20 | Remove the empty side space; make the table full width | **DONE** | `apps/web/src/app/app/layout.tsx:48-50` — `<main className="min-w-0 flex-1 px-4 py-6 …">` wrapping `<div className="w-full">`, with the comment citing P2D and the Sep 28 feedback. Commit `9848775`. | — |
| 21 | Let users show/hide fields per view | **DONE** | `apps/web/src/components/views/fields-menu.tsx` (one checkbox per column) wired through `toggleField` / `isFieldVisible` in `apps/web/src/components/views/use-table-view.ts:59-60`, persisted into the viewer's active view (`visibleFields` in `packages/domain/src/views/user-views.ts:20`) and applied by `applyUserView` (`:123-140`). Commit `e42801f`. E2E: `apps/web/e2e/user-views.spec.ts`. | — |
| 22 | Freeze rows/columns in the grid | **PARTIAL** | Column freezing works for the primary column: `apps/web/src/components/views/airtable-grid.tsx:158` (`column.frozen && 'sticky left-0 z-20 …'` on `<th>`) and `:234-235` (same on `<td>`); `frozen: true` is set on each table's name column (e.g. `apps/web/src/app/app/products/products-workspace.tsx:132`). | Two gaps. (a) **No UI sets which columns freeze**: `frozenFields` exists in `packages/domain/src/views/user-views.ts:25` and the Server Action accepts it (`apps/web/src/lib/user-view-actions.ts:118,129`), but nothing in `apps/web/src/components/views/view-toolbar.tsx` offers it. (b) **No row freezing**: `airtable-grid.tsx` has no `sticky top-*` anywhere, so the header row scrolls away vertically. Smallest step: add `position: sticky; top: 0` to the `<thead>` row in `apps/web/src/components/views/airtable-grid.tsx:147-148` and a "Freeze up to this field" item to the Fields popover (`apps/web/src/components/views/fields-menu.tsx`). |
| 23 | UGC gallery: creator profile picture as the card cover | **DONE** | `apps/web/src/app/app/ugc/ugc-workspace.tsx:495-498` — `galleryItemsFrom(visibleCreators, CREATOR_COLUMNS, (creator) => ({ …, imageUrl: creator.profilePicUrl }))`, rendered at `:622`. Capability: `packages/domain/src/views/table-views.ts:180`. Commit `c4014d7`. | Pictures only render where a URL survives; see item 26 on the expiring Airtable URLs. |
| 24 | UGC grid: creator picture inline in the first column, not a separate column | **DONE** | `apps/web/src/app/app/ugc/ugc-workspace.tsx:121-133` renders the avatar (or an initial tile when `profilePicUrl === null`) inside the frozen name cell. Commit `9bf87ff` (GRID-06). | — |
| 25 | Views are per user; the propose → admin-approve → roll-out idea is dropped | **DONE** | `packages/db/src/schema/user-table-views.ts` + `packages/db/src/user-table-views.ts`, keyed on Clerk user id + table key, with the isolation pinned by the PGlite test `packages/db/src/user-table-views.test.ts`; demo mode keeps the same state in the visitor's `localStorage` (`apps/web/src/components/views/use-table-view.ts:76-119`). E2E: `apps/web/e2e/user-views.spec.ts` opens a second browser context and proves the second user sees nothing of the first. Decision recorded in `docs/decisions.md` ("2026-10-01 — Per-user views live in their own table; demo mode keeps them in the browser (VIEWS-01)"). Commit `e42801f`. No view-approval flow exists anywhere. | — |

---

## Batch 2 — 25:00 to 50:00

### Import / data issues

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 26 | Creator profile images were not imported — find out why | **PARTIAL** | They are read now: `packages/db/src/airtable-import.ts:1129` — `profilePicUrl: attFirst(w, f["Creator's Profile Pic"]) ?? str(f['Profile Pic URL'])`, through the attachment helpers at `:251-278` (`015256e`); the field map records it at `packages/db/src/scripts/import-mappings.ts:778-782`. | Two things are missing. (a) **The "why" is not recorded** — I searched `docs/decisions.md`, `docs/decisions/`, `docs/audits/` and the commit log and could not establish the cause of the original miss. (b) **The stored value is the Airtable CDN URL, which expires.** The re-host script exists (`packages/db/src/scripts/migrate-airtable-urls.ts`, covering `profilePicUrl`, `videoIntroUrl`, `rawAssetsUrl` per `packages/db/src/url-migration.ts:68-73`, commit `8fb2b72`) but `--live` refuses without R2 credentials, which are absent from `/Users/macbook/Tallas Tas/.env.local`. Smallest step: run `pnpm --filter @tas/db migrate-urls -- --dry-run` and write the count plus the cause (or "could not be established") into `docs/decisions.md`. |
| 27 | Fields missed in the import, e.g. "Facebook profile for partnership"; do a full pass | **PARTIAL** | That field is mapped: `packages/db/src/scripts/import-mappings.ts:783-787` → `packages/db/src/airtable-import.ts:1181` (`facebookProfileUrl: str(f['Facebook Profile for Partnership'] ?? f['Facebook Profile URL'])`), column `packages/db/src/schema/creators.ts:145`. The full pass landed: `73035dc` (every Gratsi table imported, skip list gone), `8ac88cb` (PARITY-28 — a parity gate that fails on any stored Airtable field that is neither mapped nor registered as an exclusion in `docs/decisions.md`), `66d8ed7` (migration 0039 for the Gratsi-only columns). | Two gaps. (a) **I could not establish whether migration 0039 has been applied to production**, so I cannot assert the Gratsi-only fields have anywhere to land there. (b) Ten further paired tables carry client-only fields that are deliberately neither mapped nor dropped — `docs/decisions/gratsi-unmapped-fields-2026-10-02.md` lists them (Angles 16, Concepts 10, Creative Design 9, Meta Copywriting 13, UGC 8, …) and states the one unanswered question. Smallest step: apply 0039 with `pnpm --filter @tas/db migrate-prod` after approval, then resolve the question in that decision file (it is question 2 below). |
| 28 | The current "grid" is really a gallery; grid must be a table | **DONE** | `apps/web/src/components/views/airtable-grid.tsx:146` renders a real `<table>` with `<thead>`/`<tbody>`, sortable `<th>` buttons (`:161-176`) and a sticky first column. All six tables moved onto it: `dc822f5` (Products), `54911e3` (Personas), `a788865` (Angles), `2b3f6ba` (Themes), `afdc308` (Concepts), `9bf87ff` (UGC). | — |
| 29 | Keep Kanban on UGC Management; the grid must still match Airtable | **DONE** | Kanban kept: `packages/domain/src/views/table-views.ts:170-178` (`supportedViews: ['grid','kanban','gallery']`, six grouping fields including Internal Status and Partnership Activity), built at `apps/web/src/app/app/ugc/ugc-workspace.tsx:467-490`. Grid matches Airtable column-for-column after `9bf87ff` and `8bd2b94` (PARITY-32, every creator column labelled); asserted by `apps/web/e2e/module-parity.spec.ts` (`e0a117d`). | — |

### Uploads & media

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 30 | Cloud file storage so images can be uploaded or changed | **PARTIAL** (checked: it **is** wired, so not blocked on Talal) | R2 is implemented end to end in code: `packages/db/src/r2.ts` (`isR2Available` `:28`, hand-rolled SigV4 `uploadToR2` `:46`, no AWS SDK dependency), re-exported for the app by `apps/web/src/lib/r2-upload.ts`, env schema in `packages/env/src/schema.ts`. Commits `c290d5c` (P7-001) and `8fb2b72`. | Two gaps. (a) **Only one upload call site exists, and it is video**: `uploadCreatorVideoAction` in `apps/web/src/app/app/ugc/actions.ts:265-306`. `grep -rn "uploadToR2" apps/web/src` returns that action, the re-export, and `apps/web/src/app/app/ugc/page.tsx:126` (`uploadsEnabled`). **No image can be uploaded or replaced anywhere** — not a creator profile pic, not a theme attachment, not a brief design file. (b) R2 credentials are absent from `/Users/macbook/Tallas Tas/.env.local`, so even the video path cannot be exercised here. Smallest step: add an image upload to `apps/web/src/app/app/ugc/actions.ts` beside `uploadCreatorVideoAction` (category `profile_pic`, writing `creators.profile_pic_url`), and wire the control in `apps/web/src/app/app/ugc/creator-panel.tsx`. |
| 31 | UGC: video uploads, several videos per creator, media part of the card | **DONE** | `uploadCreatorVideoAction` (`apps/web/src/app/app/ugc/actions.ts:265-310`) uploads through `uploadToR2` and writes one `assets` row per video with `creator_id` set and category `showcase_video`; the panel lists them all with inline `<video>` playback (`apps/web/src/app/app/ugc/creator-panel.tsx:634-668`, `data-slot="showcase-videos"`). Storage column added by migration `0041_creator-showcase-videos.sql`. Commit `e42801f`. | Coded but not exercisable here (no R2 credentials); and I could not establish whether migration 0041 has been applied to production. |

### Views & filtering

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 32 | Add filters, grouping and show/hide fields to the views | **PARTIAL** | Show/hide fields: done (see item 21). Grouping: done where a table supports Kanban — the grouping field comes from `kanbanFields` and is chosen in the switcher (`apps/web/src/components/views/view-switcher.tsx`, `kanbanGroupByField`), e.g. `apps/web/src/app/app/creative-design/briefs-workspace.tsx:357-360`. | **No field filters.** `UserViewConfig.filter` is a single free-text search string — `packages/domain/src/views/user-views.ts:27-28` ("The search query the view opens with"), a `string`, with no field/operator/value shape. And `apps/web/src/components/views/view-toolbar.tsx:49-70` offers only the view switch, the Views menu and the Fields popover — there is no Filter control and no Group-by control for the grid. Smallest step: add a `filters: readonly {field, op, value}[]` to `UserViewConfig` in `packages/domain/src/views/user-views.ts`, apply it in `apps/web/src/components/views/airtable-grid-logic.ts`, and add the control to `view-toolbar.tsx`. |

### Concepts

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 33 | Why does Concepts have an Internal Status? Review and likely remove | **BLOCKED-ON-TALAL** | The column exists: `packages/db/src/schema/concepts.ts:67` — `internalStatus: text('internal_status').notNull().default(CONCEPT_INTERNAL_STATUS_DEFAULT)`, and it is a Kanban grouping at `packages/domain/src/views/table-views.ts:149`. Hard evidence for the decision: **neither Airtable base has an Internal Status field on Concepts.** `docs/audits/base-field-mapping-2026-10-02.md:300-335` lists the template's Concepts statuses as `Approval Status` and `Production Status`, and Gratsi's as `Status` and `Production Status`. The field is a platform invention. | See question 3. |
| 34 | Remove Production Status from Concepts | **PARTIAL** | Hidden from the three places that render a concept: the grid (`afdc308`, GRID-05), the form (`apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx:635-638`, with the comment quoting Talal's "take it out" and a hidden input at `:504` so a save cannot blank the stored value) and the panel. Recorded in `docs/decisions.md:684-688` ("Production Status is hidden, not dropped"). Commits `75c052c`, `afdc308`. | **It is still reachable as a Kanban grouping**: `packages/domain/src/views/table-views.ts:148` — `{ field: 'productionStatus', label: 'Production Status' }` on the `concepts` capability, and Concepts still offers Kanban (item 18). Grouping by it puts the status values on screen as column headings. Smallest step: delete that entry from `packages/domain/src/views/table-views.ts:148` (dropping Kanban from Concepts per item 18 removes it too). |
| 35 | On some concepts the Angle was not displayed or written; check display/inheritance | **PARTIAL** | The display path is sound: the grid column is `apps/web/src/app/app/concepts/concepts-workspace.tsx:145-149`, reading `angleName`, which `packages/db/src/concepts.ts:182-210` derives from the `concept_angles` junction (`angleIds`, `firstAngleId`). The import heals the junction on every run (`packages/db/src/airtable-import.ts:1504`, `clear(conceptAngles, …)` then re-insert at `:1550-1564`). | **The import reads one field name.** `packages/db/src/airtable-import.ts:1555` resolves the link from `rec.fields.Angle` only (and `:1560` retries the same name). `docs/audits/base-field-mapping-2026-10-02.md:312` records that the field is named **`Angle`** (singular) in the Gratsi base but **`Angles`** (plural) in the template base — so a template-base import writes zero `concept_angles` rows and every concept's Angle cell renders the em dash. `d5fd450` (PERSONAS-MAP) built the per-base alias mechanism but only for Personas (`PERSONA_FIELDS`, `packages/db/src/airtable-import.ts:746`); Concepts was not given one. Smallest step: give the concept→angle link an alias list in `packages/db/src/airtable-import.ts` the way `PERSONA_FIELDS` does (`f.Angles ?? f.Angle`), with a unit test in `packages/db/src/airtable-import.test.ts`. |
| 36 | Batch, angle and theme required on a concept | **DONE** | Rules in `packages/domain/src/concepts/validate-concept-draft.ts:44-70` (Batch required and in `BATCHES`, at least one angle, at least one theme), run by both the form and the Server Action; inline messages at `apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx:331-333` (`'Batch is required'`, `'Angle is required'`, `'Theme is required'`) and the save is gated at `:487-492`. Pinned by `apps/web/src/app/app/concepts/concept-rules.test.ts`. Commits `75c052c`, `c4014d7`. | — |
| 37 | Mark required and optional fields/dropdowns clearly in the UI | **NOT STARTED** | No required/optional marker exists. `grep -rn "aria-required\|Required\b" apps/web/src --include='*.tsx'` returns only the Concept form's internal state names (`missingRequired`, `unsetRequired` at `apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx:274-275, 336`), which produce a message **only after the viewer presses Save** (`:487-492`). The only "required" string in `packages/ui/src` is the demo hint `DEMO_WRITE_HINT` in `packages/ui/src/components/disabled-write.tsx:6`. | Lands in `packages/ui/src/components/` — add a `required` prop to the shared `Label` that renders a marker and sets `aria-required`, render it as a story on `/design-system` (UI governance rule 4), then pass it from the Concept form (`apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx`) and the Angle panel (`apps/web/src/app/app/angles/angle-panel.tsx`). |
| 38 | Rename the "Brief" section inside a concept to "Concept Details" | **DONE** | `apps/web/src/app/app/concepts/fields.ts:361` — `heading: 'Concept details'`, pinned by `apps/web/src/app/app/concepts/fields.test.ts:194` (`expect(CONCEPT_GROUP_HEADINGS).toEqual(['Pairing', 'Inherited', 'Concept details'])`) and rendered at `apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx:596-599`. Commit `c4014d7`. | — |
| 39 | Script Idea may be removed; Talal will check with the team | **BLOCKED-ON-TALAL** | The column exists: `packages/db/src/schema/concepts.ts:57` — `scriptIdea: text('script_idea')`. Evidence for the decision: the field exists in **both** bases under different names — `docs/audits/base-field-mapping-2026-10-02.md:316` pairs the template's `Script idea` (multilineText) with Gratsi's `Script` (richText), "both hold the concept's script body". Also `packages/domain/src/concepts/validate-concept-draft.ts:10-11` already treats it as optional ("the script idea … are not" required). | See question 4. |

### Linking / relationships

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 40 | Two-way linking Concepts ↔ UGC creators | **DONE** | `packages/domain/src/links/link-kinds.ts:53-66` registers `concept-creators` and `creator-concepts`, both on the single junction `creator_concepts`; one `LinkField` is mounted on the concept (`apps/web/src/app/app/concepts/[conceptId]/concept-detail.tsx:641-651`, `slot="concept-creatorIds"`) and on the creator panel. Both ways proven by the PGlite test `packages/db/src/links.test.ts`. Commit `c4014d7`. | — |
| 41 | A creator's Linked Concepts shows every concept; fix the link data | **DONE** | Creator reads now come from the junction, not from the whole table: `packages/db/src/creators.ts:63` — `conceptIds: conceptMap.get(row.id) ?? []`, with the module comment at `:49` ("read from the `creator_concepts`/`creator_products` junction"). The import resolves the Airtable link per creator at `packages/db/src/airtable-import.ts:1844-1852` (`rec.fields['Concept to film'] ?? rec.fields.Concepts`). Commit `acce183`. | — |
| 42 | Two-way linking across all linked tables (products, personas, angles, themes, concepts, UGC) | **PARTIAL** | Four links are two-way, eight kinds: `packages/domain/src/links/link-kinds.ts:25-34` — concept↔angle, concept↔creator, angle↔product, angle↔persona, each a single junction with an `inverseLinkKind` (`:102-112`), one `setLinksAction`, one `LinkField` component. Commit `c4014d7`. | **Themes is not in the registry.** `LinkJunction` is `'concept_angles' \| 'creator_concepts' \| 'angle_products' \| 'angle_personas'` (`packages/domain/src/links/link-kinds.ts:11-12`), although `concept_themes` and `creator_products` both exist as junction tables (`packages/db/src/schema/junction-tables.ts:67` and `:33`). `apps/web/src/app/app/themes/theme-panel.tsx` mounts no `LinkField` and shows no concepts at all. Smallest step: add `concept-themes` / `theme-concepts` to `LINK_REGISTRY` in `packages/domain/src/links/link-kinds.ts`, teach `syncLinks` the junction in `packages/db`, and mount the field on both `theme-panel.tsx` and the concept detail. |
| 43 | Show linked concepts on the Angle record (Talal: "maybe we don't need it") | **BLOCKED-ON-TALAL** | **Already built**, which is why only the decision is outstanding: `apps/web/src/app/app/angles/angle-panel.tsx:656-660` mounts `link="angle-concepts"` with `label="Concepts"` (slot `angle-concepts` at `:801`), listing and editing the concepts of an angle. Commits `b65524e` (PARITY-30), `c4014d7` (LINK-01). Airtable evidence: the `Concepts` link exists on the Angles table in **both** bases — `docs/audits/base-field-mapping-2026-10-02.md:269` marks it IDENTICAL. | See question 5. |
| 44 | Angles have Brief URL and Exact Script URL that do not exist in Airtable; remove if not needed | **BLOCKED-ON-TALAL** | Both are live in the platform: columns `packages/db/src/schema/angles.ts:39-40` (`brief_url`, `exact_script_url`), grid columns `apps/web/src/app/app/angles/angles-workspace.tsx:249-257`, form fields `apps/web/src/app/app/angles/fields.ts:406-410`, write path `apps/web/src/app/app/angles/actions.ts:141-142, 225-226`. **The premise of the item does not hold.** `docs/audits/base-field-mapping-2026-10-02.md:286-287` records that the Gratsi `Angles` table has `Brief` (type **url**) and `Exact Script` (type **url**) as GRATSI-ONLY fields — they exist in Airtable, on the client base, just not in the template base. | See question 6. |
| 45 | Hierarchy: Product → Persona → Angle (links product + persona) → Concept (product and persona inherited) + Theme | **DONE** | The angle owns both links: `angle_products` and `angle_personas` junctions (`packages/db/src/schema/junction-tables.ts:101`, `:84`), registered both ways at `packages/domain/src/links/link-kinds.ts:67-94`. The concept inherits rather than storing: `packages/domain/src/concepts/inherited-from-angle.ts` (`5d0123b`), rendered as a read-only "Inherited" section (`apps/web/src/app/app/concepts/fields.ts:359`, "Read-only. These come from the angle and change when it does."; `concept-detail.tsx:555-594`). Theme is the concept's own pairing (`concept_themes`, `packages/db/src/schema/junction-tables.ts:67`). Persona needs no links of its own. Commit `c4014d7`. | Note for Talal, not a defect: `docs/audits/base-field-mapping-2026-10-02.md:271-273` records that the **Gratsi base stores `Product` and `Personas` on Concepts, not on Angles** — the opposite of this hierarchy. The platform follows the hierarchy; a Gratsi import therefore moves those links up to the angle. |

### Creative Briefs

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 46 | AI QA on briefs gives recommendations only; it never changes the video or graphic | **DONE** | `apps/web/src/lib/spell-check.ts:16-20` — the system prompt ends "Report each issue on its own line. If there are no issues, say \"No issues found.\" Be concise. **Do not rewrite the text.**" The result is only ever stored as text (`creative_briefs.spelling_feedback`) and read back by `hasSpellingIssues` (`apps/web/src/lib/dashboard-source.ts:151-155`); nothing in the checker touches an asset. Commit `8d62d43`. | — |
| 47 | Rebuild the Creative Brief UI as an exact replica of the other client's platform | **UNCLEAR** | "Exact replica" has no checkable definition here: nothing in the repository describes the reference. `docs/prd-assets/` holds only `dashboard-reference.png` and `team-assignment-reference.png`; `grep -rn -i "replica\|other client's platform" docs/` returns only parent-template "replicated" prose and the P3 dashboard ticket. Substantial brief work did land (`e60069e`, `9cfea14`, `a14a408`), but I cannot judge it against an unseen reference. | Ambiguous: which platform, and which screens of it count. Resolving it needs screenshots or a URL in `docs/prd-assets/` plus a sprint ticket listing the screens, after which items 48-52 are the checkable parts of it. |
| 48 | Show the pipeline overview (what is pending) at the top of the Briefs section | **NOT STARTED** | The Briefs page has no counts. `grep -rn "MetricCards\|PipelineChart" apps/web/src/app/app/creative-design/` returns nothing. The word "Pipeline" at `apps/web/src/app/app/creative-design/briefs-workspace.tsx:347` is only the heading over the view switcher; the header above it shows a single brief count (`:333-338`). | Lands in `apps/web/src/app/app/creative-design/briefs-workspace.tsx`, above the `briefs-heading` section: reuse `MetricCards` from `apps/web/src/components/overview/metric-cards.tsx` fed by `buildPipeline`/`buildOverviewMetrics` (`apps/web/src/lib/dashboard-source.ts:291, 310`) over the briefs the page already loaded. |
| 49 | Brief table columns incl. due date; colour-code rows by brief stage | **PARTIAL** | Six of the nine columns exist: `apps/web/src/app/app/creative-design/fields.ts:94-101` — `['Name','Concept','Type','Priority','Assignee','Internal Status']`, rendered at `briefs-workspace.tsx:434-497`. Due date itself was added as data and is on the full page: migration `0043_brief-due-date.sql`, `fields.ts:239, 559, 711`, `brief-detail.tsx:577` (`e60069e`). Stage colour exists on the **Kanban card**: `briefs-workspace.tsx:245-248` sets `accentTone: editorStageTone(editorStageOf(...))` when grouped by editor stage. | Missing from `BRIEF_COLUMNS` in `apps/web/src/app/app/creative-design/fields.ts:94-101`: **Due date, Created, Submission count**. And the **table rows are not colour-coded** — the `<TableRow>` at `briefs-workspace.tsx:446-459` carries only `className="cursor-pointer"`. Smallest step: add the three columns to `BRIEF_COLUMNS` and their cells in `briefs-workspace.tsx`, and set a `data-stage` attribute plus a tone border on `<TableRow>` from `editorStageOf(item.kanbanFields.internalStatus)`. |
| 50 | Brief detail: details on top, scripts table below | **DONE** | `apps/web/src/app/app/creative-design/[briefId]/brief-detail.tsx` — details first (`data-slot="brief-left"` `:482`, `brief-centre` `:761`, with concept facts at `:541-559`, due date `:577`, priority `:624`), then the Scripts table at `:815-835` (`data-slot="brief-scripts"` / `brief-scripts-table`), then Activity at `:1053`. Commit `e60069e` (EDIT-04). | — |

---

## Batch 3 — 50:00 to 69:06

### Creative Briefs (continued)

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 51 | Activity/history panel on briefs | **DONE** | `activity_log` table (migration `0042_activity-log.sql`) + `packages/db/src/activity-log.ts`, written from the Server Actions with one row per changed field (`diffFields` in `packages/domain/src/activity/field-diff.ts`), rendered at `apps/web/src/app/app/creative-design/[briefId]/brief-detail.tsx:1053-1080` (`data-slot="brief-activity"`, actor name at `:1077`). Commit `e60069e` (EDIT-03). | I could not establish whether migration 0042 has been applied to production, so the live panel's behaviour there is unverified. |
| 52 | Compact quick view in a sidebar, plus open as a full page / new tab | **PARTIAL** | The sidebar quick view exists: `apps/web/src/app/app/creative-design/brief-panel.tsx` (an `<aside>`, opened on card or row click, `briefs-workspace.tsx:111-121`), and it offers "Open full page" at `brief-panel.tsx:111-122`. Commits `9cfea14`, `e60069e`. | **No new-tab affordance.** The control is a `<Button type="button" onClick>` whose handler is `router.push(item.href)` (`briefs-workspace.tsx:104-109`), so it cannot be cmd-clicked, middle-clicked or opened in a new tab. Smallest step: make it a `<Link href={item.href}>` in `apps/web/src/app/app/creative-design/brief-panel.tsx` (keeping the button styling), which gives both behaviours for free. |
| 53 | Decision: copy the other client's brief system as is and refine later | **NOT STARTED** | The decision is nowhere in the repository. `docs/decisions.md` (D-001…D-010 plus dated 2026-10-01/02 entries) and `docs/decisions/` contain no entry for it, and no ticket cites it. Without the record, items 47-52 have no agreed scope to be measured against. | Lands in `docs/decisions.md`: append a dated entry naming the platform being copied, what "as is" covers, and what is explicitly deferred — then link it from `docs/tickets/` for items 47-52. |
| 54 | In briefs, connect a Concept; this brings in the angle, and through it the product and persona | **PARTIAL** | The concept picker and the inheritance exist: `apps/web/src/app/app/creative-design/[briefId]/brief-detail.tsx:495` (`data-slot="brief-concept-select"`) and the fact row at `:541-559` showing Batch, **Angle** and **Product**, each preferring the brief's own link and falling back to the concept's (comment at `:535-539`). Commits `e13f455` (TASK 5c), `e60069e`. | **Persona is not brought in.** `grep -rn "persona" apps/web/src/app/app/creative-design/[briefId]/brief-detail.tsx` returns nothing: the `brief-concept-facts` list is Batch / Angle / Product only. Smallest step: add a persona fact to that `<dl>` in `brief-detail.tsx:541-559`, read through `inheritedFromAngle` (`packages/domain/src/concepts/inherited-from-angle.ts`), which already resolves the angle's personas. |
| 55 | An angle must be connected to both a product and a persona | **PARTIAL** | Persona is required: `packages/domain/src/angles/validate-angle-draft.ts:54-56` — `if (draft.personaIds.length === 0) fieldErrors.personaIds = 'Pick at least one persona this angle is written from.'`, enforced by both the panel and the Server Action. | **Product is deliberately optional**, and the code says so: `validate-angle-draft.ts:39` — "Product stays optional via its junction table, so it carries no rule", and `AngleDraft` (`:14-21`) has no `productIds` field at all. Smallest step: add `productIds` to `AngleDraft` and a rule in `packages/domain/src/angles/validate-angle-draft.ts`, extend its unit test, and surface the message on the Products `LinkField` in `apps/web/src/app/app/angles/angle-panel.tsx`. |
| 56 | Keep the automated spell-checker / AI QA on briefs — it is a differentiator | **DONE** | `apps/web/src/lib/spell-check.ts` (Anthropic Messages API, `8d62d43`) with the brief-side action `apps/web/src/app/app/creative-design/spell-check-action.ts`; the stored result drives the Admin tile `Briefs with spell-check flags` (`apps/web/src/lib/dashboard-source.ts:167-171`) and the Spelling Feedback 2 field (`a029f9d`, PARITY-34). The demo-mode rerun was disabled like every other write in `20b9907` (FIX-SPEC-02). | `ANTHROPIC_API_KEY` is absent from `/Users/macbook/Tallas Tas/.env.local`, so the checker cannot be run from this machine; `spell-check.ts:24-26` returns a clear failure rather than throwing. |

### Editor view

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 57 | Build an Editor view showing only briefs, not concepts, products or angles | **PARTIAL** | The editor's **board** exists: `packages/domain/src/state/editor-board.ts` (three stages over `internal_status`, mapping table in the header `:16-27`), reachable as a Kanban grouping `?group=editorStage` on the briefs page (`apps/web/src/app/app/creative-design/page.tsx:95-99`, capability `packages/domain/src/views/table-views.ts:126`), with a Playwright spec `apps/web/e2e/briefs-editor.spec.ts`. Commit `e60069e`. | **The navigation is not role-scoped**, so an editor still sees every module: `apps/web/src/components/shell/nav.ts:68` — `NAV_GROUPS` is a static `readonly NavGroup[]` with no role input, consumed unfiltered by `apps/web/src/components/shell/sidebar.tsx:28`. No `/app/<module>` route carries a role guard either. Smallest step: the same one as item 2 — filter `NAV_GROUPS` by the role `loadActiveRole()` returns, and default a `video_editor`/`designer` to `/app/creative-design?group=editorStage`. |
| 58 | Editor Kanban: brief arrives → editor clicks Start → status becomes Under Editing | **DONE** | `canStartBrief` and `startedStatusFor` in `packages/domain/src/state/editor-board.ts:67-80` (Start acts only on Incoming and moves to the track's in-progress step through the same ladder); `startBriefAction` validates the transition, writes status and assignee and logs both changes; the button is on the card at `apps/web/src/app/app/creative-design/briefs-workspace.tsx:245-262` (disabled in demo mode with the reason). Pinned by `packages/domain/src/state/editor-board.test.ts` and `apps/web/e2e/briefs-editor.spec.ts`. Commit `e60069e`. | — |
| 59 | Rename the stage "Incoming" to TAS terms: "Sent to Editor" / "Sent to Designer" | **NOT STARTED** | The label is still "Incoming": `packages/domain/src/state/editor-board.ts:30` — `{ key: 'incoming', label: 'Incoming', tone: 'info' }`, returned by `editorStageLabel` (`:57-59`) and used as the column heading (`briefs-workspace.tsx:292`). The underlying statuses already carry the TAS words (`packages/domain/src/state/creative-status.ts:18` `'Sent to Video Editor'`, `:62` `'Sent to Designer'`) — only the merged stage label does not. | Lands in `packages/domain/src/state/editor-board.ts`: because one stage spans two tracks, the column label has to become track-aware (or read "Sent to Editor / Designer"). Change `EDITOR_STAGES` and `editorStageLabel`, update `packages/domain/src/state/editor-board.test.ts`, and update the heading assertions in `apps/web/e2e/briefs-editor.spec.ts`. |

### Client interface

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 60 | Client-facing progress bar / pipeline, read-only, no click-through | **BLOCKED-ON-TALAL** | Nothing exists: `grep -rn "Pipeline\|progress\|StepRow" apps/web/src/app/client/` returns nothing. The client interface itself is live — `apps/web/src/app/client/[brandSlug]/` with `concepts`, `angles`, `themes`, `briefs`, `ugc`, `calendar` (`ba28c9e`), and `/client/[brandSlug]/page.tsx` redirects to `concepts`. | See question 7 — this one collides with a non-negotiable, so it genuinely cannot be built on the current rules. |

### Performance & Meta integration

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 61 | Connect the Meta API with a read-only token; track performance per concept | **BLOCKED-ON-TALAL** | A read-only fetch path already exists: `apps/web/src/lib/meta-api.ts` (`isMetaAvailable` `:5`, `fetchMetaInsights` `:35` — a GET of `/insights` with `fields=ad_id,ad_name,spend,impressions,inline_link_clicks,actions`, no write scope anywhere), and the storage is already per concept: `packages/db/src/schema/ad-metrics.ts:17-27` has `conceptId`, `briefId`, `metaAdId`, `spend`, `roas`, with an index on `concept_id` at `:32`. Page: `apps/web/src/app/app/performance/`. Commit `68463ab`. `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` are absent from `/Users/macbook/Tallas Tas/.env.local`. | See question 8. |
| 62 | Allow manual linking of ads to concepts when the naming convention changes | **BLOCKED-ON-TALAL** (downstream of 61) | The write path accepts it, the UI does not offer it: `apps/web/src/app/app/performance/actions.ts:34` has `conceptId: text` in the zod schema and `insertAdMetric`/`updateAdMetric` persist it, but `grep -n "concept" apps/web/src/app/app/performance/performance-tracker.tsx` returns **nothing** — there is no concept picker on the form. | The picker itself needs no decision (it is a `LinkField`-style select in `apps/web/src/app/app/performance/performance-tracker.tsx`); what blocks it is that there are no imported Meta ads to link until item 61 is unblocked. See question 8. |
| 63 | Evaluate the ad uploader service the other client uses (~$60/month, verified, has MCP) | **BLOCKED-ON-TALAL** | No evaluation exists: `grep -rn -i "uploader\|ad launcher" docs/decisions.md docs/decisions/ docs/tickets/backlog.md` returns only the unrelated Vercel/OpenNext line at `docs/decisions.md:58`. The relevant constraint is in `CLAUDE.md` ("Total running cost target: 500 USD per year") and `docs/decisions.md` D-006, which budgets ≈260-340 USD/year in total. | See question 9. |

### Roadmap / next steps

| # | Item | Status | Evidence | Next step |
| --- | --- | --- | --- | --- |
| 64 | Next week: implement all of today's feedback; replicate the Airtable schema exactly plus views and filters; target UI v0 (~75%) | **PARTIAL** | Schema replication is the strongest part: `8ac88cb` (PARITY-28) added a gate that fails on any stored Airtable field that is neither mapped nor registered as an exclusion in `docs/decisions.md:628-660`, and PARITY-1…36 plus `73035dc` brought every Gratsi table in. Views landed (`e42801f`, `c4014d7`). On this audit's count, 27 of the 69 items are DONE and 27 PARTIAL. | **Filters did not land** (item 32) and the roll-up is not met. Smallest step: work the four NOT STARTED items (37, 48, 53, 59) and the field-filter gap in `packages/domain/src/views/user-views.ts`, which are the cheapest items still between here and "all of today's feedback". |
| 65 | Week after: Editor view in parallel with further UI changes | **PARTIAL** | The editor board shipped as its own sprint: `docs/tickets/in-progress/sprint-10-editor-kanban.md`, commit `e60069e` (EDIT-01…04 — board, Start, activity log, full page). | The "view" half is missing for the same reason as item 57: `apps/web/src/components/shell/nav.ts:68` is role-blind. Same next step as 57. |
| 66 | Later: role views for editors, customers/clients and creative strategists | **PARTIAL** | Clients have a dedicated interface: `apps/web/src/app/client/[brandSlug]/` (`ba28c9e`), separate from `/app`, with the field allowlist designed in `docs/design/sprint-06-client-field-allowlist.md`. Role-scoped **dashboards** exist (`CARD_KEYS_BY_ROLE`, `apps/web/src/lib/dashboard-source.ts:280-288`). | Editors and creative strategists have no view of their own: `apps/web/src/components/shell/nav.ts:68` shows every module to every role, and no `/app` route is guarded by role. Same next step as 57. |
| 67 | Later: import the remaining Airtable bases (full migration), then build the client-facing interface | **PARTIAL** | The importer is already base-parameterised: `packages/db/src/scripts/airtable-fetch.ts:54` takes `--base <baseId>` and `packages/db/src/airtable-tables.ts:67` resolves every table **by name** against that base's own metadata rather than by id (`0f05286`, PARITY-25) — the table-id swap between the two bases is documented at `airtable-tables.ts:4-11`. The client interface exists (see item 66). | Only one base has been imported. The blocker is per-base field names: `d5fd450` (PERSONAS-MAP) built the alias mechanism for **Personas only** (`PERSONA_FIELDS`, `packages/db/src/airtable-import.ts:746`), so every other table still reads one hard-coded field name (item 35 is one consequence). Smallest step: extend the alias lists in `packages/db/src/airtable-import.ts` table by table, running `packages/db/src/scripts/airtable-parity.ts --base <next base>` as the gate. |
| 68 | Later: mood boards, library, creative tracking and publishing after the migration | **PARTIAL** | Library: `apps/web/src/app/app/assets/` with R2 storage (`c290d5c`) and creator upload links (`apps/web/src/app/app/upload-links/`). Creative tracking: `apps/web/src/app/app/performance/` plus `ad_metrics` (`68463ab`). | Mood boards are a **category label only** — `apps/web/src/app/app/assets/asset-grid.tsx:21` (`mood_board: 'Mood Board'`); none of what `docs/PRD.md:300` asks for (embeds from Meta Ad Library / Instagram / TikTok / YouTube, comments, history, PNG export) exists. Publishing does not exist at all (it is item 63 and `docs/PRD.md` §16 "Ad launcher"). Smallest step: a `docs/tickets/` ticket for mood boards against `docs/PRD.md:300`, landing in a new `apps/web/src/app/app/mood-boards/` route. |
| 69 | Process: Talal gives the green light on the UI before the team moves on | **UNCLEAR** | This determines no observable outcome in the repository. Nothing records whether the green light was given: `docs/decisions.md`, `docs/decisions/` and `docs/tickets/` contain no sign-off entry, and the sprint tickets' "Pending human verification" sections (for example `docs/tickets/in-progress/sprint-08-user-views.md`) list live-mode checks, not a UI approval. | Ambiguous: what counts as the green light and what it gates. If it should be checkable, it belongs as a dated sign-off line in `docs/decisions.md` or a checkbox in `docs/tickets/sprint-2026-09-28-index.md`. |

---

## Blocked on Talal

Nine items. Eight of the owner's nine pins are confirmed below; the ninth, **item 30 (image
storage), is not blocked** — the R2 upload code is on `main` (`packages/db/src/r2.ts`,
`apps/web/src/app/app/ugc/actions.ts:265`), so it is reported PARTIAL above. What it needs is an R2
account and credentials (absent from `/Users/macbook/Tallas Tas/.env.local`) and an image upload
control, not a product decision. **Item 4 is added** to the list.

1. **Item 4 — which imported tables are not needed?** Only Talal knows which modules TAS actually
   works in; the importer now brings in all 21 Gratsi tables and the skip list was deliberately
   removed (`73035dc`, `packages/db/src/scripts/import-mappings.ts:1298`).
   *Question:* Of the 21 tables now imported — Products, Themes, Campaigns & Offers, Personas,
   Angles, Concepts, Collections, Creative Design, Meta Copywriting, Youtube Copywriting, UGC
   Management, Competitive research, Client Assets Organisation, Creative Dimensions, Creative
   Sheet, Creative Modules, SM Campaign Feed, Email Campaigns, Email Flows, Copy Type, Creative
   Reporting (`packages/db/src/airtable-tables.ts:20-42`) — which should the platform **not** carry
   at all, so we can drop the table, the route and the nav entry rather than keep dead modules?

2. **Item 27 — what happens to a field a client base has and the template does not?** Ten paired
   tables carry such fields; they are listed, unmapped and undropped, in
   `docs/decisions/gratsi-unmapped-fields-2026-10-02.md`.
   *Question:* When a client base carries a field the template base does not (for example Gratsi's
   `Passion` on Personas, or `Decription`, `Client's Comments` on Concepts), does the app show it for
   that client only, or not at all? The per-brand machinery for the first answer already exists
   (`brand_field_overrides`, `overridden_fields`).

3. **Item 33 — remove Internal Status from Concepts?** Neither Airtable base has such a field: the
   template's Concepts statuses are `Approval Status` and `Production Status`, Gratsi's are `Status`
   and `Production Status` (`docs/audits/base-field-mapping-2026-10-02.md:300-335`). The column is a
   platform invention and is currently `notNull` with a default
   (`packages/db/src/schema/concepts.ts:67`).
   *Question:* Does a Concept need an internal, team-only status at all, given it already has
   Approval Status (client-facing) and a hidden Production Status — and if not, do we drop the column
   or only stop showing it, the way Production Status was handled (`docs/decisions.md:684-688`)?

4. **Item 39 — keep or remove Script Idea on Concepts?** The field exists in both bases under
   different names: template `Script idea` (multilineText) ↔ Gratsi `Script` (richText)
   (`docs/audits/base-field-mapping-2026-10-02.md:316`); the column is
   `packages/db/src/schema/concepts.ts:57`.
   *Question:* Your team uses this as a rough flow rather than a script — keep the field as it is,
   rename it to what the team actually calls it, or remove it and let the brief hold the script?

5. **Item 43 — show linked concepts on the Angle record?** It is already built
   (`apps/web/src/app/app/angles/angle-panel.tsx:656-660`) and it mirrors Airtable, where the
   `Concepts` link exists on the Angles table in both bases
   (`docs/audits/base-field-mapping-2026-10-02.md:269`).
   *Question:* Keep the editable Concepts field on the Angle panel, make it read-only, or remove it?

6. **Item 44 — are Brief URL and Exact Script URL on Angles needed?** The premise at the meeting was
   that they do not exist in Airtable; the live metadata says otherwise — the Gratsi `Angles` table
   has `Brief` (url) and `Exact Script` (url) (`docs/audits/base-field-mapping-2026-10-02.md:286-287`).
   They are not in the template base.
   *Question:* Gratsi's Angles table really does have `Brief` and `Exact Script` as URL fields. Do we
   keep them (which means a client-only field the template lacks — see question 2), or drop them and
   accept losing whatever Gratsi has stored there?

7. **Item 60 — what may a client see of the pipeline?** The request ("how many ads are sent to
   editor, in editing and so on") names internal statuses, and `CLAUDE.md` non-negotiable 10 is
   "Clients see zero internal data: no internal statuses, budgets, creator costs, partnership
   prices". The two rules cannot both hold.
   *Question:* For the client progress bar, which stages may a client see, and under what names? Is
   an aggregate count per stage (no record-level detail, no internal status words — for example
   "4 in production, 2 awaiting your review") acceptable, or should clients see the TAS stage names?

8. **Items 61 and 62 — the Meta connection.** The read-only fetch and the per-concept storage are
   already coded (`apps/web/src/lib/meta-api.ts`, `packages/db/src/schema/ad-metrics.ts`), and
   `CLAUDE.md` non-negotiable 8 fixes the token as read-only with no write scopes, ever. Nothing can
   be imported or manually linked without the credentials.
   *Question:* Which Meta ad account(s) should we read, and who creates the read-only System User
   token — you on TAS's business account, or us with access you grant? Until that exists there are no
   ads for item 62's manual concept linking to link.

9. **Item 63 — the ad uploader service at ~$60/month.** That is ≈720 USD a year, above the whole
   platform budget: `CLAUDE.md` targets 500 USD/year total and `docs/decisions.md` D-006 budgets
   ≈260-340 USD/year for everything.
   *Question:* Is the ad uploader worth roughly 720 USD/year on top of the current ≈300 — and does it
   come out of the 500 USD platform ceiling or a separate line? Also: which service is it, so we can
   check its MCP and its permission model before committing.
