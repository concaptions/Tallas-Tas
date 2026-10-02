# Displayed grid columns, every module list page — 2026-10-02

Subagent B of the two-agent module audit. **Scope:** every route directory under
`apps/web/src/app/app/`. For each one: what the list page actually renders, the exact header text,
the row property the cell reads, whether the cell has an empty-state fallback, which column is
frozen, and which Drizzle column of `packages/db/src/schema/` the value ultimately comes from.

**Method.** Every row below was read out of the source, not inferred. Header text is quoted
verbatim from the `header:` / `<TableHead>` / `<th>` that renders it. The database column is the
`pgTable` column name as the schema spells it, reached by following the row type back through the
module's query function in `packages/db/src/`. Where a value is computed, inherited through a link,
or counted from a junction table, the row says so instead of naming a column — the previous audit was
challenged for naming columns that do not exist, so nothing here is asserted because it "should" be
there.

**Reading the Fallback column.** `—` means the cell renders `<span className="text-text4">—</span>`
(or an `EM_DASH` constant) when the value is null. "chip" means a `StatusChip` always renders, so a
zero or an off state is visible rather than blank. "none" means the cell renders the value directly
with no null branch — correct where the backing column is `NOT NULL`, a bug risk where it is not.

---

## Summary

| Module | Route | Columns | Kind |
| --- | --- | --- | --- |
| ad-spy | `/app/ad-spy` | — | cards |
| ai-characters | `/app/ai-characters` | 4 | hand-built table |
| angles | `/app/angles` | 4 | hand-built table |
| assets | `/app/assets` | — | cards |
| briefs | `/app/briefs` | — | redirect only |
| campaigns | `/app/campaigns` | — | redirect only |
| campaigns-offers | `/app/campaigns-offers` | 11 | hand-built table |
| client-assets | `/app/client-assets` | 5 | grid |
| collections | `/app/collections` | 6 | hand-built table |
| competitive-research | `/app/competitive-research` | 5 | hand-built table |
| concepts | `/app/concepts` | 7 | grid |
| copy-types | `/app/copy-types` | 5 | grid |
| copywriting | `/app/copywriting` | — | redirect only |
| creative-design | `/app/creative-design` | 6 | hand-built table |
| creative-dimensions | `/app/creative-dimensions` | 4 | hand-built table |
| creative-modules | `/app/creative-modules` | 5 | grid |
| creative-reporting | `/app/creative-reporting` | 12 | grid |
| creative-sheet | `/app/creative-sheet` | 7 | grid |
| creator-ranking | `/app/creator-ranking` | 8 | hand-built table (raw `<table>`) |
| email-campaigns | `/app/email-campaigns` | 12 | grid |
| email-flows | `/app/email-flows` | 9 | grid |
| interface-config | `/app/interface-config` | — | neither (nested `<ul>` tree + preview) |
| meta-copywriting | `/app/meta-copywriting` | 6 | hand-built table |
| notifications | `/app/notifications` | 4 | hand-built table |
| onboard | `/app/onboard` | — | neither (wizard form) |
| onboarding-forms | `/app/onboarding-forms` | 5 | hand-built table (raw `<table>`) |
| performance | `/app/performance` | 9 | hand-built table (raw `<table>`) |
| personas | `/app/personas` | 3 | grid |
| products | `/app/products` | 4 | grid |
| propagation | `/app/propagation` | 7 (+2 and +5 in two secondary tables) | hand-built table ×3 |
| queue/client | `/app/queue/client` | — | cards (kanban board) |
| queue/internal | `/app/queue/internal` | — | cards (kanban board) |
| sm-campaign-feed | `/app/sm-campaign-feed` | 7 | grid |
| team | `/app/team` | 4 | hand-built table |
| themes | `/app/themes` | — | cards |
| ugc | `/app/ugc` | 6 (Partnerships tab only) | cards + hand-built table |
| upload-links | `/app/upload-links` | 6 | hand-built table (raw `<table>`) |
| youtube-copywriting | `/app/youtube-copywriting` | 10 | grid |

