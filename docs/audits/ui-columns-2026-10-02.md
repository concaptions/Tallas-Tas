# Displayed column definitions in the app today — and the cost of making each config-driven

**Audit date:** 2026-10-02 · **Repo state:** `main` @ `d7842e7`, clean working tree (four untracked
`docs/audits/qa-*.md` files from sibling runs)
**Author:** Subagent D (read-only pass; no source file changed)
**Serves:** Airtable-style column inheritance — one PARENT base (`Creative Hub Template`) defines the
master column set per table; CHILD brands (Gratsi, Niagara Sleep Solutions, Mattress Central, Funky
Painting) inherit by default and may DETACH a column to relabel / hide / reorder it.

## How to read this document

Every claim is anchored to `file:line` at the commit named above. Column header text is quoted
**exactly as it appears in source** — including the sentence-case/title-case inconsistencies, which
are findings, not transcription errors (see [Duplicated labels](#duplicated-labels)).

Per column: **Header** (the string in the `<th>`), **Reads** (the row property the cell reads), and
**Origin** (the Drizzle column, or `computed` / `linked` / `generated`).
`computed` = derived in the route's `page.tsx` or a `fields.ts` helper. `linked` = resolved by
name/count through a junction table or an FK, not stored on this row's table. `generated` = an
auto-generated name or number (CLAUDE.md non-negotiable 6).

### The renderer classification this document uses

**Every `GridColumn` carries a `render` function — the interface requires it**
(`apps/web/src/components/views/airtable-grid.tsx:28`, `readonly render: (row: Row) => ReactNode`).
So "this page has renderers" is true of all fifteen grid pages and is not the discriminator.

The discriminator is **what the render body actually does**, and the answer turns on a module I
found only after a first pass: **`apps/web/src/components/views/grid-cells.tsx` is already a shared
cell-primitive library** — eight primitives (`TextCell`, `BoolCell`, `ChipCell`, `ChipListCell`,
`LinkCell`, `CountCell`, `DateCell`, `MoneyCell`), imported by **18 of the workspace pages**. Its own
doc comment states the contract (`:10-11`): *"Nothing here knows a vocabulary: the caller resolves
labels and tones through `@tas/domain` and hands them in."*

That splits renderers three ways:

| Class | What the render body is | Can a resolver own it? |
| --- | --- | --- |
| **S — shared** | Exactly one `grid-cells.tsx` primitive, or a styled text span over a value the server already formatted. Any variation is already a *parameter*: `maxWidth`, `mono`, `noun`, `align`. | **Yes.** A `{primitive, accessor, params}` record renders it. No code. |
| **V — vocabulary** | A primitive, plus a call into `@tas/domain/state` (or a module `fields.ts`) to turn a stored key into a label and a `ChipTone`. | **Mostly.** Needs a *named resolver reference* in a registry — one entry per vocabulary, not per column. |
| **C — composite** | Genuinely bespoke: emits its own element tree, reads more than one row property, or mounts a non-primitive component. | **No.** Stays code, keyed by column key. |

Counts below are of `GridColumn` objects and `<th>`/`<TableHead>` elements **as rendered** — where a
spread produces N columns I counted N; where one cell renders more than one stored field I counted
**one** column, because one header renders.

---

## Summary table

### A. Pages built on `AirtableGrid` (15 pages, 170 columns)

| Module | Route | Column definition | Cols | Hardcoded / config-driven | Renderers: S / V / **C (code, not data)** |
| --- | --- | --- | --- | --- | --- |
| angles | `/app/angles` | `angles-workspace.tsx:134` `ANGLE_COLUMNS` | 17 | **Hardcoded** literal array; `applyUserView`-controlled | 11 / 6 / **0** |
| client-assets | `/app/client-assets` | `client-assets-workspace.tsx:80` `CLIENT_ASSET_COLUMNS` | 5 | **Hardcoded**; uncontrolled | 2 / 1 / **2** — badge name, bespoke `<a>` |
| concepts | `/app/concepts` | `concepts-workspace.tsx:120` `CONCEPT_GRID_COLUMNS` | 21 | **Hardcoded**; `applyUserView`-controlled | **21 / 0 / 0** — every label and tone resolved server-side |
| copy-types | `/app/copy-types` | `copy-types-workspace.tsx:70` `COPY_TYPE_COLUMNS` | 5 | **Hardcoded**; uncontrolled | 2 / 2 / **1** — badge name |
| creative-modules | `/app/creative-modules` | `creative-modules-workspace.tsx:80` `CREATIVE_MODULE_COLUMNS` | 5 | **Hardcoded**; uncontrolled | 2 / 2 / **1** — badge name |
| creative-reporting | `/app/creative-reporting` | `creative-reporting-workspace.tsx:80` `COLUMNS` | 12 | **Hardcoded**; uncontrolled | 11 / 0 / **1** — badge name |
| creative-sheet | `/app/creative-sheet` | `creative-sheet-workspace.tsx:118` `CREATIVE_SHEET_COLUMNS` | 7 | **Hardcoded**; uncontrolled | 2 / 3 / **2** — `Tick`, `QaTicks` |
| email-campaigns | `/app/email-campaigns` | `email-campaigns-workspace.tsx:104` `COLUMNS` | 12 | **Hardcoded**; uncontrolled | 8 / 3 / **1** — badge name |
| email-flows | `/app/email-flows` | `email-flows-workspace.tsx:138` `EMAIL_FLOW_COLUMNS` | 9 | **Hardcoded**; uncontrolled | 6 / 2 / **1** — badge name |
| personas | `/app/personas` | `personas-workspace.tsx:101` `PERSONA_COLUMNS` | 7 | **Partly config-driven** — 4 of 7 are `...PERSONA_FIELDS.filter(…).map(…)` at `:112-118` | 6 / 1 / **0** |
| products | `/app/products` | `products-workspace.tsx:128` `PRODUCT_COLUMNS` | 10 | **Hardcoded**; `applyUserView`-controlled | 9 / 0 / **1** — badge name |
| sm-campaign-feed | `/app/sm-campaign-feed` | `sm-campaign-feed-workspace.tsx:79` `SM_TASK_COLUMNS` | 7 | **Hardcoded**; uncontrolled | 4 / 2 / **1** — badge name |
| themes | `/app/themes` | `themes-workspace.tsx:119` `THEME_COLUMNS` | 10 | **Hardcoded**; `applyUserView`-controlled | 7 / 2 / **1** — assignee attrs |
| ugc (Creators) | `/app/ugc` | `ugc-workspace.tsx:112` `CREATOR_COLUMNS` | **33** | **Partly config-driven** — 3 of 33 are `...creatorTracks(…).map(…)` at `:146-165` | 26 / 6 / **1** — avatar |
| youtube-copywriting | `/app/youtube-copywriting` | `youtube-copywriting-workspace.tsx:89` `COLUMNS` | 10 | **Hardcoded**; uncontrolled | 8 / 2 / **0** |
| **Totals** | | | **170** | | **125 / 32 / 13** |

**74% of grid columns (125/170) reduce to a shared primitive plus per-column data. 19% (32) add a
named vocabulary resolver. 8% (13) are genuinely bespoke** — and **8 of those 13 are the same
composite**: a frozen name cell beside `<PropagationBadge>`.

### B. Pages that hand-build a `@tas/ui` `<Table>` (11 tables on 10 routes, 69 columns)

These have **no column objects at all** — the cell is inline JSX in the row body.

| Module | Route | Header definition | Cols | Hardcoded / config-driven | Renderers: S / V / **C** |
| --- | --- | --- | --- | --- | --- |
| ai-characters | `/app/ai-characters` | `ai-characters-workspace.tsx:160-163` — 4 `<TableHead>` literals | 4 | **Hardcoded** (literal JSX) | 3 / 1 / **0** |
| campaigns-offers | `/app/campaigns-offers` | `campaigns-workspace.tsx:220-230` — 11 `<TableHead>` literals | 11 | **Hardcoded** (literal JSX) | 8 / 3 / **0** |
| collections | `/app/collections` | `collections-workspace.tsx:201-206` — 6 `<TableHead>` literals | 6 | **Hardcoded** (literal JSX) | 5 / 0 / **1** — badge name |
| competitive-research | `/app/competitive-research` | `fields.ts:94` `COMPETITIVE_RESEARCH_COLUMNS`, mapped at `:170` | 5 | **Config-driven headers** (`{key,label}[]`), **hardcoded cells** | 3 / 1 / **1** — badge name |
| creative-design | `/app/creative-design` | `fields.ts:94` `BRIEF_COLUMNS`, mapped at `briefs-workspace.tsx:437` | 6 | **Config-driven headers** (labels only, no keys), **hardcoded cells** | 4 / 1 / **1** — priority + SLA |
| creative-dimensions | `/app/creative-dimensions` | `creative-dimensions-workspace.tsx:156-159` — 4 `<TableHead>` literals | 4 | **Hardcoded** (literal JSX) | 3 / 0 / **1** — badge name |
| meta-copywriting | `/app/meta-copywriting` | `fields.ts:44` `COPY_COLUMNS`, mapped at `copywriting-workspace.tsx:276` | 6 | **Config-driven headers** (labels only), **hardcoded cells** | 4 / 0 / **2** — stacked title/headline, `Link` pill |
| notifications | `/app/notifications` | `fields.ts:27` `NOTIFICATION_COLUMNS` — 2 literals **+ `NOTIFICATION_CHANNELS.map(channelLabel)`**, mapped at `notification-row.tsx:148` | 4 | **Most config-driven in the app**: headers **and** cells both iterate `NOTIFICATION_CHANNELS` (`:112`) | 2 / 0 / **2** — interactive `<Switch>`es |
| propagation (promotions) | `/app/propagation` | `fields.ts:44` `PROMOTION_COLUMNS`, mapped at `promotion-row.tsx:303` | 7 | **Config-driven headers** (labels only), **hardcoded cells** | 4 / 1 / **2** — `DiffPreview`, decision controls |
| propagation (custom fields) | `/app/propagation` | `custom-fields-section.tsx:263-267` — 4 literals + conditional 5th | 4 | **Hardcoded** (literal JSX) | 4 / 0 / **1** (conditional action col) |
| propagation (child brands) | `/app/propagation` | `propagation-controls.tsx:74-75` — 2 `<TableHead>` literals | 2 | **Hardcoded** (literal JSX) | 2 / 0 / **0** |
| team | `/app/team` | `fields.ts:30` `TEAM_COLUMNS`, mapped at `team-table.tsx:30` | 4 | **Config-driven headers** (labels only), **hardcoded cells** | 2 / 1 / **1** — name + client-access note |
| ugc (Partnerships) | `/app/ugc` | `fields.ts:329` `PARTNERSHIP_COLUMNS`, mapped at `partnership-table.tsx:47` | 6 | **Config-driven headers** (labels only), **hardcoded cells** | 4 / 1 / **1** — countdown + row tinting |

### C. Pages that hand-build a raw `<table>` (4 pages, 28 columns)

| Module | Route | Header definition | Cols | Hardcoded / config-driven | Renderers: S / V / **C** |
| --- | --- | --- | --- | --- | --- |
| creator-ranking | `/app/creator-ranking` | `creator-leaderboard.tsx:43-50` — 8 `<th>` literals | 8 | **Hardcoded** (literal JSX) | 7 / 0 / **1** — medal glyph |
| onboarding-forms | `/app/onboarding-forms` | `onboarding-forms-table.tsx:41-45` — 5 `<th>` literals | 5 | **Hardcoded** (literal JSX) | 3 / 0 / **2** — stacked title, hand-rolled pill |
| performance | `/app/performance` | `performance-tracker.tsx:105-113` — 9 `<th>` literals | 9 | **Hardcoded** (literal JSX) | 9 / 0 / **0** |
| upload-links | `/app/upload-links` | `upload-links-table.tsx:39-44` — 6 `<th>` literals | 6 | **Hardcoded** (literal JSX) | 4 / 0 / **2** — `Link`, hand-rolled pill |

### D. Pages with no column definition at all

| Module | Route | What it renders |
| --- | --- | --- |
| ad-spy | `/app/ad-spy` | Card grid, `ad-spy-board.tsx:83-103` — no header row, no column array |
| assets | `/app/assets` | Card grid, `asset-grid.tsx:88-113` — no header row, no column array |
| concepts (Board) | `/app/concepts?view=kanban` | `concept-board.tsx:41` — one column **per internal status**; heading is `column.status.label`. Status columns, not field columns |
| queue/client | `/app/queue/client` | Kanban of `client-queue-card`s; columns are client statuses |
| queue/internal | `/app/queue/internal` | Kanban; `internal-queue-board.tsx:106` `groupByInternalStatus` — columns are internal statuses |
| interface-config | `/app/interface-config` | `config-tree.tsx` — a page/field toggle tree, not a record table |
| onboard | `/app/onboard` | `onboard-wizard.tsx` — a form wizard |
| briefs | `/app/briefs` | `page.tsx:16` `permanentRedirect` → `/app/creative-design` |
| campaigns | `/app/campaigns` | `page.tsx:16` `permanentRedirect` → `/app/campaigns-offers` |
| copywriting | `/app/copywriting` | `page.tsx:16` `permanentRedirect` → `/app/meta-copywriting` |

**Counts:** 15 `AirtableGrid` pages (170 cols) · 11 hand-built `<Table>`s on 10 routes (69 cols) ·
4 raw `<table>`s (28 cols) · 10 routes with no column definition (3 pure redirects).
**Total displayed columns: 267.**

---

## Per-module ordered dumps

### angles — `/app/angles`

`ANGLE_COLUMNS`, `apps/web/src/app/app/angles/angles-workspace.tsx:134-275`. **HARDCODED** literal
array; `applyUserView`-controlled (`:491`). Row type `AngleItem` (`:68`) =
`{ angle: AngleListRow, updatedLabel, updatedTitle }`; `AngleListRow = Angle & { personaIds,
productIds, personaName, productName }` (`packages/db/src/angles.ts:33`).
`pgTable angles`: `packages/db/src/schema/angles.ts:18-47`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.angle.name` | `angles.name` `:26` | **S** — `font-medium` span (frozen) |
| 2 | `Persona` | `item.angle.personaName` | **linked** — `angle_personas` → `personas.name` (`junction-tables.ts:87-94`; joined in TS at `angles.ts:80`) | **V** — `ChipCell` + `chipLabel` + `PERSONA_CHIP_TONE` |
| 3 | `Product` | `item.angle.productName` | **linked** — `angle_products` → `products.name` (`junction-tables.ts:104-111`) | **V** — `ChipCell` + `PRODUCT_CHIP_TONE` |
| 4 | `Status` | `item.angle.status` | `angles.status` `:36` | **V** — `angleStatusView` |
| 5 | `Potential` | `item.angle.potential` | `angles.potential` `:33` | **V** — `anglePotentialLabel`/`Tone` |
| 6 | `Winning` | `item.angle.winning` | `angles.winning` `:34` | **S** — `BoolCell` |
| 7 | `Formats to create` | `item.angle.formats` | `angles.formats` jsonb `:31` | **V** — `ChipListCell` + `angleFormatEntries` |
| 8 | `Type` | `item.angle.type` | `angles.type` jsonb `:30` | **V** — `ChipListCell` + `angleTypeEntries` |
| 9 | `Description` | `item.angle.description` | `angles.description` `:27` | **S** — `TextCell` |
| 10 | `Pain Points` | `item.angle.painPoints` | `angles.pain_points` `:28` | **S** — `TextCell` |
| 11 | `USP` | `item.angle.usp` | `angles.usp` `:29` | **S** — `TextCell` |
| 12 | `Ad Inspo` | `item.angle.adInspoLinks.length` | **computed** count over `angles.ad_inspo_links` jsonb `:32` | **S** — `CountCell` (`noun="link"`) |
| 13 | `Brief URL` | `item.angle.briefUrl` | `angles.brief_url` `:39` | **S** — `LinkCell` |
| 14 | `Exact Script URL` | `item.angle.exactScriptUrl` | `angles.exact_script_url` `:40` | **S** — `LinkCell` |
| 15 | `Internal Notes` | `item.angle.internalNotes` | `angles.internal_notes` `:37` | **S** — `TextCell` |
| 16 | `Client Notes` | `item.angle.clientNotes` | `angles.client_notes` `:38` | **S** — `TextCell` |
| 17 | `Updated` | `item.updatedLabel` / `item.updatedTitle` | **computed** — `relativeTime`/`absoluteTime` over `angles.updated_at` (`page.tsx:74-75`) | **S** — muted span |

**11 S / 6 V / 0 C.** Every one of the six V columns is a chip whose tone comes from a
`@tas/domain` lookup. No bespoke composite at all.

### client-assets — `/app/client-assets`

`CLIENT_ASSET_COLUMNS`, `client-assets-workspace.tsx:80-154`. **HARDCODED**. Uncontrolled grid
(`:254`, no `view` prop) → `AirtableGrid` renders its own localStorage Fields menu
(`airtable-grid.tsx:135-143`). `pgTable client_asset_folders`: `schema/client-asset-folders.ts:17-28`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Folder name` | `item.folder.name`, `.templateRowId`, `.overriddenFields` | `client_asset_folders.name` `:25` | **C** — name + `<PropagationBadge>` |
| 2 | `Description` | `item.folder.description` | `.description` `:26` | **S** — truncate + `cellTitle` |
| 3 | `Location` | `item.locationHost` | **computed** `hostLabel(locationUrl)` (`page.tsx:41`) over `.location_url` `:27` | **C** — bespoke `<a>` with `stopPropagation` on **click and keydown** plus a `data-slot` (`:118-132`); `LinkCell` does neither |
| 4 | `Linked designs` | `item.designCount` | **linked** — `folder.briefIds.length` (`page.tsx:42`) | **V** — `StatusChip` + `linkCountTone` + `designCountLabel` |
| 5 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** — muted span |

### concepts — `/app/concepts`

`CONCEPT_GRID_COLUMNS`, `concepts-workspace.tsx:120-251`. **HARDCODED**. `applyUserView`-controlled
(`:464`). Row type `ConceptItem`, `apps/web/src/app/app/concepts/fields.ts:175-205`.
`pgTable concepts`: `schema/concepts.ts:42-75`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.name` | `concepts.name` `:50` — **generated** (Batch-Angle-Theme, CLAUDE.md §6) | **S** — `font-mono` span + `data-slot` |
| 2 | `Batch` | `item.batch` | `concepts.batch` `:51` | **S** — `font-mono` |
| 3 | `Angle` | `item.angleName` | **linked** — `concept_angles` → `angles.name` (`junction-tables.ts:50-60`) | **S** |
| 4 | `Persona` | `item.personaName` | **linked, two hops** — inherited *through* the angle; `fields.ts:180` says "never stored on the concept" | **S** |
| 5 | `Product` | `item.productName` | **linked, two hops** — through the angle | **S** |
| 6 | `Theme` | `item.themeName` | **linked** — `concept_themes` → `themes.name` (`junction-tables.ts:73-77`) | **S** |
| 7 | `Internal Status` | `item.status.{tone,label}` | `concepts.internal_status` `:67` | **S** — tone/label **already resolved on the server** |
| 8 | `Client Status` | `item.clientStatus.{tone,label}` | `concepts.client_status` `:68` | **S** — pre-resolved |
| 9 | `Approval Status` | `item.approvalStatusLabel` | `concepts.approval_status` `:64` | **S** — `TextCell` |
| 10 | `Category` | `item.categoryLabel` | `concepts.category` `:52` | **S** — `TextCell` |
| 11 | `Concept Style` | `item.styleLabel` | `concepts.concept_style` `:53` | **S** — `TextCell` |
| 12 | `Formats to create` | `item.formatsToCreate` | `concepts.formats_to_create` jsonb `:65` | **S** — `ChipListCell`, constant `'accent'` tone |
| 13 | `Hook Examples` | `item.hookExamples` | `concepts.hook_examples` `:56` | **S** |
| 14 | `Script Idea` | `item.scriptIdea` | `concepts.script_idea` `:57` | **S** |
| 15 | `Description` | `item.description` | `concepts.description` `:60` | **S** |
| 16 | `Pain Points` | `item.painPoints` | `concepts.pain_points` `:61` | **S** |
| 17 | `USP` | `item.usp` | `concepts.usp` `:62` | **S** |
| 18 | `Client Comments` | `item.clientComments` | `concepts.client_comments` `:63` | **S** |
| 19 | `Collection` | `item.collectionName` | **linked** — `concept_collections` → `collections.name` (`junction-tables.ts:124-128`) | **S** |
| 20 | `Creators` | `item.creatorCount` | **linked** count | **S** — `CountCell` (`noun="creator"`) |
| 21 | `Ad Inspo` | `item.adInspoCount` | **computed** count over `concepts.ad_inspo_links` jsonb `:55` | **S** — `CountCell` (`noun="link"`) |

**21 S / 0 V / 0 C — the cleanest table in the app.** `ConceptItem` resolves every label, tone and
count on the server, so all 21 renderers are a primitive over a ready value. The widest grid is also
the cheapest to move.

> `concepts.production_status` is **deliberately not displayed** — `fields.ts:189`: "hidden from the
> list, the form and the panel; the column stays".

> **Dead column list.** `CONCEPT_COLUMNS` (`concepts/fields.ts:264-272`) is a 7-string tuple
> `['Name','Batch','Angle','Persona','Product','Theme','Internal Status']`. **Nothing renders it.**
> Its only consumers are its own unit test (`fields.test.ts:182`) and a prose comment
> (`concepts-workspace.tsx:116`). A resolver migration should delete it, not feed it.

### copy-types — `/app/copy-types`

`COPY_TYPE_COLUMNS`, `copy-types-workspace.tsx:70-126`. **HARDCODED**. Uncontrolled (`:225`).
`pgTable copy_types`: `schema/copy-types.ts:24-34`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.copyType.name` + propagation fields | `copy_types.name` `:32` | **C** — name + `<PropagationBadge>` |
| 2 | `Description` | `item.descriptionPreview` | **computed** `descriptionPreview()` (`page.tsx:36`) over `.description` `:33` | **S** |
| 3 | `Meta copies` | `item.metaCopies.length` | **linked** — `copywriting_copy_types` (`schema/copy-types.ts:49-55`) | **V** — `linkCountTone` + `metaCopyCountLabel` |
| 4 | `YouTube copies` | `item.youtubeCopies.length` | **linked** — `youtube_copy_copy_types` (`schema/youtube-copy.ts:132-138`) | **V** — `linkCountTone` + `youtubeCopyCountLabel` |
| 5 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` (`page.tsx:39`) | **S** |

### creative-modules — `/app/creative-modules`

`CREATIVE_MODULE_COLUMNS`, `creative-modules-workspace.tsx:80-132`. **HARDCODED**. Uncontrolled
(`:233`). `pgTable creative_modules`: `schema/creative-modules.ts:21-31`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Module name` | `item.creativeModule.moduleName` + propagation fields | `.module_name` `:29` | **C** — name + `<PropagationBadge>` |
| 2 | `Foreplay link` | `item.foreplayHost` | **computed** host over `.foreplay_link` `:30` | **S** |
| 3 | `Angles` | `item.angleCount` | **linked** — `creative_module_angles` (`:45-51`) | **V** — `linkCountTone` + `angleCountLabel` |
| 4 | `Creative designs` | `item.designCount` | **linked** — `creative_module_designs` (`:63-69`) | **V** — `linkCountTone` + `designCountLabel` |
| 5 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** |

### creative-reporting — `/app/creative-reporting`

`COLUMNS`, `creative-reporting-workspace.tsx:80-183`. **HARDCODED**. Uncontrolled (`:290`).
`pgTable creative_reporting`: `schema/creative-reporting.ts:39-59`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name + Angle + Offer` | `item.row.nameAngleOffer` + propagation fields | `.name_angle_offer` `:47` | **C** — name + `<PropagationBadge>` |
| 2 | `Creative` | `item.row.briefName` | **linked** — `.brief_id` `:48` → `creative_briefs.name` | **S** — `font-mono` |
| 3 | `CTR (%)` | `item.ctrLabel` | `.ctr` numeric `:52` | **S** — `Metric` (a mono span over a server-formatted label, `:70-72`) |
| 4 | `Thumb-stop rate` | `item.thumbStopLabel` | `.thumb_stop_rate` numeric `:53` | **S** — `Metric` |
| 5 | `Results` | `item.resultsLabel` | `.results` numeric `:54` | **S** — `Metric` |
| 6 | `CPA` | `item.cpaLabel` | `.cpa` numeric `:55` | **S** — `Metric` |
| 7 | `Target CPA` | `item.targetCpaLabel` | `.target_cpa` numeric `:56` | **S** — `Metric` |
| 8 | `Difference CPA` | `item.differenceCpa.{tone,label}` | **computed formula — NOT a stored column.** `creativeReportDifferenceCpa(cpa, targetCpa)` at `packages/db/src/creative-reporting.ts:67`; `cellTitle` says so verbatim (`:148`) | **S** — tone pre-resolved server-side |
| 9 | `ROAS` | `item.roasLabel` | `.roas` numeric `:57` | **S** — `Metric` |
| 10 | `Target ROAS` | `item.targetRoasLabel` | `.target_roas` numeric `:58` | **S** — `Metric` |
| 11 | `Ad link` | `item.adLinkHost` | **computed** host over `.ad_link` `:51` | **S** |
| 12 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** |

**11 S / 0 V / 1 C.** All seven metric cells are one reusable `Metric` primitive; the page formats
numbers on the server. `.notes` `:49` and `.ad_design` jsonb `:50` are stored but **not displayed**.

### creative-sheet — `/app/creative-sheet`

`CREATIVE_SHEET_COLUMNS`, `creative-sheet-workspace.tsx:118-170` — **the only column array that is
`export`ed**, and it is mounted by `design-system/creative-sheet.stories.tsx:114`. **HARDCODED**.
Uncontrolled (`:353`). `pgTable creative_sheet_items`: `schema/creative-sheet-items.ts:57-78`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.name` | **generated** — Airtable's "Name" formula (created-month + linked brief name); `CreativeSheetItemListRow = CreativeSheetItem & CreativeSheetBriefFields & { name: string }` (`packages/db/src/creative-sheet-items.ts:56-57`). **No `name` column exists on the table** | **S** — `font-mono` |
| 2 | `Brief` | `item.briefName` | **linked** — `.brief_id` `:65` → `creative_briefs.name` | **S** |
| 3 | `Internal Status` | `item.internalStatus` | `.internal_status` `:66` | **V** — `chipOrDash(internalStatusView(…))` |
| 4 | `Status` | `item.status` | `.status` `:67` | **V** — `chipOrDash(statusView(…))` |
| 5 | `Winning` | `item.winning` | `.winning` `:75` (text, not boolean) | **V** — `chipOrDash(winningView(…))` |
| 6 | `Used` | `item.used` | `.used` `:73` | **C** — bespoke `<Tick on label>` |
| 7 | `QA` | `QA_CHECKS.filter(c => item[c.name])` | **three stored columns in one cell** — `.qa_video_editor` `:69`, `.qa_designer` `:70`, `.qa_strategist` `:71`, via `QA_CHECKS` (`fields.ts:136-140`) | **C** — `QaTicks` |

> Column 7 is the sharpest case in the repo of a cell that is **not one column**: one header, one
> `render`, three Drizzle booleans. A resolver assuming column ↔ field 1:1 cannot describe it.

### email-campaigns — `/app/email-campaigns`

`COLUMNS`, `email-campaigns-workspace.tsx:104-199`. **HARDCODED**. Uncontrolled (`:418`).
`pgTable email_campaigns`: `schema/email-campaigns.ts:33-53`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.row.name` + propagation fields | `.name` `:41` | **C** — name + `<PropagationBadge>` |
| 2 | `Status` | `item.row.status` | `.status` `:43` | **V** — `Choice` + `statusView` |
| 3 | `Type` | `item.row.type` | `.type` `:51` | **V** — `Choice` + `typeView` |
| 4 | `Channel` | `item.row.channel` | `.channel` `:52` | **V** — `Choice` + `channelView` |
| 5 | `Send date` | `item.row.sendDate` | `.send_date` date `:44` | **S** — `MonoDate` |
| 6 | `Design due` | `item.row.designDueDate` | **computed formula** — `sendDate − 5 days` (`packages/db/src/email-campaigns.ts:74-76`); `cellTitle` at `:149` | **S** — `MonoDate` |
| 7 | `Copywriting due` | `item.row.copywritingDueDate` | **computed formula** — `sendDate − 10 days`; `cellTitle` at `:156` | **S** — `MonoDate` |
| 8 | `Assignee` | `item.row.assigneeName` | **linked** — `.assignee_id` `:46` → `users.full_name` | **S** |
| 9 | `Klaviyo` | `item.klaviyoHost` | **computed** host over `.klaviyo_link` `:49` | **S** |
| 10 | `Copy link` | `item.copyHost` | **computed** host over `.copy_link` `:47` | **S** |
| 11 | `Campaigns & Offers` | `item.row.campaignOfferNames` | **linked** — `email_campaign_campaigns` (`:68-74`) | **S** — chip list with constant `'info'` tone |
| 12 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** |

### email-flows — `/app/email-flows`

`EMAIL_FLOW_COLUMNS`, `email-flows-workspace.tsx:138-228`. **HARDCODED**. Uncontrolled (`:240`).
`pgTable email_flows`: `schema/email-flows.ts:32-50`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Flow name` | `item.flow.flowName` + propagation fields | `.flow_name` `:40` | **C** — name + `<PropagationBadge>` |
| 2 | `Status` | `item.flow.status` | `.status` `:43` | **V** — `statusLabel`/`statusTone` |
| 3 | `Type` | `item.flow.type` | `.type` `:47` | **V** — `typeLabel`/`typeTone` |
| 4 | `Expected setup date` | `item.setupLabel` | `.expected_setup_date` date `:41` | **S** — raw ISO in `cellTitle` |
| 5 | `Design due` | `item.designDueLabel` | **computed formula** (no stored column) | **S** — `font-mono` |
| 6 | `Copywriting due` | `item.copywritingDueLabel` | **computed formula** (no stored column) | **S** — `font-mono` |
| 7 | `Assignee` | `item.flow.assigneeName` | **linked** — `.assignee_id` `:49` → `users.full_name` | **S** |
| 8 | `Klaviyo link` | `item.klaviyoHost` | **computed** host over `.klaviyo_link` `:46` | **S** |
| 9 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** |

### personas — `/app/personas` — *the page the resolver will replace*

`PERSONA_COLUMNS`, `personas-workspace.tsx:101-139`. **PARTLY CONFIG-DRIVEN** — this is the shape the
goal names. `applyUserView`-controlled (`:339`). `pgTable personas`: `schema/personas.ts:14-50`.

Three literals wrapped around one spread:

```
:101  const PERSONA_COLUMNS: readonly GridColumn<PersonaItem>[] = [
:102-109    { key: 'name', header: 'Name', frozen: true, … }          ← literal
:112-118    ...PERSONA_FIELDS.filter(f => f.name !== 'name' && f.name !== 'stageOfAwareness')
                              .map(field => ({ key: field.name, header: field.label, … }))
:119-132    { key: 'stageOfAwareness', header: 'Problem-Solution Awareness Level', … }  ← literal
:133-138    { key: 'angles', header: 'Angles', … }                     ← literal
```

`PERSONA_FIELDS = PERSONA_FIELD_GROUPS.flatMap(g => g.fields)` (`personas/fields.ts:86-88`), and
`PERSONA_FIELD_GROUPS` (`:53-65`) is **already a label/field/kind table** — the resolver's payload
shape minus visibility and position. The comment at `:44-46` states the labels are Gratsi's field
names, "a relabelling in the UI only; no column was renamed in the database." **That is column
inheritance implemented by hand, for one brand.**

| # | Header | Reads | Origin | Renderer | Source |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `item.persona.name` | `personas.name` `:23` | **S** (frozen) | literal `:104` |
| 2 | `Description [Age Status Salary]` | `item.persona.demographic` | `.demographic` `:32` | **S** — `TextCell` | **spread** ← `fields.ts:58` |
| 3 | `Personality` | `item.persona.psychographic` | `.psychographic` `:33` | **S** — `TextCell` | **spread** ← `fields.ts:59` |
| 4 | `Drivers for this persona` | `item.persona.coreDesires` | `.core_desires` `:34` | **S** — `TextCell` | **spread** ← `fields.ts:60` |
| 5 | `Passion` | `item.persona.passion` | `.passion` `:40` | **S** — `TextCell` | **spread** ← `fields.ts:61` |
| 6 | `Problem-Solution Awareness Level` | `item.persona.stageOfAwareness` | `.stage_of_awareness` **pgEnum** `:45` | **V** — `awarenessTone`/`awarenessLabel` | literal `:121` |
| 7 | `Angles` | `item.persona.angleNames.join(', ')` | **linked** — `angle_personas` → `angles.name` | **S** — `TextCell` | literal `:135` |

**Nine stored columns are deliberately hidden**, listed in `PERSONA_HIDDEN_FIELDS`
(`personas/fields.ts:72-83`): `dayInTheLife`, `emotionalTriggers`, `painPoints`, `successFactors`,
`perceivedBarriers`, `buyingTriggers`, `problemChallenge`, `successTransformation`, `triggerWords`,
plus `productId`. Both `schema/personas.ts:24-30` and `fields.ts:48-51` say per-brand visibility
"belongs in `brand_field_overrides`". **That table does not exist** — see
[What I could not establish](#what-i-could-not-establish).

### products — `/app/products`

`PRODUCT_COLUMNS`, `products-workspace.tsx:128-201`. **HARDCODED**. `applyUserView`-controlled
(`:395`). `pgTable products`: `schema/products.ts:11-22` — only **three** business columns; seven of
the ten displayed columns are link counts.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Product name` | `item.product.name` + propagation fields | `products.name` `:19` | **C** — name + `<PropagationBadge>` |
| 2 | `Landing page URL` | `item.linkHost` | **computed** `hostLabel(link)` (`page.tsx:75`) over `.link` `:20` | **S** |
| 3 | `Collection link` | `item.collectionHost` | **computed** over `.collection_link` `:21` | **S** |
| 4 | `Angles` | `item.product.angleNames` | **linked** — `angle_products` (`products.ts:28`) | **S** — `TextCell` of joined names |
| 5 | `Concepts` | `item.product.conceptCount` | **linked** count (`products.ts:89`) | **S** — `CountCell` (`noun="concept"`) |
| 6 | `Creative Designs` | `item.creativeDesigns.length` | **linked** — `creative_briefs.product_id` (`page.tsx:81`) | **S** — `CountCell` (`noun="design"`) |
| 7 | `Creators` | `item.creators.length` | **linked** — `creator_products` (`page.tsx:82`) | **S** — `CountCell` (`noun="creator"`) |
| 8 | `Email Campaigns` | `item.emailCampaigns.length` | **linked** — `email_campaign_products` (`page.tsx:79`) | **S** — `CountCell` (`noun="campaign"`) |
| 9 | `YouTube Copy` | `item.youtubeCopy.length` | **linked** — `youtube_copy_products` (`page.tsx:80`) | **S** — `CountCell` (`noun="copy"`) |
| 10 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` (`page.tsx:77`) | **S** |

### sm-campaign-feed — `/app/sm-campaign-feed`

`SM_TASK_COLUMNS`, `sm-campaign-feed-workspace.tsx:79-161`. **HARDCODED**. Uncontrolled (`:355`).
`pgTable sm_campaign_feed_tasks`: `schema/sm-campaign-feed-tasks.ts:25-38` — every stored business
column is displayed, plus one computed one.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Task` | `item.task.taskName` + propagation fields | `.task_name` `:33` | **C** — name + `<PropagationBadge>` |
| 2 | `Platform` | `item.task.platform` | `.platform` `:34` | **V** — `platformLabel`/`platformTone` |
| 3 | `Due date` | `item.dueLabel` | **computed** over `.due_date` `:35` | **S** |
| 4 | `Status` | `item.task.status` | `.status` `:36` | **V** — `statusLabel`/`statusTone` |
| 5 | `Reminder` | `item.reminder` | **computed** — `'due'` vs not, derived from `.due_date` | **S** — constant `REMINDER_TONE`/`REMINDER_LABEL` |
| 6 | `Notes` | `item.task.notes` | `.notes` `:37` | **S** — truncate + `cellTitle` |
| 7 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** |

### themes — `/app/themes` (GLOBAL table)

`THEME_COLUMNS`, `themes-workspace.tsx:119-209`. **HARDCODED**. `applyUserView`-controlled (`:511`).
`pgTable themes`: `schema/themes.ts:18-34`. **`brand_id` is constrained null** —
`check('themes_global', sql\`${table.brandId} is null\`)` `:33`, which is CLAUDE.md non-negotiable 3.
**Column inheritance must treat this table differently from every other one: there is no per-brand
row to detach.**

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `theme.name` | `themes.name` `:22` | **S** — frozen, `data-slot="theme-name"` |
| 2 | `Category` | `theme.category` | `themes.category` **pgEnum** `:23` | **V** — `themeCategoryLabel`/`Tone` |
| 3 | `Status` | `theme.status` | `themes.status` `:27` | **V** — `statusChip` |
| 4 | `Assignee` | `assigneeValue(theme)` | **linked, fallback-to-stored** — `.assignee_id` `:26` → `users.full_name`; an imported Gratsi row stores a collaborator display name matching no Clerk id and renders as-is (`packages/db/src/themes.ts:41-48`) | **C** — span carries `data-resolved` computed from `assignee.mono` |
| 5 | `Notes` | `theme.notes` | `themes.notes` `:25` | **S** — `TextCell` |
| 6 | `Attachments` | `attachmentChipRow(theme.attachments)` | `.attachments` jsonb `:28` | **S** — `CountCell` (`noun="file"`) |
| 7 | `Attachment Summary` | `theme.aiAttachmentSummary` | `.ai_attachment_summary` `:29` | **S** — `TextCell` |
| 8 | `Reference Links` | `referenceChipRow(theme.referenceLinks)` | `.reference_links` jsonb `:24` | **S** — `CountCell` (`noun="link"`) |
| 9 | `Used by` | `theme.usedByBrandCount` | **computed, cross-brand** — distinct brands with a live concept on the theme, counted deliberately **outside** `withBrand` (`packages/db/src/themes.ts:52-63`) | **S** — `usageLabel` |
| 10 | `Active` | `theme.isActive` | `.is_active` `:30` | **S** — ternary `'Active'`/`'Archived'` |

### ugc (Creators tab) — `/app/ugc`

`CREATOR_COLUMNS`, `ugc-workspace.tsx:112-364`. **PARTLY CONFIG-DRIVEN** — 30 literal `key:` entries
plus one 3-element spread = **33 columns**, the widest table in the app.
`applyUserView`-controlled (`:634`). `pgTable creators`: `schema/creators.ts:82-148`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `creator.name`, `creator.profilePicUrl` | `.name` `:93` + `.profile_pic_url` `:97` | **C — the app's only avatar cell.** `<img>` when a URL exists, else an initials tile on `bg-surface3` (`:121-139`). Two row properties, one cell |
| 2 | `Internal Status` | `creatorTracks(creator)` → `internal` | `.internal_creator_status` `:114` | **V** — **spread** `:146-165` |
| 3 | `Client Status` | `creatorTracks(creator)` → `client` | `.client_status` `:117` | **V** — **spread** |
| 4 | `Assets Status` | `creatorTracks(creator)` → `assets` | `.internal_assets_status` `:118` | **V** — **spread** |
| 5 | `Gender` | `creator.gender` | `.gender` `:95` | **S** — `TextCell` |
| 6 | `Age Bracket` | `creator.ageBracket` | `.age_bracket` `:94` | **V** — `ageBracketLabel` + `data-slot` |
| 7 | `Ethnicity` | `creator.ethnicity` | `.ethnicity` `:96` | **S** — `TextCell` |
| 8 | `Platform` | `creator.platform` | `.platform` jsonb `:100` | **V** — `ChipListCell` + `creatorPlatformLabel` |
| 9 | `Creator Link` | `creator.creatorLink` | `.creator_link` `:99` | **S** — `LinkCell` |
| 10 | `Instagram Username` | `creator.instagramUsername` | `.instagram_username` `:124` | **S** — `TextCell mono` |
| 11 | `Facebook Profile` | `creator.facebookProfileUrl` | `.facebook_profile_url` `:145` | **S** — `LinkCell` |
| 12 | `Linked Concepts` | `creator.conceptIds.length` | `.concept_ids` jsonb `:110` | **S** — `CountCell` (`noun="concept"`) |
| 13 | `Linked Products` | `creator.productIds.length` | `.product_ids` jsonb `:111` | **S** — `CountCell` (`noun="product"`) |
| 14 | `Internal Brief` | `creator.internalBrief` | `.internal_brief` `:101` | **S** |
| 15 | `Client's Note` | `creator.clientNote` | `.client_note` `:121` | **S** |
| 16 | `Creator Info Request` | `creator.creatorInfoRequest` | `.creator_info_request` `:147` | **S** |
| 17 | `Raw Assets URL` | `creator.rawAssetsUrl` | `.raw_assets_url` `:109` | **S** — `LinkCell` |
| 18 | `Video Intro` | `creator.videoIntroUrl` | `.video_intro_url` `:98` | **S** — `LinkCell` |
| 19 | `Shipping Location` | `creator.shippingLocation` | `.shipping_location` `:102` | **S** |
| 20 | `Tracking Number` | `creator.trackingNumber` | `.tracking_number` `:103` | **S** — `TextCell mono` |
| 21 | `Date of Management` | `creator.dateOfManagement` | `.date_of_management` `:104` | **S** — `DateCell` |
| 22 | `Budget per 60sec Video` | `creator.budgetPer60s` | `.budget_per_60s` `:106` | **S** — `MoneyCell` |
| 23 | `Creator Cost (USD)` | `creator.creatorCost` | `.creator_cost` `:107` | **S** — `MoneyCell` |
| 24 | `Paid by TAS (USD)` | `creator.costUsd` | `.cost_usd` `:108` | **S** — `MoneyCell` |
| 25 | `Payment Date` | `creator.paymentDate` | `.payment_date` `:146` | **S** — `DateCell` |
| 26 | `Partnership Activity` | `creator.partnershipActivity` | `.partnership_activity` `:126` | **V** — `partnershipActivityChip` |
| 27 | `Date of Partnership Activation` | `creator.partnershipActivatedAt` | `.partnership_activated_at` `:129` | **S** — `DateCell` |
| 28 | `Partnership Period (days)` | `creator.partnershipPeriodDays` | `.partnership_period_days` `:130` | **S** — `font-mono` |
| 29 | `Extension (days)` | `creator.extensionDays` | `.extension_days` `:132` | **S** — `font-mono` (0 renders as the dash) |
| 30 | `Partnership Price per 30 Days` | `creator.partnershipPricePer30Days` | `.partnership_price_per_30_days` `:133` | **S** — `MoneyCell` |
| 31 | `Continue Working With?` | `creator.continueWorkingWith` | `.continue_working_with` `:131` | **S** — `BoolCell` |
| 32 | `Partnership Notes` | `creator.partnershipNotes` | `.partnership_notes` `:144` | **S** |
| 33 | `Slack Notified` | `creator.slackNotified` | `.slack_notified` `:134` | **S** — `BoolCell` |

**26 S / 6 V / 1 C.** Despite being the widest table, the renderers are overwhelmingly shared
primitives — the `grid-cells.tsx` library carries almost all of it.

The spread at `:146-165` is **not** a field-list spread like personas'. It calls
`creatorTracks({internalCreatorStatus:'', clientStatus:'', internalAssetsStatus:''})` with **dummy
empty values purely to enumerate the three track keys**, then each `render` calls `creatorTracks`
again on the real row and `.find()`s its own track back out. `CREATOR_TRACKS`
(`ugc/fields.ts:91-95`) is the actual data: `[{key:'internal',label:'Internal'},
{key:'client',label:'Client'}, {key:'assets',label:'Assets'}]` — verified to return exactly three
entries (`fields.ts:121`, `:127`, `:133`). The header is a template string,
`` `${track.label} Status` `` (`:152`), so rows 2-4's headers are **computed** and no literal
`'Internal Status'` string exists in this file.

> **Non-negotiable 10 lives in this table.** Columns 22-24 and 30 are internal money figures; the
> comment at `:109-111` records that this grid is the team workspace and never the client interface.
> A resolver controlling per-brand visibility must not be able to expose these on a client surface.

### youtube-copywriting — `/app/youtube-copywriting`

`COLUMNS`, `youtube-copywriting-workspace.tsx:89-164`. **HARDCODED**. Uncontrolled (`:333`).
`pgTable youtube_copy`: `schema/youtube-copy.ts:52-72`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Copy #` | `item.title` (sorts on `item.copyNumber`) | **generated** — `copyNumberLabel(copyNumber)` (`fields.ts:190`) over `.copy_number` `:60` | **S** — `font-mono` + `data-slot`. **Header names the number; the cell renders the generated title** |
| 2 | `Headline` | `item.headline` | `.headline` `:64` | **S** |
| 3 | `Descriptions` | `item.descriptions` | `.descriptions` `:63` | **S** — truncate + `cellTitle` |
| 4 | `Status` | `item.statusTone` / `item.statusLabel` | `.status` `:61` | **S** — pre-resolved server-side |
| 5 | `CTA` | `item.ctaLabel` | `.cta` `:66` | **S** |
| 6 | `Funnel` | `item.funnelLabel` | `.funnel` `:67` | **S** |
| 7 | `Used` | `item.used` | `.used` `:69` | **V** — `booleanChip` |
| 8 | `Winning` | `item.winning` | `.winning` `:70` | **V** — `booleanChip` |
| 9 | `Meta rating` | `item.metaRating` | `.meta_rating` `:71` | **S** — `metaRatingLabel` in `font-mono` |
| 10 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** |

> `.angle` `:62`, `.news_feed` `:65`, `.client_comment` `:68` are stored but **not displayed**.

### ai-characters — `/app/ai-characters`

Four `<TableHead>` literals, `ai-characters-workspace.tsx:160-163`; cells `:223-244`.
**HARDCODED, both axes.** `pgTable ai_characters`: `schema/ai-characters.ts:15-35`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `character.name` | `.name` `:23` | **S** |
| 2 | `Status` | `character.status` | `.status` `:25` | **V** — `aiCharacterStatusTone`/`Label` |
| 3 | `Basic Info` | `basicInfoPreview(character.basicInfo)` | `.basic_info` `:26` | **S** — truncate + `title` |
| 4 | `Updated` | `updatedLabel` | **computed** over `.updated_at` | **S** |

> Nine stored columns **not displayed**: `attachments`, `tone_of_voice`, `voice_link`,
> `personality_traits`, `appearance`, `traits_and_habits`, `hobbies_and_lifestyle`,
> `work_and_background`, `why_promotes_brand` (`:24-34`).

### campaigns-offers — `/app/campaigns-offers`

Eleven `<TableHead>` literals, `campaigns-workspace.tsx:220-230`; cells `:294-339`.
**HARDCODED, both axes.** `pgTable campaigns_offers`: `schema/campaigns.ts:28-49`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `campaign.name` | `.name` `:36` | **S** — `font-mono` |
| 2 | `Holiday` | `campaign.holiday` | `.holiday` `:37` | **S** |
| 3 | `Offer` | `campaign.discountOffer` | `.discount_offer` `:38` | **S** |
| 4 | `Code` | `campaign.code` | `.code` `:39` | **S** — `font-mono` |
| 5 | `Official Date` | `formatDate(campaign.officialDate)` | `.official_date` date `:40` | **S** |
| 6 | `Ads Launch` | `formatDate(campaign.adsLaunchDate)` | `.ads_launch_date` date `:46` | **S** |
| 7 | `Ads End` | `formatDate(campaign.adsEndDate)` | `.ads_end_date` date `:47` | **S** |
| 8 | `Confirmed` | `campaign.confirmedByClient` | `.confirmed_by_client` `:44` | **V** — chip with inline `'Yes'`/`'No'` literals (`:318`) |
| 9 | `Launched` | `campaign.launched` | `.launched` `:45` | **V** — inline `'Yes'`/`'No'` (`:324`) |
| 10 | `Product` | `productMap.get(campaign.productId)` | **linked** — `.product_id` `:48` → `products.name` | **V** — chip |
| 11 | `Updated` | `updatedLabel` | **computed** over `.updated_at` | **S** |

> `.country` `:41`, `.description` `:42`, `.promotional_ideas` `:43` stored, not displayed.

### collections — `/app/collections`

Six `<TableHead>` literals, `collections-workspace.tsx:201-206`; cells `:266-292`.
**HARDCODED, both axes.** `pgTable collections`: `schema/collections.ts:17-33`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `collection.name` + propagation fields | `.name` `:25` | **C** — name + `<PropagationBadge>` |
| 2 | `URL` | `urlHost` | **computed** host over `.url` `:26` | **S** |
| 3 | `Campaign` | `collection.campaignName` | **linked** — `.campaign_id` `:27` → `campaigns_offers.name` | **S** |
| 4 | `Angle` | `collection.angleName` | **linked** — `.angle_id` `:28` → `angles.name` | **S** |
| 5 | `Product` | `collection.productName` | **linked** — `.product_id` `:29` → `products.name` | **S** |
| 6 | `Updated` | `updatedLabel` | **computed** over `.updated_at` | **S** |

> `.creative_design_note` `:30`, `.copywriting_id` `:31`, `.creative_design_2_id` `:32` stored, not
> displayed.

### competitive-research — `/app/competitive-research`

**Headers config-driven, cells not.** `COMPETITIVE_RESEARCH_COLUMNS`
(`competitive-research/fields.ts:94-100`) is `readonly {key, label}[]` — **the only hand-built table
whose list carries keys as well as labels** — mapped at `competitive-research-workspace.tsx:170-174`;
`colSpan` reads its `.length` (`:180`). Its doc comment at `fields.ts:88` says "The workspace maps
this list; it does not hardcode it." **But the cells at `:234-261` are five positional
`<TableCell>`s with no reference to the keys**, so reordering the list reorders the headers and
**silently mismatches the data**. `pgTable competitive_research`: `schema/competitive-research.ts:12-33`.

| # | Header (`label`) | `key` | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `name` | `entry.name` + propagation fields | `.name` `:20` | **C** — name + `<PropagationBadge>` |
| 2 | `Type` | `type` | `entry.type` | `.type` `:21` | **V** — `typeTone` |
| 3 | `Website` | `website` | `websiteHost` | **computed** host over `.website` `:22` | **S** |
| 4 | `Instagram` | `instagram` | `entry.instagram` | `.instagram` `:23` | **S** |
| 5 | `Updated` | `updated` | `updatedLabel` | **computed** over `.updated_at` | **S** |

> `.facebook_page` `:24`, `.meta_ads_library` `:25`, `.analysis` `:26` stored, not displayed.

### creative-design — `/app/creative-design`

**Headers config-driven, labels only.** `BRIEF_COLUMNS` (`creative-design/fields.ts:94-101`) is an
`as const` tuple of six **bare strings** — no keys — mapped at `briefs-workspace.tsx:437-441`; cells
`:461-494` positional. `pgTable creative_briefs`: `schema/briefs.ts:75-131` — **57 columns, six
displayed.** The widest gap between stored and shown in the repo.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.name` | `.name` `:89` — **generated** (`{FUNNEL}{FORMAT}{NUMBER}-BATCH-CONCEPT-VERSION`, CLAUDE.md §6) | **S** — `font-mono` |
| 2 | `Concept` | `item.conceptName` | **linked, nullable by design** — `.concept_id` `:83` → `concepts.name`; a null renders a `STANDALONE_CONCEPT_SLUG` chip (`:470`), which is CLAUDE.md non-negotiable 5 | **V** |
| 3 | `Type` | `item.typeLabel` | `.type` `:93` | **S** |
| 4 | `Priority` | `item.priority.{tone,label,sla}` | `.priority` `:96` | **C** — chip **plus** an SLA string beside it (`:479-486`) |
| 5 | `Assignee` | `item.assignee` | `.assignee` `:97` (free text, not an FK) | **S** |
| 6 | `Internal Status` | `item.status.{tone,label}` | `.internal_status` `:121` | **S** — pre-resolved |

### creative-dimensions — `/app/creative-dimensions`

Four `<TableHead>` literals, `creative-dimensions-workspace.tsx:156-159`; cells `:219-236`.
**HARDCODED, both axes.** `pgTable creative_dimensions`: `schema/creative-dimensions.ts:13-31`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `dimension.name` + propagation fields | `.name` `:21` | **C** — name + `<PropagationBadge>` |
| 2 | `Dimensions` | `dimension.dimensions` | `.dimensions` `:22` | **S** — `font-mono` |
| 3 | `Link Description` | `dimension.linkDescription` | `.link_description` `:23` | **S** |
| 4 | `Updated` | `updatedLabel` | **computed** over `.updated_at` | **S** |

> `.creative_design_id` `:24` stored, not displayed.

### meta-copywriting — `/app/meta-copywriting`

**Headers config-driven, labels only.** `COPY_COLUMNS` (`meta-copywriting/fields.ts:44-51`) is an
`as const` tuple of six bare strings, mapped at `copywriting-workspace.tsx:276-280`; cells `:301-353`
positional. `pgTable copywriting`: `schema/copy.ts:57-79`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Copy title / Headline` | `item.title` **and** `item.headline` | **generated** `copyTitle(copyNumber)` over `.copy_number` `:68`, **plus** `.headline` `:70` | **C** — two stored values stacked in one cell (`:301-314`). `fields.ts:39-42`: splitting them would be the fifth column PRD §5.11 rules out |
| 2 | `Linked Creative` | `item.creativeName`, `item.creativeHref` | **linked** — `.creative_brief_id` `:65` → `creative_briefs.name` | **C** — `Link` pill with `stopPropagation` (`:321-330`) |
| 3 | `Concept` | `item.conceptName` | **linked** — `.concept_id` `:66` → `concepts.name` | **S** — mono pill |
| 4 | `Funnel` | `copyFunnelLabel(item.funnel)` | `.funnel` `:73` | **S** |
| 5 | `Status` | `item.statusTone` / `item.statusLabel` | `.status` `:79` | **S** — pre-resolved |
| 6 | `Updated` | `item.updatedLabel` | **computed** over `.updated_at` | **S** |

> Column 1 is the second case (after creative-sheet's `QA`) of one header over more than one field.
> **Count mismatch:** the comment at `fields.ts:37` says "The list's four columns", the tuple holds
> six, and six render. The prose is stale.

### notifications — `/app/notifications`

**The most config-driven table in the app, on both axes.** `NOTIFICATION_COLUMNS`
(`notifications/fields.ts:27-31`) is
`['Trigger', 'Recipient', ...NOTIFICATION_CHANNELS.map(channelLabel)]`. Headers map it
(`notification-row.tsx:148-152`), `colSpan` reads its `.length` (`:159`), **and the cells iterate the
same `NOTIFICATION_CHANNELS`** (`:112-122`). Adding a channel adds a header and a cell together.
`NOTIFICATION_CHANNELS = ['slack', 'email']` (`packages/domain/src/notifications/channels.ts:17`), so
**4 columns today**.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Trigger` | `item.label` | **domain vocabulary**, not a stored column | **S** |
| 2 | `Recipient` | `item.recipient` | **computed** from the brand's team assignment (CLAUDE.md non-negotiable 7) | **S** — muted when `item.unrouted` |
| 3 | `channelLabel('slack')` | `channelValue(item, 'slack')` | `notifications` per-channel flag | **C** — interactive `<Switch>` |
| 4 | `channelLabel('email')` | `channelValue(item, 'email')` | `notifications` per-channel flag | **C** — interactive `<Switch>` |

This is a settings matrix, not a record list — the closest thing in the repo to the target shape and
the **worst** fit for a record-table column resolver.

### propagation — `/app/propagation` (three tables)

**(a) Promotion requests.** `PROMOTION_COLUMNS` (`propagation/fields.ts:44-52`) — `as const` tuple of
seven bare strings, mapped at `promotion-row.tsx:303-307`; `colSpan` reads `.length` (`:314`); cells
`:203-266` positional.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Brand` | `item.brand.{text,muted}` | `promotion_requests` → `brands.name` | **V** — tone flips to `warn` on a soft-deleted brand (`:211`) |
| 2 | `Table` | `item.tableName` | `promotion_requests.table_name` | **S** — `font-mono` |
| 3 | `Field` | `item.fieldName` | `promotion_requests.field_name` | **S** — `font-mono` |
| 4 | `Requested by` | `item.requestedBy` | **linked** → `users` | **S** |
| 5 | `Requested at` | `item.requestedAt` / `…Title` | **computed** over `created_at` | **S** |
| 6 | `Change` | `<DiffPreview item>` | **computed diff** of old vs new value | **C** |
| 7 | `Decision` | `item.statusTone/statusLabel`, `item.pending` | status + decision metadata | **C** — chip plus either approve/reject controls with a note `<Input>`, or the decided-by/review-note stack (`:239-266`) |

**(b) Custom field schemas.** Four `<TableHead>` literals + one conditional,
`custom-fields-section.tsx:263-267`. **HARDCODED.** Reads `custom_field_schemas`
(`schema/custom-field-schemas.ts:16-36`): `Table` ← `.table_name`, `Key` ← `.field_key`,
`Label` ← `.field_label` (`:288`), `Type` ← `.field_type`, plus a demo-gated action column.

**(c) Child brands.** Two `<TableHead>` literals, `propagation-controls.tsx:74-75`. **HARDCODED.**
`Child Brand` ← `brands.name`; `Status` ← `brands.status` (`font-mono`).

### team — `/app/team`

**Headers config-driven, labels only.** `TEAM_COLUMNS = ['Name','Role','Brands','Last active'] as const`
(`team/fields.ts:30`), mapped at `team-table.tsx:30-34`; `colSpan` reads `.length` (`:40`); cells
`:52-92` positional. No row click by design (`:8`).

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.fullName`, `item.email`, `item.external` | `users.full_name` `:18` + `.email` `:17` | **C** — two lines, plus a `CLIENT_ACCESS_NOTE` warn line when `external` (`:59-63`) |
| 2 | `Role` | `item.roles` | **linked** — `brand_assignments` roles | **V** — chip list in `data-slot="role-chip"` wrappers |
| 3 | `Brands` | `item.brands.{text,muted}` | **linked** — `brand_assignments` → `brands.name`; an admin with no rows reads `ALL_BRANDS_LABEL` (`fields.ts:40`) | **S** |
| 4 | `Last active` | `item.lastActive` / `…Title` | **computed** over `users.last_active_at` `:20` | **S** |

### ugc (Partnerships tab) — `/app/ugc`

**Headers config-driven, labels only.** `PARTNERSHIP_COLUMNS` (`ugc/fields.ts:329-336`) — `as const`
tuple of six bare strings, mapped at `partnership-table.tsx:47-51`; cells `:65-91` positional. Same
route as the Creators grid, different tab (`ugc-workspace.tsx:651-657`).

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Creator` | `row.name` | `creators.name` `:93` | **S** |
| 2 | `Instagram Username` | `row.instagramUsername` | `.instagram_username` `:124` | **S** — `font-mono` |
| 3 | `Activity` | `row.activityTone`/`activityLabel` | `.partnership_activity` `:126` | **V** |
| 4 | `Activated` | `row.activatedLabel` | **computed** over `.partnership_activated_at` `:129` | **S** |
| 5 | `Period` | `row.periodLabel` | **computed** over `.partnership_period_days` `:130` | **S** |
| 6 | `Countdown` | `row.countdownLabel`, `row.countdownTone` | **computed formula** — `activation + period + extension`, from `partnershipExpiry` in `@tas/domain/creators` | **C** — tone-mapped class, **and the row itself** carries `expiryRowClassName`/`expiryRowStyle` and `data-expiry-state` (`:60-63`) |

> **No price column, on purpose.** `partnership_price_per_30_days` is internal data; the comment at
> `partnership-table.tsx:30-32` records the omission so nobody "fixes" it. A per-brand resolver that
> can add a column to this table must not be able to add that one.

### creator-ranking — `/app/creator-ranking`

Raw `<table>`. Eight `<th>` literals, `creator-leaderboard.tsx:43-50`; cells `:70-79`.
**HARDCODED.** `pgTable creator_rankings`: `schema/creator-rankings.ts:7-25`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Rank` | `MEDAL[ranking.rank] ?? '#n'` | `.rank` `:23` | **C** — a medal glyph for the top ranks, else `#n` (`:71`) |
| 2 | `Creator` | `ranking.creatorName` | `.creator_name` `:17` (denormalised; `.creator_id` `:14` is the FK) | **S** |
| 3 | `Ads` | `ranking.totalAds` | `.total_ads` `:18` | **S** |
| 4 | `Spend` | `spendLabel` | **computed** over `.total_spend` numeric `:19` | **S** |
| 5 | `Conv.` | `ranking.totalConversions` | `.total_conversions` `:20` | **S** |
| 6 | `Avg ROAS` | `roasLabel` | **computed** over `.avg_roas` numeric `:21` | **S** |
| 7 | `Avg CPA` | `cpaLabel` | **computed** over `.avg_cpa` numeric `:22` | **S** |
| 8 | `Period` | `ranking.periodLabel` | `.period_label` `:24` | **S** |

### onboarding-forms — `/app/onboarding-forms`

Raw `<table>`. Five `<th>` literals, `onboarding-forms-table.tsx:41-45`; cells `:51-66`.
**HARDCODED.** `pgTable onboarding_forms`: `schema/onboarding-forms.ts:9-21`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Title` | `form.title`, `form.description` | `.title` `:16` + `.description` `:17` | **C** — two lines |
| 2 | `Status` | `form.status` | `.status` `:18` | **C** — **hand-rolled pill** from a local `STATUS_TONE` class map (`:11-15`), **not `StatusChip`**. Breaks UI governance rule 3 |
| 3 | `Fields` | `fieldCount` | **computed** — parsed from `.fields_json` `:19` | **S** |
| 4 | `Submissions` | `form.submissionsCount` | `.submissions_count` `:20` | **S** |
| 5 | `Share Token` | `form.shareToken` | `.share_token` `:21` | **S** — `font-mono` |

### performance — `/app/performance`

Raw `<table>`. Nine `<th>` literals, `performance-tracker.tsx:105-113`; cells from `:144`.
**HARDCODED.** `pgTable ad_metrics`: `schema/ad-metrics.ts:8-28`. Every cell is a server-formatted
label in a span — **9 S / 0 V / 0 C**.

| # | Header | Reads | Origin |
| --- | --- | --- | --- |
| 1 | `Ad` | `metric.adName` | `.ad_name` `:18` (`font-mono`, truncated) |
| 2 | `Spend` | `spendLabel` | **computed** over `.spend` numeric `:19` |
| 3 | `Impr.` | `impressionsLabel` | **computed** over `.impressions` `:20` |
| 4 | `Clicks` | `clicksLabel` | **computed** over `.clicks` `:21` |
| 5 | `Conv.` | `conversionsLabel` | **computed** over `.conversions` `:22` |
| 6 | `CTR` | `ctrLabel` | **computed** over `.ctr` numeric `:23` |
| 7 | `CPC` | `cpcLabel` | **computed** over `.cpc` numeric `:24` |
| 8 | `CPA` | `cpaLabel` | **computed** over `.cpa` numeric `:25` |
| 9 | `ROAS` | `roasLabel` | **computed** over `.roas` numeric `:26` |

> `.meta_ad_id` `:17` and `.date_range` `:27` stored, not displayed.

### upload-links — `/app/upload-links`

Raw `<table>`. Six `<th>` literals, `upload-links-table.tsx:39-44`; cells `:50-68`.
**HARDCODED.** `pgTable upload_links`: `schema/upload-links.ts:6-22`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Label` | `link.label` | `.label` `:14` | **C** — `Link` to the detail route |
| 2 | `Recipient` | `link.recipientName` | `.recipient_name` `:15` | **S** |
| 3 | `Usage` | `usageLabel` | **computed** over `.uploads_used` `:20` and `.max_uploads` `:17` | **S** |
| 4 | `Expires` | `expiresLabel` | **computed** over `.expires_at` `:18` | **S** |
| 5 | `Status` | `link.isActive` | `.is_active` `:19` | **C** — **hand-rolled pill** (`:62-66`), **not `StatusChip`**. Breaks UI governance rule 3 |
| 6 | `Token` | `link.token` | `.token` `:13` | **S** — `font-mono` |

> `.recipient_email` `:16` and `.notes` `:21` stored, not displayed.

---

## What is already config-driven — the machinery a resolver would plug into

Six mechanisms exist today. **None of them is per-brand column structure.**

| Mechanism | Where | What it controls | Scope | Persisted |
| --- | --- | --- | --- | --- |
| **Cell-primitive library** | `components/views/grid-cells.tsx` — 8 primitives, imported by 18 workspace pages | *how* a value renders | per column, by hand | source |
| **`<PropagationBadge>`** | `packages/ui/src/propagation/propagation-badge.tsx:11`; used on **11 pages** | renders `template_row_id` + `overridden_fields` as "synced" or "N overrides" | per row | reads the propagation columns |
| **Per-user saved views** | `packages/domain/src/views/user-views.ts`; `applyUserView` at `airtable-grid.tsx:95-101` | field **order, visibility, freeze**, sort, filter | **per Clerk user id + table key**, "NEVER shared between users" (`schema/user-table-views.ts:8`) | `user_table_views` (`:15-31`) |
| **Browser hidden-columns** | `readHiddenColumns`/`writeHiddenColumns`, `airtable-grid.tsx:90`, `:122-131` | visibility only, on **uncontrolled** grids | per browser | `localStorage` |
| **Table view capabilities** | `packages/domain/src/views/table-views.ts` `TABLE_VIEW_CAPABILITIES` | which view types a table offers; kanban/gallery/timeline **field** choices | per table, **global** | source constant |
| **Client interface config** | `packages/domain/src/interface/config.ts`; `InterfaceFieldConfig` `:64-71` carries `fieldName`, `label`, `visible`, `clientEditable`, `position` | which pages and fields the **client** sees | **per brand** | `interface_pages` / `interface_fields` |

Two of these matter most to the goal.

**`<PropagationBadge>` is row-level inheritance already shipped.** It takes `templateRowId` and
`overriddenFields`, renders nothing when `templateRowId` is null (i.e. on a template row), `"synced"`
when a child row tracks its parent, and `"N overrides"` with the field names in the `title` when it
has diverged (`propagation-badge.tsx:16-36`). **The attach/detach concept the goal needs for columns
already exists for rows, with a shipped UI, on 11 pages.** A column-level resolver should mirror its
vocabulary rather than invent a second one.

**The client interface config is the closest existing analogue to the resolver.** It is per-brand, it
stores a `label` beside a snake_case `fieldName`, `:69` says "Order is DATA", and `:61-62` describes
exactly the detach semantics the goal needs: *"The key never changes when a brand renames a label,
which is why the preview matches on the key and prints the label."* **But it governs only
`/client/[brandSlug]/*`.** Its sole consumers are `interface-config/config-tree.tsx:81` and
`interface-config/config-preview.tsx:84`. **No page under `/app/app/` reads it.**

`applyUserView` is the function a brand resolver composes with: it already takes
`readonly {key, frozen?}[]` plus a config and returns the ordered, filtered, re-frozen list
(`user-views.test.ts:36-69` pins the behaviour). A brand-level resolver can sit **underneath** it —
brand layout first, then the viewer's personal lens — without changing `AirtableGrid` at all.

---

## Migration cost

The cost drivers, in order of weight:

1. **Cell/header coupling.** Every page in groups B and C renders its cells as **positional**
   `<TableCell>`/`<td>` elements with no column key. Reordering such a page's headers reorders the
   headers **only** — the data stays put. On those pages, keying the cells is a prerequisite, not a
   refinement; without it a per-brand reorder is a silent data-corruption bug, not a layout change.
2. **C-class renderer count** — how many genuinely bespoke cells the page's registry must hold.
3. **V-class vocabulary count** — how many named domain resolvers the registry must reference. Cheaper
   than C: one entry per vocabulary, reused across columns and pages.
4. **Non-negotiable exposure** — tables holding internal money or client-invisible data need the
   resolver's visibility axis bounded. Policy work, not plumbing.

Note how much this reorders against intuition: **concepts, the 21-column table, is Tier 1** because
`ConceptItem` resolves every label and tone on the server (21 S / 0 V / 0 C). **creative-sheet, at 7
columns, is Tier 3** because two of its cells are irreducible and one of those renders three fields.
Column count is close to irrelevant; renderer class is almost everything.

### Tier 1 — cheapest (land the resolver here)

| Rank | Page | Cols | S/V/C | Why |
| --- | --- | --- | --- | --- |
| 1 | **personas** `/app/personas` | 7 | 6/1/0 | Already spreads `PERSONA_FIELDS`; `PERSONA_FIELD_GROUPS` is a label/field table already; `PERSONA_HIDDEN_FIELDS` is a hand-written visibility list begging to be data; `applyUserView`-controlled; zero composites. The hidden-field list and the Gratsi relabelling **are** column inheritance done by hand for one brand. |
| 2 | **concepts** `/app/concepts` | 21 | **21/0/0** | Every renderer is a primitive over a server-resolved value. `applyUserView`-controlled. Widest grid, zero renderer cost. Also lets the migration delete the dead `CONCEPT_COLUMNS` tuple. |
| 3 | **angles** `/app/angles` | 17 | 11/6/0 | **No composites at all.** The six V columns are six chip vocabularies, all already in `@tas/domain`. `applyUserView`-controlled. |
| 4 | **youtube-copywriting** `/app/youtube-copywriting` | 10 | 8/2/0 | No composites; two `booleanChip` vocabularies. Only wrinkle: the `Copy #` header names the number while the cell renders the generated title. |
| 5 | **creative-reporting** `/app/creative-reporting` | 12 | 11/0/1 | One composite (badge name); all seven metrics are the one reusable `Metric` primitive. `Difference CPA` needs a virtual-column concept. |
| 6 | **products** `/app/products` | 10 | 9/0/1 | One composite (badge name). Six `CountCell`s whose only per-column datum is an English noun — which becomes resolver data for free. |
| 7 | **ugc (Creators)** `/app/ugc` | 33 | 26/6/1 | **Counter-intuitive but true:** the widest table has exactly one composite (the avatar). `grid-cells.tsx` carries 26 of 33. Bounded by non-negotiable 10 on four money columns, and the dummy-value spread at `:146-165` should be rewritten against `CREATOR_TRACKS` directly. |

### Tier 2 — moderate (one or two composites, or a structural wrinkle)

| Rank | Page | Cols | S/V/C | Why |
| --- | --- | --- | --- | --- |
| 8 | **copy-types** `/app/copy-types` | 5 | 2/2/1 | Badge name + two count-chip vocabularies. |
| 9 | **creative-modules** `/app/creative-modules` | 5 | 2/2/1 | Same shape as copy-types. |
| 10 | **email-flows** `/app/email-flows` | 9 | 6/2/1 | Badge name; **two formula dates with no stored column**, so the resolver needs a virtual-column concept. |
| 11 | **sm-campaign-feed** `/app/sm-campaign-feed` | 7 | 4/2/1 | Badge name; `Reminder` is computed from `due_date` and has no field to attach to. |
| 12 | **email-campaigns** `/app/email-campaigns` | 12 | 8/3/1 | Badge name; two formula dates whose provenance lives **only in a `cellTitle` string literal**. |
| 13 | **themes** `/app/themes` | 10 | 7/2/1 | `applyUserView`-controlled and cheap per-renderer, **but the table is global** — `brand_id is null` check constraint (`schema/themes.ts:33`). There is no per-brand row to detach; needs its own inheritance rule. |
| 14 | **client-assets** `/app/client-assets` | 5 | 2/1/2 | Two composites for five columns: the badge name and a bespoke `<a>` that `LinkCell` cannot replace (keydown + `data-slot`). Fold those needs into `LinkCell` first. |
| 15 | **ai-characters** `/app/ai-characters` | 4 | 3/1/0 | Zero composites, but **no column array exists** — the headers are literal JSX and the cells positional. Nine stored-but-hidden columns give the resolver something real to switch on. |
| 16 | **performance** `/app/performance` | 9 | 9/0/0 | Zero composites and zero vocabularies, but a **raw `<table>`** bypassing `@tas/ui`. Bring it onto `AirtableGrid` and it becomes Tier 1. |
| 17 | **competitive-research** `/app/competitive-research` | 5 | 3/1/1 | The only hand-built table carrying **keys**; fix the positional cells to read them and it is nearly done. |
| 18 | **creative-dimensions** `/app/creative-dimensions` | 4 | 3/0/1 | Badge name; four literal `<TableHead>`s and positional cells to key. |
| 19 | **collections** `/app/collections` | 6 | 5/0/1 | Badge name; four FK-resolved names. Positional cells to key. |
| 20 | **campaigns-offers** `/app/campaigns-offers` | 11 | 8/3/0 | No composites, but eleven literal `<TableHead>`s and eleven positional cells, with `'Yes'`/`'No'` inline. Mechanical and wide. |
| 21 | **creator-ranking** `/app/creator-ranking` | 8 | 7/0/1 | One composite (medal glyph); raw `<table>` to migrate first. |

### Tier 3 — hard

| Rank | Page | Cols | S/V/C | Why |
| --- | --- | --- | --- | --- |
| 22 | **creative-design** `/app/creative-design` | 6 | 4/1/1 | Six displayed columns over a **57-column** `creative_briefs` — the widest stored/shown gap in the repo, so the resolver's "add a column" path has 51 candidates and no existing per-brand record of which a brand wants. `Priority` is a chip + SLA composite; headers are label-only strings. |
| 23 | **team** `/app/team` | 4 | 2/1/1 | Four columns, but every one is a composite or a linked aggregate, and `Name` carries a conditional client-access warning. Lowest column count, highest renderer density. |
| 24 | **upload-links** `/app/upload-links` | 6 | 4/0/2 | Raw `<table>` **and** a hand-rolled status pill instead of `StatusChip` (`:62-66`). Migrating straight to a resolver would bake a UI-governance violation into the config layer. Fix the pill first. |
| 25 | **onboarding-forms** `/app/onboarding-forms` | 5 | 3/0/2 | Same problem as upload-links (`:11-15`), plus a two-line composite title. |
| 26 | **meta-copywriting** `/app/meta-copywriting` | 6 | 4/0/2 | Column 1 stacks a **generated title and a stored headline in one cell**, deliberately, citing PRD §5.11 — no 1:1 mapping, and the ticket explicitly forbids splitting it. Plus a stale "four columns" comment to correct. |
| 27 | **creative-sheet** `/app/creative-sheet` | 7 | 2/3/2 | `QA` is **one header over three stored booleans** via `QA_CHECKS`; `Name` is a generated formula with **no `name` column on the table**. The array is also `export`ed and mounted by a design-system story, so the story is a second consumer to keep green. |
| 28 | **propagation** `/app/propagation` | 13 | 10/1/4 | **Three tables on one route**, one of which (`Decision`) embeds approve/reject controls and a note `<Input>` in a cell. And the page is the admin surface for `custom_field_schemas` — it would be *administering* the resolver while being *driven* by it. Sequence it last. |
| 29 | **notifications** `/app/notifications` | 4 | 2/0/2 | Already the most config-driven table (headers **and** cells iterate `NOTIFICATION_CHANNELS`), but it is a **settings matrix of interactive `<Switch>`es**, not a record list. A record-column resolver is the wrong abstraction. **Recommend excluding.** |
| — | **ad-spy**, **assets**, **queue/client**, **queue/internal**, **concepts (board)** | — | — | Card and kanban surfaces with no column definitions. Out of scope until the resolver has a card-field concept. Note the kanban columns are **statuses**, and a per-brand status vocabulary is a different feature from per-brand columns. |

### The cost in one paragraph

> A label, an order, a width and a visibility flag are data. **267 displayed columns all carry a
> renderer**, but because `grid-cells.tsx` already exists as a shared primitive library,
> **125 of the 170 grid columns (74%) reduce to `{primitive, accessor, params}` with no code at
> all**; 32 more (19%) need a *named reference* to a `@tas/domain` label/tone resolver — one entry
> per vocabulary, not per column; and only **13 (8%) are genuinely bespoke, of which 8 are the same
> composite** (a frozen name beside `<PropagationBadge>`). So the renderer registry is far smaller
> than the column count suggests: roughly **a dozen primitives, ~20 vocabularies, and ~6 true
> one-offs** across the whole grid surface. The real work is not the renderers. It is (a) the 15 pages in
> groups B and C that have **no column array at all** and render positional cells, which must be
> keyed before any reorder is safe, and (b) deciding where brand-level layout sits relative to the
> existing per-user `user_table_views` lens.

---

## Duplicated labels

Each row is one header string written in more than one file. Every duplicate is a place where a
relabel lands in one surface and not the other.

### A. Exact duplicates — grid/table header vs the same module's panel field label

| Label | Column header | Panel / field-list label |
| --- | --- | --- |
| `Potential` | `angles/angles-workspace.tsx:184` | `angles/fields.ts:350` |
| `Description` | `angles/angles-workspace.tsx:232` | `angles/fields.ts:389` |
| `Pain Points` | `angles/angles-workspace.tsx:238` | `angles/fields.ts:396` |
| `USP` | `angles/angles-workspace.tsx:241` | `angles/fields.ts:400` |
| `Brief URL` | `angles/angles-workspace.tsx:250` | `angles/fields.ts:406` |
| `Exact Script URL` | `angles/angles-workspace.tsx:255` | `angles/fields.ts:409` |
| `Internal Notes` | `angles/angles-workspace.tsx:260` | `angles/fields.ts:361` |
| `Client Notes` | `angles/angles-workspace.tsx:265` | `angles/fields.ts:366` |
| `Status` | `ai-characters/ai-characters-workspace.tsx:161` | `ai-characters/fields.ts:80` |
| `Basic Info` | `ai-characters/ai-characters-workspace.tsx:162` | `ai-characters/fields.ts:102` |
| `Holiday` | `campaigns-offers/campaigns-workspace.tsx:221` | `campaigns-offers/fields.ts:30` |
| `Code` | `campaigns-offers/campaigns-workspace.tsx:223` | `campaigns-offers/fields.ts:37` |
| `Official Date` | `campaigns-offers/campaigns-workspace.tsx:224` | `campaigns-offers/fields.ts:45` |
| `Launched` | `campaigns-offers/campaigns-workspace.tsx:228` | `campaigns-offers/fields.ts:79` |
| `Product` | `campaigns-offers/campaigns-workspace.tsx:229` | `campaigns-offers/fields.ts:110` |
| `Description` | `client-assets/client-assets-workspace.tsx:99` | `client-assets/fields.ts:40` |
| `Location` | `client-assets/client-assets-workspace.tsx:111` | `client-assets/fields.ts:47` |
| `URL` | `collections/collections-workspace.tsx:202` | `collections/fields.ts:63` |
| `Campaign` | `collections/collections-workspace.tsx:203` | `collections/fields.ts:69` |
| `Name` | `copy-types/copy-types-workspace.tsx:73` | `copy-types/fields.ts:35` |
| `Description` | `copy-types/copy-types-workspace.tsx:89` | `copy-types/fields.ts:42` |
| `Name` | `creative-dimensions/creative-dimensions-workspace.tsx:156` | `creative-dimensions/fields.ts:26` |
| `Dimensions` | `creative-dimensions/creative-dimensions-workspace.tsx:157` | `creative-dimensions/fields.ts:32` |
| `Link Description` | `creative-dimensions/creative-dimensions-workspace.tsx:158` | `creative-dimensions/fields.ts:38` |
| `Name + Angle + Offer` | `creative-reporting/creative-reporting-workspace.tsx:83` | `creative-reporting/fields.ts:58` |
| `Creative` | `creative-reporting/creative-reporting-workspace.tsx:99` | `creative-reporting/fields.ts:63` |
| `Results` | `creative-reporting/creative-reporting-workspace.tsx:124` | `creative-reporting/fields.ts:115` |
| `CPA` | `creative-reporting/creative-reporting-workspace.tsx:131` | `creative-reporting/fields.ts:128` |
| `Target CPA` | `creative-reporting/creative-reporting-workspace.tsx:138` | `creative-reporting/fields.ts:137` |
| `ROAS` | `creative-reporting/creative-reporting-workspace.tsx:158` | `creative-reporting/fields.ts:146` |
| `Target ROAS` | `creative-reporting/creative-reporting-workspace.tsx:165` | `creative-reporting/fields.ts:155` |
| `Used` | `creative-sheet/creative-sheet-workspace.tsx:159` | `creative-sheet/fields.ts:144` |
| `Name` | `email-campaigns/email-campaigns-workspace.tsx:107` | `email-campaigns/fields.ts:61` |
| `Status` | `email-campaigns/email-campaigns-workspace.tsx:123` | `email-campaigns/fields.ts:73` |
| `Type` | `email-campaigns/email-campaigns-workspace.tsx:129` | `email-campaigns/fields.ts:74` |
| `Channel` | `email-campaigns/email-campaigns-workspace.tsx:135` | `email-campaigns/fields.ts:75` |
| `Assignee` | `email-campaigns/email-campaigns-workspace.tsx:161` | `email-campaigns/fields.ts:83` |
| `Campaigns & Offers` | `email-campaigns/email-campaigns-workspace.tsx:179` | `email-campaigns/fields.ts:147` |
| `Status` | `email-flows/email-flows-workspace.tsx:157` | `email-flows/fields.ts:78` |
| `Type` | `email-flows/email-flows-workspace.tsx:168` | `email-flows/fields.ts:77` |
| `Assignee` | `email-flows/email-flows-workspace.tsx:210` | `email-flows/fields.ts:79` |
| `Name` | `personas/personas-workspace.tsx:104` | `personas/fields.ts:57` |
| `Problem-Solution Awareness Level` | `personas/personas-workspace.tsx:121` | `personas/fields.ts:62` |
| `Platform` | `sm-campaign-feed/sm-campaign-feed-workspace.tsx:98` | `sm-campaign-feed/fields.ts:43` |
| `Status` | `sm-campaign-feed/sm-campaign-feed-workspace.tsx:123` | `sm-campaign-feed/fields.ts:45` |
| `Notes` | `sm-campaign-feed/sm-campaign-feed-workspace.tsx:145` | `sm-campaign-feed/fields.ts:48` |
| `Instagram Username` | `ugc/ugc-workspace.tsx:207` | `ugc/fields.ts:331` (`PARTNERSHIP_COLUMNS`) |
| `Headline` | `youtube-copywriting/youtube-copywriting-workspace.tsx:104` | `youtube-copywriting/fields.ts:286` |
| `Descriptions` | `youtube-copywriting/youtube-copywriting-workspace.tsx:111` | `youtube-copywriting/fields.ts:289` |
| `Status` | `youtube-copywriting/youtube-copywriting-workspace.tsx:119` | `youtube-copywriting/fields.ts:309` |
| `CTA` | `youtube-copywriting/youtube-copywriting-workspace.tsx:125` | `youtube-copywriting/fields.ts:297` |
| `Funnel` | `youtube-copywriting/youtube-copywriting-workspace.tsx:131` | `youtube-copywriting/fields.ts:304` |
| `Used` | `youtube-copywriting/youtube-copywriting-workspace.tsx:137` | `youtube-copywriting/fields.ts:310` |
| `Winning` | `youtube-copywriting/youtube-copywriting-workspace.tsx:143` | `youtube-copywriting/fields.ts:311` |
| `Table` | `propagation/custom-fields-section.tsx:263` | `propagation/fields.ts:46` (`PROMOTION_COLUMNS`) |

**56 exact same-module duplicates.** Personas is the exception that proves the rule: columns 2-5
spread `PERSONA_FIELDS`, so the grid header and the panel label are **the same string from the same
place** — the comment at `personas-workspace.tsx:110-111` says exactly that. Columns 1 and 6 do not
spread, which is why `'Name'` and `'Problem-Solution Awareness Level'` are still on this list.

### B. Exact duplicates across the internal and client surfaces

| Label | Internal | Client |
| --- | --- | --- |
| `Name` | `app/angles/angles-workspace.tsx:137` | `client/[brandSlug]/angles/page.tsx:38` |
| `Description` | `app/angles/angles-workspace.tsx:232` | `client/[brandSlug]/angles/page.tsx:39` |
| `Winning` | `app/angles/angles-workspace.tsx:201` | `client/[brandSlug]/angles/page.tsx:42` |
| `Name` | `app/concepts/concepts-workspace.tsx:123` | `client/[brandSlug]/concepts/page.tsx:38` |
| `Batch` | `app/concepts/concepts-workspace.tsx:135` | `client/[brandSlug]/concepts/page.tsx:39` |
| `Angle` | `app/concepts/concepts-workspace.tsx:146` | `client/[brandSlug]/concepts/page.tsx:40` |
| `Theme` | `app/concepts/concepts-workspace.tsx:164` | `client/[brandSlug]/concepts/page.tsx:41` |
| `Name` | `app/themes/themes-workspace.tsx:122` | `client/[brandSlug]/themes/page.tsx:38` |
| `Category` | `app/themes/themes-workspace.tsx:134` | `client/[brandSlug]/themes/page.tsx:39` |
| `Active` | `app/themes/themes-workspace.tsx:204` | `client/[brandSlug]/themes/page.tsx:40` |
| `Name` | `app/ugc/ugc-workspace.tsx:115` | `client/[brandSlug]/ugc/page.tsx:38` |
| `Gender` | `app/ugc/ugc-workspace.tsx:168` | `client/[brandSlug]/ugc/page.tsx:39` |

**12 cross-surface duplicates**, and these are worse than Tier A: the client pages are hardcoded
`<TableHead>` literals that **do not consult `visibleFields`** from the per-brand interface config,
even though that config exists and already carries per-brand labels
(`packages/domain/src/interface/config.ts:64-71`). A brand that relabels a column in the Template
base today would have to see it change in **four** places — the internal grid, the internal panel,
the client page and the interface config — one of which already has a per-brand label store that
nothing reads on that surface.

### C. Near-duplicates already drifted — same field, different capitalisation or punctuation

The strongest argument for collapsing labels into one source: these have **already** fallen out of
sync, silently.

| Field | Grid header | Panel label |
| --- | --- | --- |
| `client_asset_folders.name` | `Folder name` (`client-assets-workspace.tsx:83`) | `Folder Name` (`client-assets/fields.ts:33`) |
| `creative_modules.module_name` | `Module name` (`creative-modules-workspace.tsx:83`) | `Module Name` (`creative-modules/fields.ts:31`) |
| `creative_modules.foreplay_link` | `Foreplay link` (`creative-modules-workspace.tsx:99`) | `Foreplay Link` (`creative-modules/fields.ts:37`) |
| `creative_reporting.ad_link` | `Ad link` (`creative-reporting-workspace.tsx:172`) | `Ad Link` (`creative-reporting/fields.ts:85`) |
| `creative_reporting.ctr` | `CTR (%)` (`creative-reporting-workspace.tsx:110`) | `CTR` (`creative-reporting/fields.ts:97`) |
| `creative_reporting.thumb_stop_rate` | `Thumb-stop rate` (`creative-reporting-workspace.tsx:117`) | `Thumb-Stop Rate` (`creative-reporting/fields.ts:106`) |
| `email_campaigns.send_date` | `Send date` (`email-campaigns-workspace.tsx:141`) | `Send Date` (`email-campaigns/fields.ts:78`) |
| `email_campaigns.copy_link` | `Copy link` (`email-campaigns-workspace.tsx:173`) | `Copy Link` (`email-campaigns/fields.ts:98`) |
| `email_flows.flow_name` | `Flow name` (`email-flows-workspace.tsx:141`) | `Flow Name` (`email-flows/fields.ts:65`) |
| `email_flows.expected_setup_date` | `Expected setup date` (`email-flows-workspace.tsx:179`) | `Expected Setup Date` (`email-flows/fields.ts:87`) |
| `email_flows.klaviyo_link` | `Klaviyo link` (`email-flows-workspace.tsx:216`) | `Klaviyo Link` (`email-flows/fields.ts:106`) |
| `products.name` | `Product name` (`products-workspace.tsx:131`) | `Product Name` (`products/fields.ts:53`) |
| `products.link` | `Landing page URL` (`products-workspace.tsx:147`) | `Landing Page URL` (`products/fields.ts:59`) |
| `products.collection_link` | `Collection link` (`products-workspace.tsx:154`) | `Collection Link` (`products/fields.ts:65`) |
| `youtube_copy.meta_rating` | `Meta rating` (`youtube-copywriting-workspace.tsx:149`) | `Meta Rating` (`youtube-copywriting/fields.ts:314`) |

**15 pairs already drifted.** Also in this class, though not a pure case difference: `angles.name` is
`Name` in the grid (`angles-workspace.tsx:137`) and **`Angle Name`** in the panel
(`angles/fields.ts:382`).

### D. A column list that duplicates nothing because nothing renders it

`CONCEPT_COLUMNS` (`concepts/fields.ts:264-272`) — seven strings, consumed only by
`concepts/fields.test.ts:182` and named in a comment at `concepts-workspace.tsx:116`. The page
renders `CONCEPT_GRID_COLUMNS`'s 21 columns. **The most dangerous entry in this section:** a reader
looking for "the concepts columns" finds a list that is wrong, and a test that keeps it green.

### E. Third copies inside design-system stories

`design-system/page.tsx:632` renders a `<TableHead>` reading `Collection link`, matching the products
grid header; `design-system/page.tsx:470` renders `Creative`, matching creative-reporting.
`CREATIVE_SHEET_COLUMNS` is the one array that avoids this by being `export`ed and imported by its
story (`design-system/creative-sheet.stories.tsx:114`) — the pattern every other page should follow,
and the pattern a resolver makes mandatory.

### Totals

| Class | Count |
| --- | --- |
| A — exact, grid vs same-module panel | 56 |
| B — exact, internal vs client surface | 12 |
| C — near-duplicate, already drifted | 15 (+1 non-case: `Name` / `Angle Name`) |
| D — list that renders nowhere | 1 (`CONCEPT_COLUMNS`, 7 strings) |
| E — third copies in design-system stories | 2 |

---

## What I could not establish

Stated plainly, because inferring any of these would make the document misleading.

1. **`brand_field_overrides` does not exist in this repo.** CLAUDE.md names it as where per-brand
   visibility lives, and two source comments defer to it by name
   (`packages/db/src/schema/personas.ts:29`, `apps/web/src/app/app/personas/fields.ts:51`). A search
   across `packages/db/src/` and `apps/web/src/` returns **only those two comments** — no `pgTable`,
   no migration, no query. There is no per-brand field-override table today.

2. **No per-brand column structure exists for `/app/app/` at all.** The six mechanisms catalogued
   above are per-column-by-hand (`grid-cells.tsx`), per-row (`PropagationBadge`), per-user
   (`user_table_views`), per-browser (`localStorage`), global (`TABLE_VIEW_CAPABILITIES`), or
   per-brand-but-client-only (`interface_pages` / `interface_fields`). I found nothing that varies an
   internal grid's columns by brand.

3. **`custom_field_schemas` is administered but never rendered in a list.**
   `schema/custom-field-schemas.ts:16-36` stores `brandId`, `tableName`, `fieldKey`, `fieldType`,
   `fieldLabel`, `sortOrder` — per-brand label and order, which is close to the resolver's payload.
   Its only consumers are the propagation page (`propagation/page.tsx:107-111`,
   `propagation/custom-fields-section.tsx`, `propagation/custom-field-actions.ts`). **No list page
   reads `customFields` or `fieldLabel` to render a column**, and the `custom_fields` jsonb bag on
   every content table (`packages/db/src/columns.ts:43`) is never read by a column definition.

4. **I did not verify what the Airtable bases actually contain.** This is a source-code audit. I did
   not query the Airtable API or the production database, so I cannot say whether a given header
   string matches the field name in the `Creative Hub Template` base or in Gratsi's. The one place
   the repo asserts such a match is `personas/fields.ts:42-46`, citing
   `docs/decisions/gratsi-display-spec-2026-10-02.md`; **I report that the file says so, not that it
   is true.** Sibling agents hold that half.

5. **I did not establish how the brand switcher would make the Template base selectable.** Out of
   this subagent's scope; no claim either way.

6. **The S/V/C classification is my judgement, not a property in the source.** `GridColumn` has no
   `kind` field. I applied one rule consistently — S = one `grid-cells.tsx` primitive or a styled
   span over a server-formatted value; V = that plus a `@tas/domain` label/tone call; C = a bespoke
   element tree, more than one row property, or a non-primitive component — and the `file:line`
   anchors are exact. The bucket assignments are arguable and should be re-checked per page at
   migration time. **In a first pass I classified several pages wrongly** (counting `Metric` and the
   `Updated` spans as code, and missing `grid-cells.tsx` entirely), which inflated the "renderers are
   code" figure roughly fourfold; the numbers here are the corrected ones.

7. **Column counts were verified programmatically**, by counting `key:` entries inside each
   `GridColumn<…>[]` block and resolving each spread's arity (`PERSONA_FIELDS` → 4 after the filter;
   `creatorTracks` → 3, confirmed at `ugc/fields.ts:121`, `:127`, `:133`;
   `NOTIFICATION_CHANNELS` → 2 at `packages/domain/src/notifications/channels.ts:17`). Where one cell
   renders more than one stored field (creative-sheet `QA` = 3 booleans, meta-copywriting
   `Copy title / Headline` = 2 values, ugc `Name` = 2 properties) I counted **one** column, because
   one header renders. A field-level count would be higher and I did not compute it.