12 grid pages, 16 hand-built-table pages (4 of them raw `<table>` rather than `@tas/ui`'s `<Table>`),
6 card pages, 2 pages that are neither, 3 redirect-only directories. 38 routes in 37 directories
(`queue` holds two).

`apps/web/src/app/app/page.tsx` — the `/app` overview — is a dashboard of `Card`s and counts, not a
list page, and is not audited here.

---

## Grid pages (`AirtableGrid`)

All twelve mount `AirtableGrid` from `apps/web/src/components/views/airtable-grid.tsx`. In that
component `frozen: true` pins the cell with `sticky left-0` (line 149 for the header, 219 for the
body), and the empty **table** state is a single `colSpan` row reading `✨ Nothing here yet.` unless
the page passes `empty` (line 174). A `Fields` dropdown can hide any column per viewer, so "visible"
below means "defined", not "always on screen".

### client-assets — `/app/client-assets`

Columns: `apps/web/src/app/app/client-assets/client-assets-workspace.tsx:80`
(`CLIENT_ASSET_COLUMNS`). Table: `client_asset_folders` (`packages/db/src/schema/client-asset-folders.ts:17`),
query `listClientAssetFolders` (`packages/db/src/client-asset-folders.ts:125`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Folder name` **(frozen)** | `item.folder.name` | none | `client_asset_folders.name` (`text` NOT NULL) |
| 2 | `Description` | `item.folder.description` | `—` | `client_asset_folders.description` |
| 3 | `Location` | `item.locationHost` (href `item.folder.locationUrl`) | `—` | `client_asset_folders.location_url`; the host is **computed** by `hostLabel` in `page.tsx:41` |
| 4 | `Linked designs` | `item.designCount` | chip (`0 designs`, mute tone) | **computed count**, `folder.briefIds.length` from the `brief_asset_folders` junction — no stored column |
| 5 | `Updated` | `item.updatedLabel`, title `item.updatedTitle` | none | `client_asset_folders.updated_at` (`relativeTime` / `absoluteTime` in `page.tsx:43-44`) |

Column 1 also renders `<PropagationBadge>` off `client_asset_folders.template_row_id` and
`client_asset_folders.overridden_fields`.

### concepts — `/app/concepts`

Columns: `apps/web/src/app/app/concepts/concepts-workspace.tsx:96` (`CONCEPT_GRID_COLUMNS`).
Table: `concepts` (`packages/db/src/schema/concepts.ts:42`), query `listConcepts`
(`packages/db/src/concepts.ts`, row type `ConceptListRow` at line 75).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.name` | none | `concepts.name` (`text` NOT NULL; the auto-generated `Batch-Angle-Theme` string, stored) |
| 2 | `Batch` | `item.batch` | `—` | `concepts.batch` |
| 3 | `Angle` | `item.angleName` | `—` | **inherited**: first `concept_angles` link → `angles.name` |
| 4 | `Persona` | `item.personaName` | `—` | **inherited through the angle**: `concept_angles` → `angle_personas` → `personas.name`. Not stored on `concepts` |
| 5 | `Product` | `item.productName` | `—` | **inherited through the angle**: `concept_angles` → `angle_products` → `products.name`. Not stored on `concepts` |
| 6 | `Theme` | `item.themeName` | `—` | **inherited**: first `concept_themes` link → `themes.name` |
| 7 | `Internal Status` | `item.status.label` / `.tone` | none (chip always) | `concepts.internal_status` (`text` NOT NULL, default `sent_to_video_editor`); resolved to a label by `internalStatusView(CONCEPT_TRACK, …)` in `page.tsx:48` |

### copy-types — `/app/copy-types`

Columns: `apps/web/src/app/app/copy-types/copy-types-workspace.tsx:70` (`COPY_TYPE_COLUMNS`).
Table: `copy_types` (`packages/db/src/schema/copy-types.ts:24`), query in `packages/db/src/copy-types.ts`
(row type `CopyTypeListRow` at line 55).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.copyType.name` | none | `copy_types.name` (NOT NULL) |
| 2 | `Description` | `item.descriptionPreview`, title `item.copyType.description` | `—` | `copy_types.description`; the first-line preview is **computed** in `page.tsx:36` |
| 3 | `Meta copies` | `item.metaCopies.length` | chip | **computed count** from the `copywriting_copy_types` junction (`schema/copy-types.ts:49`) |
| 4 | `YouTube copies` | `item.youtubeCopies.length` | chip | **computed count** from the `youtube_copy_copy_types` junction (`schema/youtube-copy.ts:132`) |
| 5 | `Updated` | `item.updatedLabel` | none | `copy_types.updated_at` |

Column 1 also renders `<PropagationBadge>` off `copy_types.template_row_id` / `overridden_fields`.
`copy_types` stores exactly `name`, `description` and `legacy_airtable_id` beyond the shared columns,
so the grid shows every business column this table has.

### creative-modules — `/app/creative-modules`

Columns: `apps/web/src/app/app/creative-modules/creative-modules-workspace.tsx:80`
(`CREATIVE_MODULE_COLUMNS`). Table: `creative_modules` (`packages/db/src/schema/creative-modules.ts:21`),
row type `CreativeModuleListRow` (`packages/db/src/creative-modules.ts:43`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Module name` **(frozen)** | `item.creativeModule.moduleName` | none | `creative_modules.module_name` (NOT NULL) |
| 2 | `Foreplay link` | `item.foreplayHost`, title the full URL | `—` | `creative_modules.foreplay_link`; host **computed** in `page.tsx:42` |
| 3 | `Angles` | `item.angleCount` | chip | **computed count** from the `creative_module_angles` junction (`schema/creative-modules.ts:45`) |
| 4 | `Creative designs` | `item.designCount` | chip | **computed count** from the `creative_module_designs` junction |
| 5 | `Updated` | `item.updatedLabel` | none | `creative_modules.updated_at` |

Column 1 also renders `<PropagationBadge>`. `creative_modules` stores only `module_name`,
`foreplay_link` and `legacy_airtable_id`, so the grid covers every business column.

### creative-reporting — `/app/creative-reporting`

Columns: `apps/web/src/app/app/creative-reporting/creative-reporting-workspace.tsx:80` (the constant
is named plainly `COLUMNS`). Table: `creative_reporting` (`packages/db/src/schema/creative-reporting.ts:39`),
row type `CreativeReportListRow` (`packages/db/src/creative-reporting.ts:36`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name + Angle + Offer` **(frozen)** | `item.row.nameAngleOffer` | none | `creative_reporting.name_angle_offer` (NOT NULL) |
| 2 | `Creative` | `item.row.briefName` | `—` | **joined**: `creative_reporting.brief_id` → `creative_briefs.name`. Not a stored name |
| 3 | `CTR (%)` | `item.ctrLabel` | `—` via `<Metric>` | `creative_reporting.ctr` (`numeric(6,4)`) |
| 4 | `Thumb-stop rate` | `item.thumbStopLabel` | `—` | `creative_reporting.thumb_stop_rate` (`numeric(6,2)`) |
| 5 | `Results` | `item.resultsLabel` | `—` | `creative_reporting.results` (`numeric(10,1)`) |
| 6 | `CPA` | `item.cpaLabel` | `—` | `creative_reporting.cpa` (`numeric(10,2)`) |
| 7 | `Target CPA` | `item.targetCpaLabel` | `—` | `creative_reporting.target_cpa` (`numeric(10,2)`) |
| 8 | `Difference CPA` | `item.differenceCpa` (chip) | `—` | **computed**, `creativeReportDifferenceCpa(cpa, target_cpa)` at `creative-reporting.ts:67`. Not stored; the cell title says `CPA − Target CPA (formula, read-only)` |
| 9 | `ROAS` | `item.roasLabel` | `—` | `creative_reporting.roas` (`numeric(8,2)`) |
| 10 | `Target ROAS` | `item.targetRoasLabel` | `—` | `creative_reporting.target_roas` (`numeric(8,1)`) |
| 11 | `Ad link` | `item.adLinkHost`, title the full URL | `—` | `creative_reporting.ad_link`; host **computed** |
| 12 | `Updated` | `item.updatedLabel` | none | `creative_reporting.updated_at` |

Stored but shown nowhere in this grid: `creative_reporting.notes` and `creative_reporting.ad_design`
(the attachment URL array). Both are searched (`matchesCreativeReportSearch`) and edited in the panel.

### creative-sheet — `/app/creative-sheet`

Columns: `apps/web/src/app/app/creative-sheet/creative-sheet-workspace.tsx:118`
(`CREATIVE_SHEET_COLUMNS`, exported — the `/design-system` story at
`apps/web/src/app/(dev)/design-system/creative-sheet.stories.tsx:116` mounts the same constant).
Table: `creative_sheet_items` (`packages/db/src/schema/creative-sheet-items.ts:57`), row type
`CreativeSheetItemListRow` (`packages/db/src/creative-sheet-items.ts:56`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.name` | none | **computed**, `creativeSheetItemName(createdAt, briefName)` at `creative-sheet-items.ts:81` — `created_at`'s month plus the joined brief's name. There is no stored name column on this table |
| 2 | `Brief` | `item.briefName` | `—` | **joined**: `creative_sheet_items.brief_id` → `creative_briefs.name` |
| 3 | `Internal Status` | `item.internalStatus` (chip) | `—` | `creative_sheet_items.internal_status` (nullable `text`) |
| 4 | `Status` | `item.status` (chip) | `—` | `creative_sheet_items.status` (nullable `text`) |
| 5 | `Winning` | `item.winning` (chip) | `—` | `creative_sheet_items.winning` (nullable `text`) |
| 6 | `Used` | `item.used` | none — `<Tick>` renders `✓` or `○` | `creative_sheet_items.used` (`boolean` NOT NULL) |
| 7 | `QA` | `item.qaVideoEditor`, `item.qaDesigner`, `item.qaStrategist` | none — three `<Tick>`s | `creative_sheet_items.qa_video_editor`, `qa_designer`, `qa_strategist` (all `boolean` NOT NULL). **One header over three columns** |

Stored but shown nowhere in this grid: `client_comments`, `denied_revisions_needed`,
`spell_check_requested`, `spelling_feedback`, `qa_checklist_doc`.

### email-campaigns — `/app/email-campaigns`

Columns: `apps/web/src/app/app/email-campaigns/email-campaigns-workspace.tsx:104` (named `COLUMNS`).
Table: `email_campaigns` (`packages/db/src/schema/email-campaigns.ts:33`), row type
`EmailCampaignListRow` (`packages/db/src/email-campaigns.ts:45`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.row.name` | none | `email_campaigns.name` (NOT NULL) |
| 2 | `Status` | `item.row.status` (chip) | `—` via `<Choice>` | `email_campaigns.status` |
| 3 | `Type` | `item.row.type` (chip) | `—` | `email_campaigns.type` |
| 4 | `Channel` | `item.row.channel` (chip) | `—` | `email_campaigns.channel` |
| 5 | `Send date` | `item.row.sendDate` | `—` via `<MonoDate>` | `email_campaigns.send_date` (`date`) |
| 6 | `Design due` | `item.row.designDueDate` | `—` | **computed**, `send_date` − 5 days (`EMAIL_DESIGN_DUE_OFFSET_DAYS`). Not stored; cell title says `Send date − 5 days (formula, read-only)` |
| 7 | `Copywriting due` | `item.row.copywritingDueDate` | `—` | **computed**, `send_date` − 10 days. Not stored |
| 8 | `Assignee` | `item.row.assigneeName` | `—` | **joined**: `email_campaigns.assignee_id` matched against `users.clerk_user_id` → `users.full_name` (`email-campaigns.ts:160`) |
| 9 | `Klaviyo` | `item.klaviyoHost`, title the full URL | `—` | `email_campaigns.klaviyo_link`; host **computed** |
| 10 | `Copy link` | `item.copyHost` | `—` | `email_campaigns.copy_link`; host **computed** |
| 11 | `Campaigns & Offers` | `item.row.campaignOfferNames` (one chip each) | `—` when the array is empty | **linked names** from the `email_campaign_campaigns` junction → `campaigns_offers.name` |
| 12 | `Updated` | `item.updatedLabel` | none | `email_campaigns.updated_at` |

Stored but shown nowhere in this grid: `campaign_purpose`, `copywriting`, `design`, `assets`, and
the `email_campaign_products` / `email_campaign_collections` links (which the row type carries as
`productNames` / `collectionNames`).

### email-flows — `/app/email-flows`

Columns: `apps/web/src/app/app/email-flows/email-flows-workspace.tsx:138` (`EMAIL_FLOW_COLUMNS`).
Table: `email_flows` (`packages/db/src/schema/email-flows.ts:32`), row type `EmailFlowListRow`
(`packages/db/src/email-flows.ts:44`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Flow name` **(frozen)** | `item.flow.flowName` | none | `email_flows.flow_name` (NOT NULL) |
| 2 | `Status` | `item.flow.status` (chip) | `—` | `email_flows.status` |
| 3 | `Type` | `item.flow.type` (chip) | `—` | `email_flows.type` |
| 4 | `Expected setup date` | `item.setupLabel` | `—` | `email_flows.expected_setup_date` (`date`) |
| 5 | `Design due` | `item.designDueLabel` | `—` | **computed**, `expected_setup_date` − 5 days. Not stored |
| 6 | `Copywriting due` | `item.copywritingDueLabel` | `—` | **computed**, `expected_setup_date` − 10 days. Not stored |
| 7 | `Assignee` | `item.flow.assigneeName` | `—` | **joined**: `email_flows.assignee_id` matched against `users.clerk_user_id` → `users.full_name` (`email-flows.ts:173`) |
| 8 | `Klaviyo link` | `item.klaviyoHost`, title the full URL | `—` | `email_flows.klaviyo_link`; host **computed** |
| 9 | `Updated` | `item.updatedLabel` | none | `email_flows.updated_at` |

Stored but shown nowhere: `flow_purpose`, `copywriting`, `design`, `inspo`, and the
`email_flow_campaigns` link (carried on the row as `campaignNames`).

### personas — `/app/personas`

Columns: `apps/web/src/app/app/personas/personas-workspace.tsx:81` (`PERSONA_COLUMNS`).
Table: `personas` (`packages/db/src/schema/personas.ts:14`), row type `PersonaListRow`
(`packages/db/src/personas.ts:27`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.persona.name` | none | `personas.name` (NOT NULL) |
| 2 | `Stage of Awareness` | `item.persona.stageOfAwareness` (chip) | `—` | `personas.stage_of_awareness` (`awareness_stage` pg enum) |
| 3 | `Updated` | `item.updatedLabel` | none | `personas.updated_at` |

**Three columns against fourteen stored research fields.** `day_in_the_life`, `demographic`,
`psychographic`, `core_desires`, `emotional_triggers`, `pain_points`, `success_factors`,
`perceived_barriers`, `buying_triggers`, `problem_challenge`, `success_transformation`,
`trigger_words` and `product_id` are all stored and none appear in the grid. The search
(`matches`, line 65) reads `productName` and `angleNames`, which have no columns either.

### products — `/app/products`

Columns: `apps/web/src/app/app/products/products-workspace.tsx:112` (`PRODUCT_COLUMNS`).
Table: `products` (`packages/db/src/schema/products.ts:11`), row type `ProductListRow`
(`packages/db/src/products.ts:28`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Product name` **(frozen)** | `item.product.name` | none | `products.name` (NOT NULL) |
| 2 | `Landing page URL` | `item.linkHost`, title `item.product.link` | no dash — but `page.tsx:70` is `hostLabel(product.link) ?? product.link`, so an unparseable URL falls back to the raw value | `products.link` (`text` NOT NULL); host **computed** |
| 3 | `Collection link` | `item.collectionHost` | `—` | `products.collection_link`; host **computed** |
| 4 | `Updated` | `item.updatedLabel` | none | `products.updated_at` |

Column 1 also renders `<PropagationBadge>`. Column 2 needs no dash because `products.link` is NOT
NULL. `ProductListRow` also carries `conceptCount` and `angleNames`, neither of which is a column
here.

### sm-campaign-feed — `/app/sm-campaign-feed`

Columns: `apps/web/src/app/app/sm-campaign-feed/sm-campaign-feed-workspace.tsx:79`
(`SM_TASK_COLUMNS`). Table: `sm_campaign_feed_tasks`
(`packages/db/src/schema/sm-campaign-feed-tasks.ts:25`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Task` **(frozen)** | `item.task.taskName` | none | `sm_campaign_feed_tasks.task_name` (NOT NULL) |
| 2 | `Platform` | `item.task.platform` (chip) | `—` | `sm_campaign_feed_tasks.platform` |
| 3 | `Due date` | `item.dueLabel` | `—` | `sm_campaign_feed_tasks.due_date` (`timestamptz`) |
| 4 | `Status` | `item.task.status` (chip) | `—` | `sm_campaign_feed_tasks.status` |
| 5 | `Reminder` | `item.reminder` (chip when `'due'`) | `—` otherwise | **computed**, `reminderState(dueDate, status, now)` at `fields.ts:130`. The base's "Reminder Trigger" formula; deliberately not stored (`schema/sm-campaign-feed-tasks.ts:14-18`) |
| 6 | `Notes` | `item.task.notes`, truncated, title the full text | `—` | `sm_campaign_feed_tasks.notes` |
| 7 | `Updated` | `item.updatedLabel` | none | `sm_campaign_feed_tasks.updated_at` |

Column 1 also renders `<PropagationBadge>`. All five business columns of this table are displayed.

### youtube-copywriting — `/app/youtube-copywriting`

Columns: `apps/web/src/app/app/youtube-copywriting/youtube-copywriting-workspace.tsx:89` (named
`COLUMNS`). Table: `youtube_copy` (`packages/db/src/schema/youtube-copy.ts:52`), item built by
`toYoutubeCopyItem` (`apps/web/src/app/app/youtube-copywriting/fields.ts:186`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Copy #` **(frozen)** | sorts on `item.copyNumber`, **renders `item.title`** | none | `youtube_copy.copy_number` (`integer` NOT NULL default 1); the title is **computed**, `copyNumberLabel(copyNumber)` |
| 2 | `Headline` | `item.headline` | `—` via `dash()` | `youtube_copy.headline` |
| 3 | `Descriptions` | `item.descriptions`, truncated, title the full text | `—` | `youtube_copy.descriptions` |
| 4 | `Status` | `item.statusLabel` / `item.statusTone` (chip) | none | `youtube_copy.status` (`text` NOT NULL) |
| 5 | `CTA` | `item.ctaLabel` | `—` | `youtube_copy.cta` |
| 6 | `Funnel` | `item.funnelLabel` | `—` | `youtube_copy.funnel` |
| 7 | `Used` | `item.used` (chip Yes/No) | chip | `youtube_copy.used` (`boolean` NOT NULL) |
| 8 | `Winning` | `item.winning` (chip Yes/No) | chip | `youtube_copy.winning` (`boolean` NOT NULL) |
| 9 | `Meta rating` | `item.metaRating` | `—` | `youtube_copy.meta_rating` (`integer`) |
| 10 | `Updated` | `item.updatedLabel` | none | `youtube_copy.updated_at` |

Note on column 1: the header says `Copy #` and the sort key is the integer, but the rendered text is
the generated label, not the raw number. Stored but shown nowhere: `angle`, `news_feed`,
`client_comment`, and the four junctions (`youtube_copy_collections`, `_products`, `_campaigns`,
`_copy_types`), all of which the item type carries as `linked*` arrays.

---

## Hand-built tables using `@tas/ui`'s `<Table>`

### ai-characters — `/app/ai-characters`

Headers written inline at `apps/web/src/app/app/ai-characters/ai-characters-workspace.tsx:160-163`;
there is no column constant. Table: `ai_characters` (`packages/db/src/schema/ai-characters.ts:15`).
No frozen column — `@tas/ui`'s `<Table>` has no sticky behaviour.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `character.name` | none | `ai_characters.name` (NOT NULL) |
| 2 | `Status` | `character.status` (chip) | `—` (also when `''`) | `ai_characters.status` |
| 3 | `Basic Info` | `basicInfoPreview(character.basicInfo)`, title the full text | `—`, returned by `basicInfoPreview` (`fields.ts:123`) | `ai_characters.basic_info` |
| 4 | `Updated` | `updatedLabel`, title `updatedTitle` | none | `ai_characters.updated_at` |

Stored but shown nowhere: `attachments`, `tone_of_voice`, `voice_link`, `personality_traits`,
`appearance`, `traits_and_habits`, `hobbies_and_lifestyle`, `work_and_background`,
`why_promotes_brand` — nine of the twelve Airtable fields, all edited in the panel.

### angles — `/app/angles`

Headers inline at `apps/web/src/app/app/angles/angles-workspace.tsx:272-275`. Table: `angles`
(`packages/db/src/schema/angles.ts:18`), row type `AngleListRow` (`packages/db/src/angles.ts:33`).
No frozen column. The page also offers a kanban view, grouped by `potential` (`kanbanGroupByField="potential"`, line 243).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `angle.name` | none | `angles.name` (NOT NULL) |
| 2 | `Persona` | `angle.personaName` (chip), title the full name | `—` | **linked**: first `angle_personas` row → `personas.name` |
| 3 | `Product` | `angle.productName` (chip) | `—` | **linked**: first `angle_products` row → `products.name` |
| 4 | `Updated` | `updatedLabel`, title `updatedTitle` | none | `angles.updated_at` |

`angles.status` (`AngleStatusesKey`, nullable) is stored and **appears nowhere on this list page** —
not as a column and not as the kanban grouping. It is edited in the side panel
(`angle-panel.tsx:555`, `renderStatus`) and rendered as a story on `/design-system` (commit
PARITY-30). Also stored and not shown: `description`, `pain_points`, `usp`, `type`, `formats`,
`ad_inspo_links`, `potential`, `winning`, `internal_notes`, `client_notes`, `brief_url`,
`exact_script_url`.

### campaigns-offers — `/app/campaigns-offers`

Headers inline at `apps/web/src/app/app/campaigns-offers/campaigns-workspace.tsx:220-230`. Table:
`campaigns_offers` (`packages/db/src/schema/campaigns.ts:28`). No frozen column. The page also
offers a timeline view.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `campaign.name` (`font-mono`) | none | `campaigns_offers.name` (NOT NULL) |
| 2 | `Holiday` | `campaign.holiday` | `—` | `campaigns_offers.holiday` |
| 3 | `Offer` | `campaign.discountOffer` | `—` | `campaigns_offers.discount_offer` |
| 4 | `Code` | `campaign.code` | `—` | `campaigns_offers.code` |
| 5 | `Official Date` | `formatDate(campaign.officialDate)` | `—`, returned by `formatDate` (`fields.ts:138`) | `campaigns_offers.official_date` (`date`) |
| 6 | `Ads Launch` | `formatDate(campaign.adsLaunchDate)` | `—` | `campaigns_offers.ads_launch_date` |
| 7 | `Ads End` | `formatDate(campaign.adsEndDate)` | `—` | `campaigns_offers.ads_end_date` |
| 8 | `Confirmed` | `campaign.confirmedByClient` (chip Yes/No) | chip | `campaigns_offers.confirmed_by_client` (`boolean` NOT NULL) |
| 9 | `Launched` | `campaign.launched` (chip Yes/No) | chip | `campaigns_offers.launched` (`boolean` NOT NULL) |
| 10 | `Product` | `productMap.get(campaign.productId)` (chip) | `—` when `productId` is null, and `—` as the chip label when the id resolves to no live product | **joined**: `campaigns_offers.product_id` → `products.name` |
| 11 | `Updated` | `updatedLabel`, title `updatedTitle` | none | `campaigns_offers.updated_at` |

Stored but shown nowhere: `country`, `description`, `promotional_ideas`.

### collections — `/app/collections`

Headers inline at `apps/web/src/app/app/collections/collections-workspace.tsx:201-206`. Table:
`collections` (`packages/db/src/schema/collections.ts:17`), row type `CollectionListRow`
(`packages/db/src/collections.ts:19`). No frozen column.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `collection.name` | none | `collections.name` (NOT NULL) |
| 2 | `URL` | `urlHost`, title `collection.url` | `—` | `collections.url`; host **computed** |
| 3 | `Campaign` | `collection.campaignName` | `—` | **joined**: `collections.campaign_id` → `campaigns_offers.name` |
| 4 | `Angle` | `collection.angleName` | `—` | **joined**: `collections.angle_id` → `angles.name` |
| 5 | `Product` | `collection.productName` | `—` | **joined**: `collections.product_id` → `products.name` |
| 6 | `Updated` | `updatedLabel`, title `updatedTitle` | none | `collections.updated_at` |

Column 1 also renders `<PropagationBadge>`. Stored but shown nowhere: `creative_design_note`,
`copywriting_id`, `creative_design_2_id`.

### competitive-research — `/app/competitive-research`

This page's headers **come from a constant in `fields.ts`, not from the workspace**:
`COMPETITIVE_RESEARCH_COLUMNS` at `apps/web/src/app/app/competitive-research/fields.ts:94`, mapped
at `competitive-research-workspace.tsx:170`. The cells are still written out one by one in the
workspace (lines 236-260), so the two lists are coupled only by convention. Table:
`competitive_research` (`packages/db/src/schema/competitive-research.ts:12`). No frozen column.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `entry.name` | none | `competitive_research.name` (NOT NULL) |
| 2 | `Type` | `entry.type` (chip) | `—` | `competitive_research.type` |
| 3 | `Website` | `websiteHost`, title `entry.website` | `—` | `competitive_research.website`; host **computed** by `hostLabel` (`fields.ts:123`) |
| 4 | `Instagram` | `entry.instagram` | `—` | `competitive_research.instagram` |
| 5 | `Updated` | `updatedLabel`, title `updatedTitle` | none | `competitive_research.updated_at` |

Column 1 also renders `<PropagationBadge>`. Stored but shown nowhere: `facebook_page`,
`meta_ads_library`, `analysis` — three of the seven Airtable fields.

### creative-design — `/app/creative-design`

Headers come from `BRIEF_COLUMNS` at `apps/web/src/app/app/creative-design/fields.ts:94`, mapped at
`briefs-workspace.tsx:339`; the cells are written out at `briefs-workspace.tsx:353-396`. Table:
`creative_briefs` (`packages/db/src/schema/briefs.ts:75`). No frozen column. The page also offers
kanban and gallery views.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.name` (`font-mono`) | none | `creative_briefs.name` (NOT NULL; the auto-generated §7 name, stored) |
| 2 | `Concept` | `item.conceptName` | a mute `StatusChip` labelled `STANDALONE_CONCEPT_SLUG`, **not** an em dash | **joined**: `creative_briefs.concept_id` → `concepts.name`. Nullable on purpose (CLAUDE.md non-negotiable 5) |
| 3 | `Type` | `item.typeLabel` | none | `creative_briefs.type` (`text` NOT NULL default `Video`); label via `creativeTypeLabel` (`page.tsx:103`) |
| 4 | `Priority` | `item.priority.label` / `.tone` (+ `item.priority.sla` beside it) | `—` | `creative_briefs.priority` (nullable). The SLA string is **computed** by `priorityView`, not stored |
| 5 | `Assignee` | `item.assignee` | `—` | `creative_briefs.assignee` (free `text`, not a user FK) |
| 6 | `Internal Status` | `item.status.label` / `.tone` (chip) | none | `creative_briefs.internal_status` (NOT NULL) |

**This table has no row-level empty state.** `briefs-workspace.tsx:347` maps `visible` directly with
no `visible.length === 0` branch, so an empty filtered list renders header cells over an empty
`<tbody>`. Every other `@tas/ui` table on these pages renders a `colSpan` empty row.

`creative_briefs` has ~40 stored columns; the list shows 6. `client_status` is carried on the item
(`item.clientStatus`) and rendered in the board sidebar, not as a table column.

### creative-dimensions — `/app/creative-dimensions`

Headers inline at `apps/web/src/app/app/creative-dimensions/creative-dimensions-workspace.tsx:156-159`.
Table: `creative_dimensions` (`packages/db/src/schema/creative-dimensions.ts:13`). No frozen column.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `dimension.name` | none | `creative_dimensions.name` (NOT NULL) |
| 2 | `Dimensions` | `dimension.dimensions` (`font-mono`) | `—` | `creative_dimensions.dimensions` |
| 3 | `Link Description` | `dimension.linkDescription` | `—` | `creative_dimensions.link_description` |
| 4 | `Updated` | `updatedLabel`, title `updatedTitle` | none | `creative_dimensions.updated_at` |

Column 1 also renders `<PropagationBadge>`. Stored but shown nowhere:
`creative_dimensions.creative_design_id`.

### meta-copywriting — `/app/meta-copywriting`

Headers come from `COPY_COLUMNS` at `apps/web/src/app/app/meta-copywriting/fields.ts:44`, mapped at
`copywriting-workspace.tsx:276`; the cells are written out at `copywriting-workspace.tsx:300-355`.
Table: `copywriting` (`packages/db/src/schema/copy.ts:57`). No frozen column. The page also offers
a kanban view.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Copy title / Headline` | **two values stacked**: `item.title` then `item.headline` | the headline line falls back to `EM_DASH`; the title never does | the title is **computed**, `copyTitle(copy_number)` over `copywriting.copy_number`; the second line is `copywriting.headline` |
| 2 | `Linked Creative` | `item.creativeName`, linked to `item.creativeHref` | `—` (`data-slot="copy-row-unlinked"`) | **joined**: `copywriting.creative_brief_id` → `creative_briefs.name` |
| 3 | `Concept` | `item.conceptName` | `—` | **joined**: `copywriting.concept_id` → `concepts.name` |
| 4 | `Funnel` | `copyFunnelLabel(item.funnel)` | `—`, returned by `copyFunnelLabel` (`packages/domain/src/copy/vocabulary.ts:36`) | `copywriting.funnel` |
| 5 | `Status` | `item.statusLabel` / `item.statusTone` (chip) | none | `copywriting.status` (NOT NULL) |
| 6 | `Updated` | `item.updatedLabel`, title `item.updatedTitle` | none | `copywriting.updated_at` |

Six headers over seven rendered values — header 1 names both of its stacked lines, which the
`fields.ts` comment states as deliberate. Like creative-design, **this table has no row-level empty
state**: `copywriting-workspace.tsx:284` maps `visible` with no length branch.

Stored but shown nowhere: `primary_copy`, `link_description`, `cta`, `used`, `winning`,
`meta_rating`, `click_for_ai_spell_checker`, `spelling_feedback`, `client_comment`, `product_id`.

### notifications — `/app/notifications`

Headers come from `NOTIFICATION_COLUMNS` at `apps/web/src/app/app/notifications/fields.ts:27`,
mapped at `notification-row.tsx:148`. The list is **partly computed**: two literal headers plus one
per entry of `NOTIFICATION_CHANNELS` (`packages/domain/src/notifications/channels.ts:17`) run
through `channelLabel`. Table: `notification_settings` (`packages/db/src/schema/notifications.ts:42`).
No frozen column.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Trigger` | `item.label` | none — `toNotificationItem` falls back to `notificationTriggerLabel(triggerKey)` | `notification_settings.trigger_key`, resolved to §12 wording in the domain. The label itself is not stored |
| 2 | `Recipient` | `item.recipient` | none — falls back to `UNROUTED_RECIPIENT` words and sets `item.unrouted` | **no column on this table.** Derived from the brand's `brand_assignments` through the trigger's `recipients` roles; `schema/notifications.ts:21-25` says a recipient column is deliberately absent |
| 3 | `Slack DM` | `item.slackEnabled`, rendered as a `<Switch>` | none (a switch is always on or off) | `notification_settings.slack_enabled` (`boolean` NOT NULL default true) |
| 4 | `Email` | `item.emailEnabled`, `<Switch>` | none | `notification_settings.email_enabled` (`boolean` NOT NULL default false) |

`notification_settings.position` is stored and drives the row order; it is not a column.

### propagation — `/app/propagation`

**Three separate hand-built tables on one route**, composed by `propagation-workspace.tsx:232`, `:256`
and `:258`.

**Table 1 — the promotion queue** (the page's main list). Headers from `PROMOTION_COLUMNS` at
`apps/web/src/app/app/propagation/fields.ts:44`, mapped at `promotion-row.tsx:303`; the cells are at
`promotion-row.tsx:202-269`. Database table: `promotion_requests`
(`packages/db/src/schema/promotion-requests.ts:56`), row type `PromotionRequestRow`
(`packages/db/src/promotion-requests.ts:68`). No frozen column.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Brand` | `item.brand.text` / `.muted` (chip) | `REMOVED_BRAND_LABEL` in the `warn` tone when the joined brand name is null | **joined**: `promotion_requests.brand_id` → `brands.name` |
| 2 | `Table` | `item.tableName` (`font-mono`) | none | `promotion_requests.table_name` (NOT NULL) |
| 3 | `Field` | `item.fieldName` (`font-mono`) | none | `promotion_requests.field_name` (NOT NULL) |
| 4 | `Requested by` | `item.requestedBy` | none | `promotion_requests.requested_by` (NOT NULL) |
| 5 | `Requested at` | `item.requestedAt`, title `item.requestedAtTitle` | none | `promotion_requests.requested_at` (NOT NULL) |
| 6 | `Change` | `item.currentValue` → `item.proposedValue`, both truncated with full text in `title` | none — both are NOT NULL | `promotion_requests.current_value` and `.proposed_value` (**two columns under one header**) |
| 7 | `Decision` | `item.statusLabel` / `.statusTone` (chip), plus either the action buttons or `item.decidedBy` + `item.reviewNote` | the review note is omitted when null | `promotion_requests.status` (NOT NULL), `.reviewed_by`, `.reviewed_at`, `.review_note` (**four columns under one header**) |

`promotion_requests.row_id` is stored and shown nowhere.

**Table 2 — child brands** (`propagation-controls.tsx:72-77`), headers inline, 2 columns:
`Child Brand` → `brand.name` → `brands.name`; `Status` → `brand.status` → `brands.status`
(`brand_status` pg enum). Empty row: `No child brands yet…`.

**Table 3 — custom fields** (`custom-fields-section.tsx:261-268`), headers inline, 5 columns (4 in
demo mode). Database table: `custom_field_schemas` (`packages/db/src/schema/custom-field-schemas.ts:16`).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Table` | `TABLE_OPTIONS` label for `field.tableName`, else the raw value | falls back to the raw name | `custom_field_schemas.table_name` (NOT NULL) |
| 2 | `Key` | `field.fieldKey` | none | `custom_field_schemas.field_key` (NOT NULL) |
| 3 | `Label` | `field.fieldLabel` | none | `custom_field_schemas.field_label` (NOT NULL) |
| 4 | `Type` | `FIELD_TYPE_OPTIONS` label for `field.fieldType`, else the raw value | falls back to the raw value | `custom_field_schemas.field_type` (NOT NULL) |
| 5 | *(empty header)* | — | — | **no backing column.** `<TableHead className="w-16" />` with no text, holding the delete button; rendered only when `!demo` |

`custom_field_schemas.options` and `.sort_order` are stored and shown nowhere.

### team — `/app/team`

Headers from `TEAM_COLUMNS` at `apps/web/src/app/app/team/fields.ts:30`, mapped at
`team-table.tsx:30`; the cells are at `team-table.tsx:52-92`. Table: `users`
(`packages/db/src/schema/users.ts:14`), row type `TeamListRow` (`packages/db/src/team.ts:59`).
No frozen column, and deliberately no row click.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Name` | **two or three values stacked**: `item.fullName`, `item.email`, and `CLIENT_ACCESS_NOTE` when `item.external` | none | `users.full_name` and `users.email` (both NOT NULL). The external flag is **computed** from the person's roles, not a column |
| 2 | `Role` | `item.roles` — one chip per role | the array is never empty: `rolesFor` (`team.ts:72`) falls back to the agency role | **computed** from `brand_assignments.role`, falling back to `memberships.role`; not a column on `users` |
| 3 | `Brands` | `item.brands.text` / `.muted` | `ALL_BRANDS_LABEL` for an agency admin, `NO_BRANDS_LABEL` (muted) otherwise — words, never a dash | **joined**: `brand_assignments.brand_id` → `brands.name` (`team.ts:109-117`) |
| 4 | `Last active` | `item.lastActive`, title `item.lastActiveTitle` | `Never` (and `title` becomes null) | `users.last_active_at` (nullable) |

`users.slack_user_id` is stored and shown nowhere on this page. `listTeam` joins `memberships`
INNER, so a client (brand assignments, no membership) never reaches this table at all.

### ugc — `/app/ugc`

The route is **tabbed**: the first tab is a card grid (`CreatorCard`, `ugc-workspace.tsx:303`, inside
`data-slot="creator-grid"` at line 299) and the Partnerships tab is a hand-built table
(`PartnershipTable`, `ugc-workspace.tsx:320`). No grid columns exist for the card tab — it renders
`data-slot="creator-name"`, `creator-identity`, `creator-links` and `creator-tracks` inside a card,
not a row.

Partnership headers from `PARTNERSHIP_COLUMNS` at `apps/web/src/app/app/ugc/fields.ts:329`, mapped
at `partnership-table.tsx:47`; the cells are at `partnership-table.tsx:65-91`. Table: `creators`
(`packages/db/src/schema/creators.ts:82`). No frozen column.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Creator` | `row.name` | none | `creators.name` (NOT NULL) |
| 2 | `Instagram Username` | `row.instagramUsername` | `—`, substituted by `partnershipRow` (`fields.ts:454`) when null or blank | `creators.instagram_username` |
| 3 | `Activity` | `row.activityLabel` / `.activityTone` (chip) | none | `creators.partnership_activity` (`text` NOT NULL default `not_active`) |
| 4 | `Activated` | `row.activatedLabel` | `—`, from `isoDateLabel` (`fields.ts:377`) | `creators.partnership_activated_at` |
| 5 | `Period` | `row.periodLabel` | `—`, from `periodLabel` (`fields.ts:406`) | `creators.partnership_period_days` **and** `creators.extension_days` (two columns, rendered as `60 + 30 days`) |
| 6 | `Countdown` | `row.countdownLabel` / `.countdownTone` | `—` among `countdownCellLabel`'s words | **computed**, `partnershipExpiry({activatedAt, periodDays, extensionDays}, now)` from `@tas/domain/creators`. Clock-dependent, not stored |

`creators.partnership_price_per_30_days` is stored and **deliberately absent** from this table —
`partnership-table.tsx:30-32` names it internal data under CLAUDE.md non-negotiable 10 and says so
on the page so the absence is not later "fixed".

---

## Hand-built tables using a raw `<table>` (not `@tas/ui`)

These four pages write `<table>`/`<thead>`/`<th>` directly, so they get none of `@tas/ui`'s
`<Table>` styling or the grid's sort, freeze and field-hiding behaviour.

### creator-ranking — `/app/creator-ranking`

Headers inline at `apps/web/src/app/app/creator-ranking/creator-leaderboard.tsx:43-50`. Table:
`creator_rankings` (`packages/db/src/schema/creator-rankings.ts:7`); `CreatorRankingListRow` is a
bare alias of the row (`packages/db/src/creator-rankings.ts:12`), so there are no joins. No frozen
column. Empty state is a `<p>` **outside** the table (`creator-leaderboard.tsx:37`), so the headers
disappear when the list is empty.

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Rank` | `MEDAL[ranking.rank] ?? '#' + rank` | falls back to `#N` | `creator_rankings.rank` (`integer` NOT NULL) |
| 2 | `Creator` | `ranking.creatorName` | none | `creator_rankings.creator_name` (`text` NOT NULL — a denormalised copy, not a join to `creators`) |
| 3 | `Ads` | `ranking.totalAds` | none | `creator_rankings.total_ads` (NOT NULL) |
| 4 | `Spend` | `spendLabel` | none | `creator_rankings.total_spend` (`numeric(12,2)` NOT NULL); formatted in `page.tsx:15` |
| 5 | `Conv.` | `ranking.totalConversions` | none | `creator_rankings.total_conversions` (NOT NULL) |
| 6 | `Avg ROAS` | `roasLabel` | `—`, set in `page.tsx:16` | `creator_rankings.avg_roas` (`numeric(8,2)`, nullable) |
| 7 | `Avg CPA` | `cpaLabel` | `—`, set in `page.tsx:17` | `creator_rankings.avg_cpa` (`numeric(10,2)`, nullable) |
| 8 | `Period` | `ranking.periodLabel` | none | `creator_rankings.period_label` (`text` NOT NULL) |

`creator_rankings.creator_id` is stored and shown nowhere.

### performance — `/app/performance`

Headers inline at `apps/web/src/app/app/performance/performance-tracker.tsx:105-113`. Table:
`ad_metrics` (`packages/db/src/schema/ad-metrics.ts:8`); `AdMetricListRow` is a bare alias
(`packages/db/src/ad-metrics.ts:12`). No frozen column. Empty state is a `<p>` outside the table
(line 99).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Ad` | `metric.adName` (`font-mono`, truncated) | none | `ad_metrics.ad_name` (NOT NULL) |
| 2 | `Spend` | `spendLabel` | none | `ad_metrics.spend` (`numeric(12,2)` NOT NULL) |
| 3 | `Impr.` | `impressionsLabel` | none | `ad_metrics.impressions` (NOT NULL) |
| 4 | `Clicks` | `clicksLabel` | none | `ad_metrics.clicks` (NOT NULL) |
| 5 | `Conv.` | `conversionsLabel` | none | `ad_metrics.conversions` (NOT NULL) |
| 6 | `CTR` | `ctrLabel` | `—`, set in `page.tsx:23` | `ad_metrics.ctr` (`numeric(6,4)`, nullable) |
| 7 | `CPC` | `cpcLabel` | `—`, `page.tsx:24` | `ad_metrics.cpc` (nullable) |
| 8 | `CPA` | `cpaLabel` | `—`, `page.tsx:25` | `ad_metrics.cpa` (nullable) |
| 9 | `ROAS` | `roasLabel` | `—`, `page.tsx:26` | `ad_metrics.roas` (nullable) |

`ad_metrics.date_range` (NOT NULL), `.meta_ad_id`, `.brief_id` and `.concept_id` are stored and
shown nowhere in this table.

### onboarding-forms — `/app/onboarding-forms`

Headers inline at `apps/web/src/app/app/onboarding-forms/onboarding-forms-table.tsx:41-45`. Table:
`onboarding_forms` (`packages/db/src/schema/onboarding-forms.ts:9`). No frozen column. Empty state
is a `<p>` outside the table (line 35).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Title` | **two values stacked**: `form.title`, then `form.description` when not null | the description line is simply omitted when null | `onboarding_forms.title` (NOT NULL) and `.description` |
| 2 | `Status` | `form.status` in a tone-coded `<span>` | none | `onboarding_forms.status` (NOT NULL default `draft`). **Renders the raw stored key**, lower-cased by CSS, not a label from a vocabulary |
| 3 | `Fields` | `fieldCount` | none | **computed**: `JSON.parse(form.fieldsJson).length` in `page.tsx:11`. Derived from `onboarding_forms.fields_json`, which is itself `text` holding JSON, not a count column |
| 4 | `Submissions` | `form.submissionsCount` | none | `onboarding_forms.submissions_count` (stored as `text` NOT NULL default `'0'`, not an integer) |
| 5 | `Share Token` | `form.shareToken` (`font-mono`) | none | `onboarding_forms.share_token` (NOT NULL, unique) |

This table is not built from a `StatusChip` and does not import `@tas/domain/state`, so it breaks
UI-governance rules 2 and 3 as written in CLAUDE.md.

### upload-links — `/app/upload-links`

Headers inline at `apps/web/src/app/app/upload-links/upload-links-table.tsx:39-44`. Table:
`upload_links` (`packages/db/src/schema/upload-links.ts:6`); `UploadLinkListRow` is a bare alias.
No frozen column. Empty state is a `<p>` outside the table (line 33).

| # | Header | Row property | Fallback | Drizzle column |
| --- | --- | --- | --- | --- |
| 1 | `Label` | `link.label`, linked to `uploadLinkPath(link.id)` | none | `upload_links.label` (NOT NULL) |
| 2 | `Recipient` | `link.recipientName` | `—` (inline `?? '—'`) | `upload_links.recipient_name` |
| 3 | `Usage` | `usageLabel` | none — becomes just `uploadsUsed` when `maxUploads` is null | `upload_links.uploads_used` and `.max_uploads` (**two columns**, both stored as `text`; combined in `page.tsx:12-13`) |
| 4 | `Expires` | `expiresLabel` | `Never` (words, not a dash), `page.tsx:11` | `upload_links.expires_at` |
| 5 | `Status` | `link.isActive` in a tone-coded `<span>` reading `Active`/`Inactive` | none | `upload_links.is_active` (`boolean` NOT NULL default true). **Not a `StatusChip`** |
| 6 | `Token` | `link.token` (`font-mono`) | none | `upload_links.token` (NOT NULL, unique) |

`upload_links.recipient_email` and `.notes` are stored and shown nowhere.

---

## Card pages (no columns)

These render cards or kanban columns, not table rows. There are no grid column definitions to
report, and none are invented below.

- **ad-spy** — `/app/ad-spy`. `AdSpyBoard` renders a CSS grid of cards
  (`ad-spy-board.tsx:83`, `grid grid-cols-1 … lg:grid-cols-3`). Rows come from `competitor_ads`.
  `page.tsx:13` computes one derived label, `daysLabel` (`'Nd active'` or `'—'`) from
  `row.daysActive`.
- **assets** — `/app/assets`. `AssetLibrary` renders a CSS grid of cards
  (`asset-grid.tsx:87`). Rows come from `assets`; `page.tsx` computes `updatedLabel`/`updatedTitle`
  from `assets.created_at` (**not** `updated_at`) and `sizeLabel` from `assets.size_bytes`.
- **themes** — `/app/themes`. `ThemeCard` in a CSS grid (`themes-workspace.tsx:328-332`,
  `data-slot="theme-grid"`). It does mount a `ViewSwitcher` with `tableKey="themes"`
  (line 242) and a kanban grouping field of `category`, but **no `AirtableGrid` is imported by this
  module** — there is no table view, so there are no columns. `themes` is the one global table
  (`brand_id` null, CLAUDE.md non-negotiable 3).
- **queue/internal** — `/app/queue/internal`. `QueueCard`s inside stage columns
  (`internal-queue-board.tsx:237`). A kanban board, not a table.
- **queue/client** — `/app/queue/client`. `ClientQueueCard`s inside stage columns
  (`client-queue-board.tsx:216`). A kanban board, not a table.
- **ugc** — `/app/ugc`, first tab. See the UGC section above: cards in the Creators tab, a table in
  the Partnerships tab.

## Pages that are neither a grid, a table nor cards

- **interface-config** — `/app/interface-config`. Two panels side by side: a nested `<ul>` tree of
  pages and fields with toggles (`config-tree.tsx:79`, `:116`) and a live preview
  (`interface-config-workspace.tsx:195`). No columns.
- **onboard** — `/app/onboard`. A multi-step wizard form (`onboard-wizard.tsx`). No table, no cards,
  no columns.

## Redirect-only directories

Each holds a single `page.tsx` calling `permanentRedirect` and preserving the query string. They
render nothing and therefore have no columns.

| Directory | Redirects to | File |
| --- | --- | --- |
| `briefs` | `/app/creative-design` | `apps/web/src/app/app/briefs/page.tsx` |
| `campaigns` | `/app/campaigns-offers` | `apps/web/src/app/app/campaigns/page.tsx` |
| `copywriting` | `/app/meta-copywriting` | `apps/web/src/app/app/copywriting/page.tsx` |

---

## What I could not establish

- **Whether any of these pages render correctly against live data.** This was a source read only;
  nothing was run. No `pnpm dev`, no test, no screenshot.
- **The Airtable field name behind each header.** Several schema files quote the Airtable field and
  table id in their doc comments (for example `schema/creative-reporting.ts:8` names
  `tblgW4bwDSSeqihlr`, `schema/creative-sheet-items.ts:13` names `tblGC0TxnHI7lKaNQ`,
  `client-asset-folders.ts:12` names `tbldFmPU6AWg62Fll`), and those are reproduced only where the
  file states them. I did not call the Airtable API, so I cannot confirm any field name "verbatim as
  the API returns it" — where this document names an Airtable field, it is quoting a repository
  comment, not an API response. Subagent A's area may cover that; this document does not.
- **`creators.gender`/`ethnicity`/etc. on the UGC card tab.** I read the card's `data-slot`
  attributes but did not enumerate the card's fields, because a card has no columns and the brief
  says to say so rather than invent them.
