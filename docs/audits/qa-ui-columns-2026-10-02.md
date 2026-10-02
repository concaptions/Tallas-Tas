# UI column parity: what each list page displays vs the pinned Gratsi field names — 2026-10-02

Subagent B of the parity audit. **Question answered:** for every list page under
`apps/web/src/app/app/`, which columns does the page actually render, which Drizzle column does each
one read, and which of the owner's pinned Gratsi fields are PRESENT or MISSING — and for each
missing one, is it blocked on a schema change or only on a grid column definition.

**Commit audited.** `/Users/macbook/tallas-tas`, branch `main`, working tree clean. HEAD was
`d5fd450` when this audit began and advanced to `22244ee` during it (`a0ee7ef` DOCS, `22244ee`
FORMULAS). `git diff --stat d5fd450..22244ee` touches only `docs/` and the new
`packages/db/src/formulas/`; **no file quoted below changed**, so every citation holds at `22244ee`.

**Method, and what is not asserted.**

- Header text is quoted verbatim from the `header:` property, the `<TableHead>` literal or the
  column-label constant that renders it. Nothing is paraphrased.
- The Drizzle column is the `pgTable` column name as `packages/db/src/schema/` spells it, reached by
  following the row type back through the module's query function in `packages/db/src/`.
- Airtable field names are quoted from the **live base schema**, fetched this session from
  `GET /v0/meta/bases/appllDG4OmkK2Hdnn/tables` (HTTP 200, 21 tables). Where the owner's pinned list
  and the live base disagree, both are given and the difference is listed under
  "Discrepancies with the pinned spec".
- The Airtable-field → Drizzle-column correspondence is taken from the importer's own field map,
  `packages/db/src/scripts/import-mappings.ts`, cited by field name. It is not inferred from name
  similarity.
- **PRESENT / MISSING, and the BLOCKED-ON-SCHEMA vs COLUMN-DEF-ONLY split, were checked against the
  live database**, not against the schema files alone: column existence came from
  `information_schema.columns` and row/value counts from `count(*) filter (…)`, both read-only
  `SELECT`s against `DATABASE_URL`. A field is called COLUMN-DEF-ONLY only where that query returned
  the column. Where a column exists but is empty in production, the row says so rather than implying
  data is waiting to be shown.
- Where something could not be established, this document says so in those words.

**Nothing was changed.** No source file, no migration, no database write, no git operation.

---

## Summary

`Cols` = columns the list actually renders. `P/M` = pinned fields present / missing.
`Frozen` = a sticky first column. `Fields` = a show/hide columns control.
`Filters` = any filter control beyond the search box.

| # | Module | Route | Cols | P/M | Views offered | Grid default | Frozen | Fields | Filters |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | personas | `/app/personas` | 17 | 6/1 | grid, kanban, gallery | yes | `Name` | yes (toolbar) | none |
| 2 | angles | `/app/angles` | 17 | 13/3 | grid, kanban, gallery | yes | `Name` | yes (toolbar) | none |
| 3 | concepts | `/app/concepts` | 21 | 17/4 | grid, kanban, gallery | yes | `Name` | yes (toolbar) | none |
| 4 | themes | `/app/themes` | 10 | 6/0 | grid, kanban, gallery | yes | `Name` | yes (toolbar) | **status tabs + category group** |
| 5 | products | `/app/products` | 10 | 6/0 | grid, gallery | yes | `Product name` | yes (toolbar) | none |
| 6 | collections | `/app/collections` | 6 | 4/2 | **grid only, no switcher** | yes (only view) | **none** | **none** | none |
| 7 | ugc | `/app/ugc` | 33 | 32/2 | grid, kanban, gallery | yes | `Name` | yes (toolbar) | 2 tabs (2nd is another table) |
| 8 | creative-design | `/app/creative-design` | 6 | 6/25 | grid, kanban, gallery | **NO — Kanban** | **none** | **none** | kanban group-by |
| 9 | creative-sheet | `/app/creative-sheet` | 7 | 9/4 | grid, kanban | yes | `Name` | yes (grid's own) | kanban group-by |
| 10 | creative-modules | `/app/creative-modules` | 5 | 4/0 | grid only | yes | `Module name` | yes (grid's own) | none |
| 11 | meta-copywriting | `/app/meta-copywriting` | 6 | 5/13 | grid, kanban | yes | **none** | **none** | kanban group-by |
| 12 | youtube-copywriting | `/app/youtube-copywriting` | 10 | 9/7 | grid, kanban | yes | `Copy #` | yes (grid's own) | kanban group-by |
| 13 | copy-types | `/app/copy-types` | 5 | 4/0 | grid only | yes | `Name` | yes (grid's own) | none |
| 14 | email-campaigns | `/app/email-campaigns` | 12 | 11/6 | grid, kanban, timeline | yes | `Name` | yes (grid's own) | kanban group-by |
| 15 | email-flows | `/app/email-flows` | 9 | 8/5 | grid, kanban | yes | `Flow name` | yes (grid's own) | kanban group-by |
| 16 | campaigns-offers | `/app/campaigns-offers` | 11 | 9/7 | grid, timeline | yes | **none** | **none** | none |
| 17 | creative-reporting | `/app/creative-reporting` | 12 | 11/2 | grid only | yes | `Name + Angle + Offer` | yes (grid's own) | none |
| 18 | sm-campaign-feed | `/app/sm-campaign-feed` | 7 | 6/0 | grid, kanban | yes | `Task` | yes (grid's own) | kanban group-by |
| 19 | creative-dimensions | `/app/creative-dimensions` | 4 | 3/1 | **grid only, no switcher** | yes (only view) | **none** | **none** | none |
| 20 | client-assets | `/app/client-assets` | 5 | 4/0 | grid only | yes | `Folder name` | yes (grid's own) | none |
| 21 | competitive-research | `/app/competitive-research` | 5 | 4/3 | **grid only, no switcher** | yes (only view) | **none** | **none** | none |

**Totals across the 21 pinned tables: 262 pinned fields, 177 PRESENT, 85 MISSING — 7
BLOCKED-ON-SCHEMA and 78 COLUMN-DEF-ONLY.**

### Two kinds of "Fields" control — they are not equivalent

Six pages (personas, angles, concepts, themes, products, ugc) pass `view={tableView.config}` to
`AirtableGrid`, which makes the grid **controlled**: order, visibility, freeze and sort come from the
viewer's saved view in `user_table_views`, and the Fields popover lives in `ViewToolbar`
(`apps/web/src/components/views/view-toolbar.tsx:66-68`).

Nine pages (client-assets, copy-types, creative-modules, creative-reporting, creative-sheet,
sm-campaign-feed, email-campaigns, email-flows, youtube-copywriting) pass no `view` prop, so the
grid is **uncontrolled** and renders its own Fields menu
(`apps/web/src/components/views/airtable-grid.tsx:128-136`). That choice is remembered in
`localStorage` per browser, is not a saved view, and is not visible to anyone else.

Six pages (collections, competitive-research, creative-dimensions, creative-design,
meta-copywriting, campaigns-offers) render a hand-built `@tas/ui` `<Table>` and have **no Fields
control at all and no frozen column** — confirmed by `grep -c sticky` returning 0 in each of those
six workspace files.

### View-policy violations (owner's rule: Grid default everywhere, Gallery available, Kanban only on UGC and Creative Briefs)

Read from `getTableCapability` in `packages/domain/src/views/table-views.ts`.

**Grid is not the default on one page.** `/app/creative-design` opens on **Kanban**:
`loadViewPreference('briefs', 'kanban')` at `apps/web/src/app/app/creative-design/page.tsx:70`, with
the in-code comment "Briefs open on Kanban by default (P2B)". Every other page resolves to `grid`
(`defaultViewType: 'grid'` on the six controlled pages; `: 'grid'` as the final fallback in the
`initialView` ternary on the uncontrolled pages; `conceptViewFromParam` falls back to `'table'`,
which maps to `grid`).

**Kanban is offered on 11 tables beyond the two allowed.** Allowed: `creators` (UGC) and `briefs`
(Creative Briefs). Also offering Kanban today: `concepts`, `personas`, `themes`, `angles`,
`creative-sheet`, `sm-campaign-feed`, `email-campaigns`, `email-flows`, `youtube-copywriting`,
`copywriting` (the Meta Copywriting page) — plus `assets`, `ad-spy` and `onboarding-forms` outside
the pinned set.

**Gallery is missing on 13 of the 21 pinned tables.** Present on `personas`, `angles`, `concepts`,
`themes`, `products`, `creators`, `briefs`. Absent from `collections`, `creative-sheet`,
`creative-modules`, `copywriting`, `youtube-copywriting`, `copy-types`, `email-campaigns`,
`email-flows`, `campaigns`, `creative-reporting`, `creative-dimensions`, `client-assets`,
`competitive-research`.

**Three pinned tables have no capability entry at all** — `collections`, `creative-dimensions` and
`competitive-research` are absent from `TABLE_VIEW_CAPABILITIES`, so those pages render no
`ViewSwitcher` and no view can be chosen. Adding Gallery there needs a registry entry first.

---

## Discrepancies with the pinned spec

The pinned list is not the live base. Live counts come from the meta-API fetch described above.

| # | Table | Pinned count claim | Pinned list length | Live field count | Live fields the pinned list omits |
| --- | --- | --- | --- | --- | --- |
| 1 | Personas | — | 7 | 7 | — (exact match) |
| 2 | Angles | 17 | 16 | **21** | `(Internal) Creative Design`, `Creative Sheet`, `(Internal) Creative Design 2`, `UGC Management copy`, `Concepts copy` |
| 3 | Concepts | — | 21 | **23** | `(Internal) Creative Design`, `UGC Management copy` |
| 4 | Themes | — | 6 | 6 | — |
| 5 | (Internal) Product | 8 | 6 | **11** | `(Internal) Creative Design 2`, `Table 17`, `Email Campaigns Management copy` **(twice — two fields share this name)**, `Creative Sheet` |
| 6 | (Internal) Collections | 9 | 6 | **13** | `Creative Sheet`, `(Internal) Product`, `(Internal) Creative Design 2`, `Table 17`, `Email Campaigns Management copy` **(twice)**, `Ads Copywriting copy` |
| 7 | UGC Management | — | 34 | **36** | `Notify Flag` (formula), `Slack Notified ` (checkbox, trailing space) |
| 8 | Creative Design (Internal & Interface) | — | 31 | **42** | `Last Modified`, `Created`, `Click for AI Spell Checker Again`, `Spelling Feedback`, `Spelling Feedback 2`, `Created 2`, `(Internal) Collections 2`, `(Internal) Collections 3`, `Ads Copywriting copy`, `Angles`, `Concepts (from Angles)` |
| 9 | Creative Sheet | — | 13 | **29** | 13 lookups (`Performance (from Creative Name)`, `(Internal) Product (from Creative Name)`, `Angle (from Creative Name)`, `Concepts (from Angle) (from Creative Name)`, `Elements we are Testing`, `Design File (from Creative Name)`, `Design Link URL`, `Collection`, `Platform`, `Funnel`, `Type`, `Proposed Copy`, `Creative Module`) plus `Created`, `Last Modified`, `Click for AI Spell Checker Again` |
| 10 | (Internal) Creative Modules | — | 4 | 4 | — |
| 11 | Meta Copywriting | 20 | 18 | **30** | `Offer`, `Campaign (from Campaign)`, `Code (from Campaign)`, `Collection URL`, `Link (from Product)`, `Products (from Collections)`, `Created By`, `Creative Reporting`, `Creative Sheet`, `(Internal) Product`, `⚠️ Please Change the Status of the copy`, `(Internal) Creative Design 2` |
| 12 | Youtube Copywriting | 21 | 16 | **29** | `Offer`, `Campaign (from Campaign)`, `Code (from Campaign)`, `Creative`, `Collection URL`, `Link (from Product)`, `Products (from Collections)`, `Created By`, `Creative Reporting`, `Creative Sheet`, `(Internal) Product`, `(Internal) Creative Design`, `⚠️ Please Change the Status of the copy` |
| 13 | (Internal) Copy Type | — | 4 | 4 | — |
| 14 | Email Campaigns Management | — | 17 | 17 | — |
| 15 | Email Flows Management | — | 13 | 13 | — |
| 16 | Campaigns & Offers | — | 16 | **20** | `Product` (lookup), `Design attached`, `Email Campaigns Management copy`, `Ads Copywriting copy` |
| 17 | Creative Reporting | — | 13 | **14** | `Creative Name (from Creative)` (lookup) |
| 18 | SM Campaign Management Feed | — | 6 | 6 | — |
| 19 | (Internal) Creative Dimensions | — | 4 | 4 | — |
| 20 | Client Assets Organisation | — | 4 | 4 | — |
| 21 | Competitive research | — | 7 | 7 | — |

The five count claims the brief flagged are all confirmed: the pinned text says 17/8/9/20/21 for
tables 2/5/6/11/12 and its own lists hold 16/6/6/18/16.

### Field names the pinned list spells differently from the live base

Each of these is a label difference, not a missing field. Quoted live-first.

- Personas 2: live `'Description  [Age Status Salary]'` — **two spaces** after "Description".
- Themes 6: live `'Attachment Summary'`. The pinned "(AI generated)" suffix is not part of the name.
- Youtube Copywriting 6: live `'Descriptions (90 caractères max)'` — `caractères`, with the accent.
- Concepts 13: live `'Decription'` — the base's own misspelling. The importer notes it verbatim
  ("The live base's own spelling of the field", `import-mappings.ts`).
- UGC Management 1: live `'Creator name (Filled by UGC Manager)'`, pinned "Creator name".
- UGC Management 15: live `"(Client's) Note or Comments"`, pinned "Client's Note or Comments".
- UGC Management 20 and 30: live `'Tracking Number '` and `'Slack Notified '` carry a trailing space.
- Creative Design 40: live `'Script & brief breakdown '` carries a trailing space.
- Creative Reporting 1: live `'Creative Name'` is a formula and it is **invalid in the live base** —
  `{"isValid": false, "formula": "{flds4NKRqVNPgH4Qf}", "result": null}`, pointing at
  `'Creative Name (from Creative)'`, itself a lookup with `"recordLinkFieldId": null`. The field
  produces nothing today.
- Pinned "UGC Management › Assignee" does not exist: the live UGC Management table has no Assignee
  field among its 36.

### Two importer-map facts that change a verdict below

- **`concepts.performance` does not exist.** `import-mappings.ts` maps Concepts `Performance` →
  `performance`, but no such column is in `packages/db/src/schema/concepts.ts`, in any migration
  (`grep -rn performance packages/db/src/schema` finds it only on `briefs.ts:130`), or in the live
  database (`information_schema.columns` for `concepts` returns no `performance`). That makes the
  pinned Concepts `Performance` BLOCKED-ON-SCHEMA.
- **Airtable Concepts `Type` lands in `concepts.formats`, which no page reads.** See module 3.

### Live row counts (read-only `SELECT count(*) … WHERE deleted_at IS NULL`)

`brands` 6 · `products` 9 · `themes` 9 · `personas` 31 · `angles` 48 · `concepts` 106 ·
`collections` 5 · `creators` 75 · `creative_briefs` 397 · `copywriting` 4 · `creative_dimensions` 22.
Empty: `creative_sheet_items`, `creative_modules`, `youtube_copy`, `copy_types`, `email_campaigns`,
`email_flows`, `campaigns_offers`, `creative_reporting`, `sm_campaign_feed_tasks`,
`client_asset_folders`, `competitive_research` — all 0.

A COLUMN-DEF-ONLY verdict on an empty table means the column exists and a grid column is all that is
missing; it does not mean data is waiting. Those rows are marked "(table empty)".

---

## 1 Personas — `/app/personas`

Columns: `apps/web/src/app/app/personas/personas-workspace.tsx:99-166`. Row type `PersonaListRow`
(`packages/db/src/personas.ts:30-38`) over `personas` (`packages/db/src/schema/personas.ts`).
Columns 5–16 are generated by spreading `PERSONA_FIELDS`
(`apps/web/src/app/app/personas/fields.ts:78-80`), so each header is that field's `label`.

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.persona.name` | `personas.name` |
| 2 | `Stage of Awareness` | `item.persona.stageOfAwareness` | `personas.stage_of_awareness` |
| 3 | `Product` | `item.persona.productName` | `products.name` via `personas.product_id` |
| 4 | `Linked angles` | `item.persona.angleNames` | `angles.name` via `angle_personas` |
| 5 | `A Day in the Life` | `item.persona.dayInTheLife` | `personas.day_in_the_life` |
| 6 | `Demographic` | `item.persona.demographic` | `personas.demographic` |
| 7 | `Psychographic` | `item.persona.psychographic` | `personas.psychographic` |
| 8 | `Core Desires` | `item.persona.coreDesires` | `personas.core_desires` |
| 9 | `Success Factors` | `item.persona.successFactors` | `personas.success_factors` |
| 10 | `Success/Transformation` | `item.persona.successTransformation` | `personas.success_transformation` |
| 11 | `Pain Points` | `item.persona.painPoints` | `personas.pain_points` |
| 12 | `Perceived Barriers` | `item.persona.perceivedBarriers` | `personas.perceived_barriers` |
| 13 | `Problem/Challenge` | `item.persona.problemChallenge` | `personas.problem_challenge` |
| 14 | `Buying Triggers` | `item.persona.buyingTriggers` | `personas.buying_triggers` |
| 15 | `Emotional Triggers` | `item.persona.emotionalTriggers` | `personas.emotional_triggers` |
| 16 | `Trigger Words` | `item.persona.triggerWords` | `personas.trigger_words` |
| 17 | `Updated` | `item.updatedLabel` | `personas.updated_at` |

Pinned verdicts (7):

| Gratsi field | Verdict | Evidence |
| --- | --- | --- |
| `Name` | PRESENT | column 1 |
| `Description  [Age Status Salary]` | PRESENT | column 6, under the header `Demographic`; the importer maps this field to `demographic` with the note 'Airtable "Description" maps to demographic'. 28 of 31 rows non-null |
| `Personality` | PRESENT | column 7, header `Psychographic`; importer maps `Personality` → `psychographic`. 23 of 31 non-null |
| `Drivers for this persona` | PRESENT | column 8, header `Core Desires`; importer maps it there. 26 of 31 non-null |
| `Passion` | **MISSING — BLOCKED-ON-SCHEMA** | no `passion` column in `personas` (live `information_schema` list, and none in `schema/personas.ts`); importer entry is `drizzleColumn: null, handler: 'skip'` |
| `Angles` | PRESENT | column 4, header `Linked angles`; `angle_personas` holds 78 rows |
| `Problem-Solution Awareness Level` | PRESENT | column 2, header `Stage of Awareness` |

Columns rendered that are not Gratsi Personas fields: `Product`, `A Day in the Life`,
`Success Factors`, `Success/Transformation`, `Pain Points`, `Perceived Barriers`,
`Problem/Challenge`, `Buying Triggers`, `Emotional Triggers`, `Trigger Words`, `Updated`.

---

## 2 Angles — `/app/angles`

Columns: `apps/web/src/app/app/angles/angles-workspace.tsx:134-270`. Row type `AngleListRow`
(`packages/db/src/angles.ts:33-38`) over `angles` (`packages/db/src/schema/angles.ts`).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.angle.name` | `angles.name` |
| 2 | `Persona` | `item.angle.personaName` | `personas.name` via `angle_personas` (first id) |
| 3 | `Product` | `item.angle.productName` | `products.name` via `angle_products` (first id) |
| 4 | `Status` | `item.angle.status` | `angles.status` |
| 5 | `Potential` | `item.angle.potential` | `angles.potential` |
| 6 | `Winning` | `item.angle.winning` | `angles.winning` |
| 7 | `Formats to create` | `item.angle.formats` | `angles.formats` (jsonb) |
| 8 | `Type` | `item.angle.type` | `angles.type` (jsonb) |
| 9 | `Description` | `item.angle.description` | `angles.description` |
| 10 | `Pain Points` | `item.angle.painPoints` | `angles.pain_points` |
| 11 | `USP` | `item.angle.usp` | `angles.usp` |
| 12 | `Ad Inspo` | `item.angle.adInspoLinks.length` | count of `angles.ad_inspo_links` |
| 13 | `Brief URL` | `item.angle.briefUrl` | `angles.brief_url` |
| 14 | `Exact Script URL` | `item.angle.exactScriptUrl` | `angles.exact_script_url` |
| 15 | `Internal Notes` | `item.angle.internalNotes` | `angles.internal_notes` |
| 16 | `Client Notes` | `item.angle.clientNotes` | `angles.client_notes` |
| 17 | `Updated` | `item.updatedLabel` | `angles.updated_at` |

Pinned verdicts (16 listed):

PRESENT (13): `Name` (1) · `Status` (4) · `Potential` (5) · `Description` (9) ·
`Product (from Angles)` (3, header `Product`) · `Personas (from Angles)` (2, header `Persona`) ·
`Formats to create` (7) · `Client Notes` (16) · `Brief` (13, header `Brief URL`) ·
`Exact Script` (14, header `Exact Script URL`) · `Ad Inspo` (12 — rendered as a **count of links**,
not the text) · `Winning` (6) · `Internal Notes` (15).

| Missing field | Verdict | Evidence |
| --- | --- | --- |
| `Creators` | **BLOCKED-ON-SCHEMA** | no creator↔angle column or junction exists. `packages/db/src/schema/junction-tables.ts` defines only `creator_concepts`, `creator_products`, `concept_angles`, `concept_themes`, `angle_personas`, `angle_products`, `conceptCollections`, `brief_asset_folders`. Importer: `drizzleColumn: null, handler: 'skip'`, note "Link to UGC Management with no mapped inverse; empty on all 43 live rows" |
| `Concepts` | **COLUMN-DEF-ONLY** | `concept_angles` exists and holds **115 rows**. The page already loads and inverts them — `indexConceptsByAngle(conceptRows.rows, CONCEPT_TRACK)` at `angles/page.tsx:81` — and hands `conceptsByAngle` to the workspace, which uses it only in the side panel. No migration needed |
| `(Internal) Creative Modules` | **COLUMN-DEF-ONLY** | `creative_module_angles` exists (`packages/db/src/schema/creative-modules.ts:45`) and the page loads `indexCreativeModulesByAngle(...)` at `angles/page.tsx:80`. The junction is **empty (0 rows)** in production, so the column would render 0 for every row until the link data lands |

Columns rendered that are not Gratsi Angles fields: `Type` (the live base has no Angles `Type`
field; `angles.type` is non-empty on 5 of 48 rows), `Pain Points`, `USP`, `Updated`.

---

## 3 Concepts — `/app/concepts`

Columns: `apps/web/src/app/app/concepts/concepts-workspace.tsx:120-249`. Row type `ConceptItem`
(`apps/web/src/app/app/concepts/fields.ts:186-250`), built in `concepts/page.tsx:60-78` from
`ConceptListRow` (`packages/db/src/concepts.ts:75-91`) over `concepts`.

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.name` | `concepts.name` |
| 2 | `Batch` | `item.batch` | `concepts.batch` |
| 3 | `Angle` | `item.angleName` | `angles.name` via `concept_angles` |
| 4 | `Persona` | `item.personaName` | `personas.name`, read through the first angle |
| 5 | `Product` | `item.productName` | `products.name`, read through the first angle |
| 6 | `Theme` | `item.themeName` | `themes.name` via `concept_themes` |
| 7 | `Internal Status` | `item.status` | `concepts.internal_status` |
| 8 | `Client Status` | `item.clientStatus` | `concepts.client_status` |
| 9 | `Approval Status` | `item.approvalStatusLabel` | `concepts.approval_status` |
| 10 | `Category` | `item.categoryLabel` | `concepts.category` |
| 11 | `Concept Style` | `item.styleLabel` | `concepts.concept_style` |
| 12 | `Formats to create` | `item.formatsToCreate` | `concepts.formats_to_create` (jsonb) |
| 13 | `Hook Examples` | `item.hookExamples` | `concepts.hook_examples` |
| 14 | `Script Idea` | `item.scriptIdea` | `concepts.script_idea` |
| 15 | `Description` | `item.description` | `concepts.description` |
| 16 | `Pain Points` | `item.painPoints` | `concepts.pain_points` |
| 17 | `USP` | `item.usp` | `concepts.usp` |
| 18 | `Client Comments` | `item.clientComments` | `concepts.client_comments` |
| 19 | `Collection` | `item.collectionName` | `collections.name` via `concept_collections` |
| 20 | `Creators` | `item.creatorCount` | count via `creator_concepts` |
| 21 | `Ad Inspo` | `item.adInspoCount` | count of `concepts.ad_inspo_links` |

Pinned verdicts (21 listed):

PRESENT (17): `Name` (1) · `Batch` (2) · `Theme` (6) · `Angle` (3) · `Category` (10) ·
`Style` (11, header `Concept Style`) · `Product` (5) · `Personas` (4, header `Persona`) ·
`Status` (9, header `Approval Status` ← `approval_status`) · `Decription` (15, header `Description`) ·
`Script` (14, header `Script Idea`) · `Collection` (19) · `Pain Points` (16) · `USP` (17) ·
`Hooks` (13, header `Hook Examples`) · `Client's Comments` (18 — column empty on all 106 rows) ·
`UGC Management` (20, header `Creators`, a count via `creator_concepts`, 87 rows).

| Missing field | Verdict | Evidence |
| --- | --- | --- |
| `Production Status` | **COLUMN-DEF-ONLY** | `concepts.production_status` exists and holds data: **73 of 106 rows non-null**. It is hidden deliberately — `docs/decisions.md:684-688`, "Concepts: Production Status is hidden, not dropped… client direction, Prompt C… No migration; the column can return by rendering it again." **This is a policy conflict for the owner to settle, not a build task**: the pinned spec asks for it and a recorded client direction removed it |
| `Type` | **COLUMN-DEF-ONLY — and the nearest column is mis-wired** | see the note below |
| `Performance` | **BLOCKED-ON-SCHEMA** | `concepts` has no `performance` column, in the schema file, in any migration, or in the live database. The importer maps Concepts `Performance` → `performance` anyway, i.e. at a column that does not exist |
| `Campaigns & Offers` | **COLUMN-DEF-ONLY** | `campaign_concepts` exists (`packages/db/src/schema/campaign-links.ts:35`) and `ConceptListRow.campaignIds` is already populated (`packages/db/src/concepts.ts:81`). The junction is **empty (0 rows)** in production |

**`Type` — a column that reads the wrong column.** The importer maps Airtable Concepts `Type`
(a `multipleSelects`) into `concepts.formats`, with the note 'Airtable "Type" multiSelects →
concepts.formats jsonb'. The grid's column keyed `formatsToCreate`, header `Formats to create`
(`concepts-workspace.tsx:199-205`, fed by `formatsToCreate: row.formatsToCreate` at
`concepts/page.tsx:68`), reads `concepts.formats_to_create` instead. Measured in production:

- `concepts.formats` non-empty on **106 of 106** rows — this is the imported Gratsi `Type` data.
- `concepts.formats_to_create` non-empty on **0 of 106** rows — this is what the grid renders.

`grep -rn formats apps/web/src/app/app/concepts/` returns only `formats_to_create` references, so
`concepts.formats` is displayed **nowhere** on the page. The fix is a one-line source change in the
existing column definition plus a header relabel; no migration.

Columns rendered that are not Gratsi Concepts fields: `Internal Status`, `Client Status`,
`Ad Inspo`.

---

## 4 Themes — `/app/themes`

Columns: `apps/web/src/app/app/themes/themes-workspace.tsx:119-207`. Row type `ThemeListRow` over
`themes` (`packages/db/src/schema/themes.ts`). Themes is the one global table (`isGlobal: true`).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `theme.name` | `themes.name` |
| 2 | `Category` | `theme.category` | `themes.category` |
| 3 | `Status` | `theme.status` | `themes.status` |
| 4 | `Assignee` | `assigneeValue(theme)` | `themes.assignee_id`, resolved to a user name or shown as the stored value |
| 5 | `Notes` | `theme.notes` | `themes.notes` |
| 6 | `Attachments` | `theme.attachments` | count of `themes.attachments` (jsonb) |
| 7 | `Attachment Summary` | `theme.aiAttachmentSummary` | `themes.ai_attachment_summary` |
| 8 | `Reference Links` | `theme.referenceLinks` | count of `themes.reference_links` |
| 9 | `Used by` | `theme.usedByBrandCount` | computed usage count |
| 10 | `Active` | `theme.isActive` | `themes.is_active` |

Pinned verdicts (6): **all PRESENT.** `Name` (1) · `Notes` (5) · `Assignee` (4) · `Status` (3) ·
`Attachments` (6 — a count; `themes.attachments` is empty on all 9 rows) ·
`Attachment Summary` (7).

This is the only module where the `Assignee` cell handles an imported Airtable collaborator name
correctly: `assigneeValue()` returns `{text, mono}` and the cell renders `data-resolved` either way
(`themes-workspace.tsx:149-160`), so a name that matches no platform user still shows.

Columns rendered that are not Gratsi Themes fields: `Category`, `Reference Links`, `Used by`,
`Active`. Themes has **no `Updated` column**.

Filters: a status tablist (`data-slot="theme-tabs"`, `themes-workspace.tsx:385-389`) and a category
filter group (`role="group" aria-label="Filter by category"`, `:460-464`). The only pinned module
with a real filter beyond search.

---

## 5 (Internal) Product — `/app/products`

Columns: `apps/web/src/app/app/products/products-workspace.tsx:128-215`. Row type `ProductItem`
(`:38-56`) over `products` (`packages/db/src/schema/products.ts`).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Product name` **(frozen)** | `item.product.name` | `products.name` |
| 2 | `Landing page URL` | `item.linkHost` / `product.link` | `products.link` |
| 3 | `Collection link` | `item.collectionHost` | `products.collection_link` |
| 4 | `Angles` | `item.product.angleNames` | `angles.name` via `angle_products` |
| 5 | `Concepts` | `item.product.conceptCount` | count through the angle chain |
| 6 | `Creative Designs` | `item.creativeDesigns.length` | count of `creative_briefs.product_id` |
| 7 | `Creators` | `item.creators.length` | count via `creator_products` |
| 8 | `Email Campaigns` | `item.emailCampaigns.length` | count via `email_campaign_products` |
| 9 | `YouTube Copy` | `item.youtubeCopy.length` | count via `youtube_copy_products` |
| 10 | `Updated` | `item.updatedLabel` | `products.updated_at` |

Pinned verdicts (6 listed): **all PRESENT.**
`Product Name / Landing Page Name` (1, header `Product name`) · `Link` (2, header
`Landing page URL`) · `Angles` (4) · `Youtube Copywriting` (9, header `YouTube Copy`, via
`youtube_copy_products` — junction **empty**) · `(Internal) Creative Design` (6, header
`Creative Designs`, via `creative_briefs.product_id` — 84 of 397 briefs carry one) ·
`UGC Management` (7, header `Creators`, via `creator_products` — junction **empty**).

Columns rendered that are not Gratsi Product fields: `Collection link`, `Concepts`,
`Email Campaigns`, `Updated`.

---

## 6 (Internal) Collections — `/app/collections`

Hand-built `@tas/ui` `<Table data-slot="collections-table">`,
`apps/web/src/app/app/collections/collections-workspace.tsx:198-297`. Headers are literals at
`:201-206`; cells at `:266-292`. Row type over `collections`
(`packages/db/src/schema/collections.ts`).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` | `collection.name` | `collections.name` |
| 2 | `URL` | `urlHost` / `collection.url` | `collections.url` |
| 3 | `Campaign` | `collection.campaignName` | `campaigns_offers.name` via `collections.campaign_id` |
| 4 | `Angle` | `collection.angleName` | `angles.name` via `collections.angle_id` |
| 5 | `Product` | `collection.productName` | `products.name` via `collections.product_id` |
| 6 | `Updated` | `updatedLabel` | `collections.updated_at` |

No frozen column (`grep -c sticky` = 0), no Fields control, no `ViewSwitcher`.

Pinned verdicts (6 listed):

PRESENT (4): `Main Collection` (1, header `Name`) · `URL` (2) · `Campaigns & Offers` (3, header
`Campaign`) · `Angles` (4, header `Angle` ← `collections.angle_id`; **null on all 5 rows**).

| Missing field | Verdict | Evidence |
| --- | --- | --- |
| `Copywriting` | **COLUMN-DEF-ONLY** | `collections.copywriting_id` exists (`schema/collections.ts:31`) and in the live database. Null on all 5 rows |
| `(Internal) Creative Design` | **COLUMN-DEF-ONLY** | two columns exist to render from: `collections.creative_design_2_id` and `collections.creative_design_note`. Both null on all 5 rows. Note the importer maps the live field `(Internal) Creative Design 2` → `creativeDesignNote` and **skips** `(Internal) Creative Design`, so which of the two a column should read needs the owner's call — I could not establish from the code which Airtable field the owner means by the pinned entry |

Columns rendered that are not in the pinned list for this table: `Product`
(`collections.product_id`, null on all 5 rows — the live base's `(Internal) Product` on this table
is a residual `singleLineText` the importer skips), `Updated`.

---

## 7 UGC Management — `/app/ugc`

Columns: `apps/web/src/app/app/ugc/ugc-workspace.tsx:112-379`. Columns 2–4 are generated by
spreading `creatorTracks(...)` (`:144-166`), whose headers are `` `${track.label} Status` `` with
labels from `CREATOR_TRACKS` (`ugc/fields.ts:91-95`: `Internal`, `Client`, `Assets`). Row type
`CreatorCardRow` (`ugc/fields.ts:161`) over `creators` (`packages/db/src/schema/creators.ts`).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `creator.name`, `creator.profilePicUrl` (avatar) | `creators.name`, `creators.profile_pic_url` |
| 2 | `Internal Status` | `internalCreatorStatus` | `creators.internal_creator_status` |
| 3 | `Client Status` | `clientStatus` | `creators.client_status` |
| 4 | `Assets Status` | `internalAssetsStatus` | `creators.internal_assets_status` |
| 5 | `Gender` | `creator.gender` | `creators.gender` |
| 6 | `Age Bracket` | `creator.ageBracket` | `creators.age_bracket` |
| 7 | `Ethnicity` | `creator.ethnicity` | `creators.ethnicity` |
| 8 | `Platform` | `creator.platform` | `creators.platform` (jsonb; non-empty on 69 of 75) |
| 9 | `Creator Link` | `creator.creatorLink` | `creators.creator_link` |
| 10 | `Instagram Username` | `creator.instagramUsername` | `creators.instagram_username` |
| 11 | `Facebook Profile` | `creator.facebookProfileUrl` | `creators.facebook_profile_url` |
| 12 | `Linked Concepts` | `creator.conceptIds.length` | count via `creator_concepts` (87 rows) |
| 13 | `Linked Products` | `creator.productIds.length` | count via `creator_products` (0 rows) |
| 14 | `Internal Brief` | `creator.internalBrief` | `creators.internal_brief` |
| 15 | `Client's Note` | `creator.clientNote` | `creators.client_note` |
| 16 | `Creator Info Request` | `creator.creatorInfoRequest` | `creators.creator_info_request` |
| 17 | `Raw Assets URL` | `creator.rawAssetsUrl` | `creators.raw_assets_url` |
| 18 | `Video Intro` | `creator.videoIntroUrl` | `creators.video_intro_url` |
| 19 | `Shipping Location` | `creator.shippingLocation` | `creators.shipping_location` |
| 20 | `Tracking Number` | `creator.trackingNumber` | `creators.tracking_number` |
| 21 | `Date of Management` | `creator.dateOfManagement` | `creators.date_of_management` |
| 22 | `Budget per 60sec Video` | `creator.budgetPer60s` | `creators.budget_per_60s` |
| 23 | `Creator Cost (USD)` | `creator.creatorCost` | `creators.creator_cost` |
| 24 | `Paid by TAS (USD)` | `creator.costUsd` | `creators.cost_usd` |
| 25 | `Payment Date` | `creator.paymentDate` | `creators.payment_date` |
| 26 | `Partnership Activity` | `creator.partnershipActivity` | `creators.partnership_activity` |
| 27 | `Date of Partnership Activation` | `creator.partnershipActivatedAt` | `creators.partnership_activated_at` |
| 28 | `Partnership Period (days)` | `creator.partnershipPeriodDays` | `creators.partnership_period_days` |
| 29 | `Extension (days)` | `creator.extensionDays` | `creators.extension_days` |
| 30 | `Partnership Price per 30 Days` | `creator.partnershipPricePer30Days` | `creators.partnership_price_per_30_days` |
| 31 | `Continue Working With?` | `creator.continueWorkingWith` | `creators.continue_working_with` |
| 32 | `Partnership Notes` | `creator.partnershipNotes` | `creators.partnership_notes` |
| 33 | `Slack Notified` | `creator.slackNotified` | `creators.slack_notified` |

`conceptIds` / `productIds` come from the **junctions**, not from the legacy jsonb columns
(`packages/db/src/creators.ts:63-64`, "read from the `creator_concepts`/`creator_products`
junction"). I checked this because `creators.concept_ids` and `creators.product_ids` are empty on all
75 rows while `creator_concepts` holds 87 — the column is reading the right source.

Pinned verdicts (34 listed): **32 PRESENT**, 2 MISSING.

PRESENT, with the two that need qualifying:
- `Creator's Profile Pic` — PRESENT but **has no column of its own**: it renders as the avatar inside
  the frozen `Name` cell (`ugc-workspace.tsx:118-143`), with an initials fallback.
- `Status` → column 2 (`Internal Status`) and `Creator Status` → column 3 (`Client Status`): the
  importer maps `Status` → `internalCreatorStatus` and `Creator Status` → `clientStatus`, so the two
  pinned fields are on different tracks and both are shown.

All of `Date of Management`, `Age`, `Gender`, `Ethnicity`, `Concept to film`, `Products`,
`Budget per 60sec video`, `Partnership Activity`, `Creator's video Intro`,
`Facebook Profile for Partnership`, `Platform`, `(Client's) Note or Comments`,
`Additional Note - TAS Team`, `Creator's cost (USD) - Internal`, `Raw assets`, `Shipping Location`,
`Tracking Number `, `Creator Link`, `Paid by TAS`, `Payment Date`, `Creator Info Request`,
`Date of Partnership Activation`, `Partnership Time Period (days)`, `Continue Working With?`,
`Extension Time Period`, `Partnership Price per 30 days`, `Notes for Partnership ads` and
`Instagram Username` are PRESENT, each in the row above.

| Missing field | Verdict | Evidence |
| --- | --- | --- |
| `Concepts` | **BLOCKED-ON-SCHEMA** | this is a **second** link to Concepts beside `Concept to film`. Only one junction exists (`creator_concepts`, fed from `Concept to film`). Importer: `drizzleColumn: null, handler: 'skip'`, note "Second link to Concepts beside Concept to film, empty on all 70 live rows; excluded in docs/decisions.md" |
| `Creator's cost (USD)` (formula) | **BLOCKED-ON-SCHEMA** | no column stores it. Importer: `drizzleColumn: null, handler: 'skip'`, note "Formula (cost + 5% fee); computed server-side". HEAD now carries `packages/db/src/formulas/` (commit `22244ee`); I could not establish that it is wired into the UGC row type or this grid — `CreatorCardRow` carries no such field |

UGC has **no `Updated` column**. The second tab (`Partnership Ads`, `UGC_TABS` at
`ugc/fields.ts:55-58`) renders a different table (`ugc/partnership-table.tsx`), so it is not a
filter over this grid.

---

## 8 Creative Design (Internal & Interface) — `/app/creative-design`

**The largest gap in the audit: 6 columns against 31 pinned fields.**
`/app/briefs` is a `permanentRedirect` to this route (`briefs/page.tsx`).

Hand-built `@tas/ui` `<Table data-slot="briefs-table">`,
`apps/web/src/app/app/creative-design/briefs-workspace.tsx:434-498`. Headers come from
`BRIEF_COLUMNS` (`creative-design/fields.ts:94-101`); cells at `:463-495`. Row type `BriefItem`
(`fields.ts:260-285`) over `BriefListRow` (`packages/db/src/briefs.ts:52-56`) over `creative_briefs`.

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` | `item.name` | `creative_briefs.name` |
| 2 | `Concept` | `item.conceptName` | `concepts.name` via `creative_briefs.concept_id` (null renders the standalone chip) |
| 3 | `Type` | `item.typeLabel` | `creative_briefs.type` |
| 4 | `Priority` | `item.priority` | `creative_briefs.priority` |
| 5 | `Assignee` | `item.assignee` | `creative_briefs.assignee` |
| 6 | `Internal Status` | `item.status` | `creative_briefs.internal_status` |

No frozen column, no Fields control.

Pinned verdicts (31 listed): **6 PRESENT, 25 MISSING — every one of the 25 is COLUMN-DEF-ONLY.**

PRESENT (6): `Name` · `Type` · `Priority` · `Internal Status` · `Assignee` · `Concept`.

Every missing field below has a live column or junction, so **no migration is required for any of
them**. Non-null / non-empty counts are over the 397 live briefs.

| Missing field | Column or junction | Live data |
| --- | --- | --- |
| `Client Status` | `creative_briefs.client_status` (and `BriefItem.clientStatus` is already resolved, `fields.ts:271`) | 397/397 |
| `Performance` | `creative_briefs.performance` | 63/397 |
| `Batch` | `creative_briefs.batch` | 393/397 |
| `QA Checklist Doc` | `creative_briefs.qa_checklist_doc` | 390/397 non-empty |
| `Video Editor QA` | `creative_briefs.qa_video_editor` | 71 true |
| `Graphic Designer QA` | `creative_briefs.qa_designer` | 5 true |
| `Creative Strategist QA` | `creative_briefs.qa_strategist` | 4 true |
| `Angle` | `creative_briefs.angle_id`; `BriefListRow.angleName` already resolved | 386/397 |
| `(Internal) Product` | `creative_briefs.product_id`; `BriefListRow.productName` already resolved | 84/397 |
| `Language` | `creative_briefs.language` | 124/397 |
| `Design File` | `creative_briefs.design_file` | 321/397 non-empty |
| `Design Link URL` | `creative_briefs.design_file_url` | 210/397 |
| `Inspiration` | `creative_briefs.inspiration` (0/397) and `inspiration_image` (16/397 non-empty) | see left |
| `Brief to Design/Editing` | `creative_briefs.brief_to_design` | 395/397 |
| `Script / Ad Content` | `creative_briefs.script_content` (270/397); `ad_content` is 0/397 | see left |
| `Platform` | `creative_briefs.platform` | 341/397 non-empty |
| `Dimensions` | `creative_briefs.dimensions` | 368/397 non-empty |
| `Source` | `creative_briefs.source`; `BriefItem.sourceLabel` already resolved | 397/397 |
| `Funnel` | `creative_briefs.funnel`; `BriefItem.funnelLabel` already resolved | 397/397 |
| `Elements we are Testing` | `creative_briefs.elements_tested` | 377/397 |
| `Offer` | `creative_briefs.offer` | 4/397 |
| `Creative Module` | `creative_module_designs` junction (`schema/creative-modules.ts:63`); `BriefItem.linkCounts.modules` already computed | junction empty |
| `Creative Sheet` | `creative_sheet_items.brief_id`; `BriefItem.linkCounts.sheetItems` already computed | table empty |
| `Meta Copywriting` | `copywriting.creative_brief_id` | 4 copy rows exist; this inverse is **not** among the four `BriefLinkKind`s (`fields.ts:296`), so the page must add the inversion read — still no migration |
| `Script & brief breakdown ` | `creative_briefs.script_and_brief_breakdown` | 0/397 non-empty |

Most of these values are already on the page without a new query: `BriefFormSnapshot`
(`fields.ts:229-254`) carries `funnel`, `type`, `version`, `batch`, `product`, `priority`,
`assignee`, `dueDate`, `briefToDesign`, `scriptContent`, `elementsTested`, `adContent`,
`inspiration`, `offer`, `language`, `spellingFeedback2`, `angleId`, `productId`, `inspoLinks`,
`dimensions`, `internalStatus` and `clientStatus` for every row.

**This page is also the one Grid-default violation**, opening on Kanban
(`creative-design/page.tsx:70`).

---

## 9 Creative Sheet — `/app/creative-sheet`

Columns: `apps/web/src/app/app/creative-sheet/creative-sheet-workspace.tsx:118-168`. Row type
`SheetItemView` (`:49-53`) wrapping `CreativeSheetItemListRow`
(`packages/db/src/creative-sheet-items.ts:56-57`) over `creative_sheet_items`. Table is **empty**
(0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.name` | **computed, not stored** — month name + brief name, replicating the Airtable formula (`MONTH_NAMES`, `creative-sheet-items.ts:59-73`) |
| 2 | `Brief` | `item.briefName` | `creative_briefs.name` via `creative_sheet_items.brief_id` |
| 3 | `Internal Status` | `item.internalStatus` | `creative_sheet_items.internal_status` |
| 4 | `Status` | `item.status` | `creative_sheet_items.status` |
| 5 | `Winning` | `item.winning` | `creative_sheet_items.winning` |
| 6 | `Used` | `item.used` | `creative_sheet_items.used` |
| 7 | `QA` | three ticks over `QA_CHECKS` | `qa_video_editor`, `qa_designer`, `qa_strategist` |

Pinned verdicts (13 listed): **9 PRESENT, 4 MISSING, all COLUMN-DEF-ONLY.**

PRESENT (9): `Name (formula)` (1 — derived in TypeScript, correctly; the live formula is
`DATETIME_FORMAT({created}, "MMMM") & "-" & {…}`) · `Creative Name` (2, header `Brief`) ·
`Internal Status` (3) · `Status` (4) · `Used` (6) · `Winning` (5) · and the three QA checkboxes
`Video Editor QA`, `Graphic Designer QA`, `Creative Strategist QA` — these are PRESENT but
**merged into the single `QA` column**, each as a tick labelled with its own Airtable name from
`QA_CHECKS` (`creative-sheet/fields.ts:136-140`), not as three headed columns.

| Missing field | Verdict | Column |
| --- | --- | --- |
| `QA Checklist Doc` | COLUMN-DEF-ONLY | `creative_sheet_items.qa_checklist_doc` (table empty) |
| `Client's Comments` | COLUMN-DEF-ONLY | `creative_sheet_items.client_comments` (table empty) |
| `Denied/revisions needed` | COLUMN-DEF-ONLY | `creative_sheet_items.denied_revisions_needed` (table empty) |
| `Spelling Feedback` | COLUMN-DEF-ONLY | `creative_sheet_items.spelling_feedback` (table empty) |

---

## 10 (Internal) Creative Modules — `/app/creative-modules`

Columns: `apps/web/src/app/app/creative-modules/creative-modules-workspace.tsx:80-139`. Table is
**empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Module name` **(frozen)** | `creativeModule.moduleName` | `creative_modules.module_name` |
| 2 | `Foreplay link` | `foreplayHost` / `creativeModule.foreplayLink` | `creative_modules.foreplay_link` |
| 3 | `Angles` | `creativeModule.angleNames` | `angles.name` via `creative_module_angles` |
| 4 | `Creative designs` | `creativeModule.briefNames` | `creative_briefs.name` via `creative_module_designs` |
| 5 | `Updated` | `updatedLabel` | `creative_modules.updated_at` |

Pinned verdicts (4): **all PRESENT.** `Module Name` (1) · `Concepts` (3, header `Angles` — the
Airtable field named `Concepts` **links the Angles table**, importer note "Links the ANGLES table
despite its name (schema/creative-modules.ts)", junction `creative_module_angles`) ·
`Foreplay Link` (2) · `(Internal) Creative Design` (4, header `Creative designs`).

Extra column: `Updated`.

---

## 11 Meta Copywriting — `/app/meta-copywriting`

`/app/copywriting` is a `permanentRedirect` here (`copywriting/page.tsx`).

Hand-built `<Table data-slot="copy-table">`,
`apps/web/src/app/app/meta-copywriting/copywriting-workspace.tsx:273-357`. Headers from
`COPY_COLUMNS` (`meta-copywriting/fields.ts:44-51`); cells at `:302-352`. Row type `CopyItem`
(`fields.ts:64-112`) over `copywriting` (`packages/db/src/schema/copy.ts`). 4 live rows.

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Copy title / Headline` | `item.title` (line 1) and `item.headline` (line 2) | `copywriting.copy_number` via `copyTitle(...)`; `copywriting.headline` |
| 2 | `Linked Creative` | `item.creativeName` | `creative_briefs.name` via `copywriting.creative_brief_id` |
| 3 | `Concept` | `item.conceptName` | `concepts.name` via `copywriting.concept_id` |
| 4 | `Funnel` | `item.funnel` | `copywriting.funnel` |
| 5 | `Status` | `item.statusLabel` | `copywriting.status` |
| 6 | `Updated` | `item.updatedLabel` | `copywriting.updated_at` |

No frozen column, no Fields control.

Pinned verdicts (18 listed): **5 PRESENT, 13 MISSING — 2 BLOCKED-ON-SCHEMA, 11 COLUMN-DEF-ONLY.**

PRESENT (5): `Copy #` (1, first line) · `Headline` (1, second line) · `Status` (5) · `Funnel` (4) ·
`Creative` (2, header `Linked Creative`).

| Missing field | Verdict | Evidence |
| --- | --- | --- |
| `Angle` | **BLOCKED-ON-SCHEMA** | `copywriting` has no `angle` column (live `information_schema` list). The live Airtable field is a residual `singleLineText`; importer: `drizzleColumn: null, handler: 'skip'`, note "Residual single-line text left by a converted link; excluded in docs/decisions.md" |
| `(Internal) Creative Design` | **BLOCKED-ON-SCHEMA** | a **second** link beside `Creative`. Importer: `drizzleColumn: null, handler: 'skip'`, note "Second link to Creative Design beside Creative; the platform keeps one creative_brief_id" |
| `Collections` | COLUMN-DEF-ONLY | inverse of `collections.copywriting_id`; `CopyItem.collections` is already loaded (`fields.ts:109`). 0 of 5 collections point at a copy row |
| `Product` | COLUMN-DEF-ONLY **with a caveat** | `copywriting.product_id` exists (0 of 4 rows set). But the live Airtable `Product` on this table is a residual `singleLineText` the importer skips, so a column over `product_id` would show nothing imported from that field. Flagging rather than claiming the data is there |
| `Descriptions` | COLUMN-DEF-ONLY | `copywriting.primary_copy`, 4/4 rows |
| `News Feed` | COLUMN-DEF-ONLY | `copywriting.link_description`, 4/4 rows |
| `CTA` | COLUMN-DEF-ONLY | `copywriting.cta`, 4/4; `CopyItem.cta` already loaded |
| `Campaign Code` | COLUMN-DEF-ONLY | `copywriting_campaigns` junction (`schema/campaign-links.ts:16`); `CopyItem.campaigns` already loaded. Junction empty |
| `Copy Type` | COLUMN-DEF-ONLY | `copywriting_copy_types` (`schema/copy-types.ts:49`); `CopyItem.copyTypeIds` already loaded. Junction empty |
| `Client's Comment` | COLUMN-DEF-ONLY | `copywriting.client_comment`, 1 of 4 rows |
| `USED` | COLUMN-DEF-ONLY | `copywriting.used` |
| `Winning` | COLUMN-DEF-ONLY | `copywriting.winning` |
| `Meta Rating` | COLUMN-DEF-ONLY | `copywriting.meta_rating`, 0 of 4 rows |

Columns rendered that are not Gratsi Meta Copywriting fields: `Concept`
(`copywriting.concept_id`), `Updated`.

---

## 12 Youtube Copywriting — `/app/youtube-copywriting`

Columns: `apps/web/src/app/app/youtube-copywriting/youtube-copywriting-workspace.tsx:89-171`. Row
type `YoutubeCopyItem` (`youtube-copywriting/fields.ts:157-183`) over `youtube_copy`. Table is
**empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Copy #` **(frozen)** | `item.title` | `youtube_copy.copy_number` via `copyNumberLabel(...)` |
| 2 | `Headline` | `item.headline` | `youtube_copy.headline` |
| 3 | `Descriptions` | `item.descriptions` | `youtube_copy.descriptions` |
| 4 | `Status` | `item.statusLabel` | `youtube_copy.status` |
| 5 | `CTA` | `item.ctaLabel` | `youtube_copy.cta` |
| 6 | `Funnel` | `item.funnelLabel` | `youtube_copy.funnel` |
| 7 | `Used` | `item.used` | `youtube_copy.used` |
| 8 | `Winning` | `item.winning` | `youtube_copy.winning` |
| 9 | `Meta rating` | `item.metaRating` | `youtube_copy.meta_rating` |
| 10 | `Updated` | `item.updatedLabel` | `youtube_copy.updated_at` |

Pinned verdicts (16 listed): **9 PRESENT, 7 MISSING — all COLUMN-DEF-ONLY.**

PRESENT (9): `Copy #` · `Status` · `Descriptions (90 caractères max)` (3, header `Descriptions`) ·
`Headline` · `CTA` · `Funnel` · `USED` (header `Used`) · `Winning` · `Meta Rating` (header
`Meta rating`).

Every missing field is already resolved onto `YoutubeCopyItem` and simply not rendered:

| Missing field | Column or junction | Already on the item |
| --- | --- | --- |
| `Collections` | `youtube_copy_collections` (`schema/youtube-copy.ts:84`) | `item.linkedCollections` |
| `Product` | `youtube_copy_products` (`:98`) | `item.linkedProducts` |
| `Angle` | `youtube_copy.angle` (a real text column) | `item.angle` |
| `News Feed` | `youtube_copy.news_feed` | `item.newsFeed` |
| `Campaign Code` | `youtube_copy_campaigns` (`:115`) | `item.linkedCampaigns` |
| `Copy Type` | `youtube_copy_copy_types` (`:132`) | `item.linkedCopyTypes` |
| `Client's Comment` | `youtube_copy.client_comment` | `item.clientComment` |

Extra column: `Updated`.

---

## 13 (Internal) Copy Type — `/app/copy-types`

Columns: `apps/web/src/app/app/copy-types/copy-types-workspace.tsx:70-128`. Table is **empty**
(0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `copyType.name` | `copy_types.name` |
| 2 | `Description` | `copyType.description` | `copy_types.description` |
| 3 | `Meta copies` | `item.metaCopies` | `copywriting` rows via `copywriting_copy_types` |
| 4 | `YouTube copies` | `item.youtubeCopies` | `youtube_copy` rows via `youtube_copy_copy_types` |
| 5 | `Updated` | `updatedLabel` | `copy_types.updated_at` |

Pinned verdicts (4): **all PRESENT.** `Name` (1) · `Description` (2) ·
`Copywriting (link)` → column 4, `YouTube copies` · `Ads Copywriting copy (link)` → column 3,
`Meta copies`.

The two link columns are crossed relative to their Airtable names, and that is correct: the
importer records `Copy Type › Copywriting` as the inverse of **Youtube Copywriting › Copy Type**
(`youtube_copy_copy_types`) and `Copy Type › Ads Copywriting copy` as the inverse of **Meta
Copywriting › Copy Type** (`copywriting_copy_types`). The query sides match
(`packages/db/src/copy-types.ts:63-78, 195-196`). Worth a relabel under the display-spec rule, but
nothing is missing.

Extra column: `Updated`.

---

## 14 Email Campaigns Management — `/app/email-campaigns`

Columns: `apps/web/src/app/app/email-campaigns/email-campaigns-workspace.tsx:104-204`. Row type
`EmailCampaignItem` (`email-campaigns/fields.ts:321-328`) over `EmailCampaignListRow`
(`packages/db/src/email-campaigns.ts:45-54`). Table is **empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` **(frozen)** | `item.row.name` | `email_campaigns.name` |
| 2 | `Status` | `item.row.status` | `email_campaigns.status` |
| 3 | `Type` | `item.row.type` | `email_campaigns.type` |
| 4 | `Channel` | `item.row.channel` | `email_campaigns.channel` |
| 5 | `Send date` | `item.row.sendDate` | `email_campaigns.send_date` |
| 6 | `Design due` | `item.row.designDueDate` | **derived**, `send_date − 5 days` (`EMAIL_DESIGN_DUE_OFFSET_DAYS`) |
| 7 | `Copywriting due` | `item.row.copywritingDueDate` | **derived**, `send_date − 10 days` |
| 8 | `Assignee` | `item.row.assigneeName` | `email_campaigns.assignee_id`, looked up in `users` |
| 9 | `Klaviyo` | `item.klaviyoHost` | `email_campaigns.klaviyo_link` |
| 10 | `Copy link` | `item.copyHost` | `email_campaigns.copy_link` |
| 11 | `Campaigns & Offers` | `item.row.campaignOfferNames` | `campaigns_offers.name` via `email_campaign_campaigns` |
| 12 | `Updated` | `item.updatedLabel` | `email_campaigns.updated_at` |

Pinned verdicts (17): **11 PRESENT, 6 MISSING — all COLUMN-DEF-ONLY.**

PRESENT (11): `Name` · `Status` · `Send Date` · `Copywriting Due Date (formula)` (7, derived) ·
`Design Due Date (formula)` (6, derived) · `Assignee` (8) · `Copy Link` (10) · `Klaviyo Link` (9) ·
`Type` (3) · `Channel` (4) · `Campaigns & Offers` (11).

| Missing field | Verdict | Column or junction |
| --- | --- | --- |
| `Campaign Purpose` | COLUMN-DEF-ONLY | `email_campaigns.campaign_purpose` (table empty) |
| `Copywriting` | COLUMN-DEF-ONLY | `email_campaigns.copywriting` (table empty) |
| `Design` | COLUMN-DEF-ONLY | `email_campaigns.design` (table empty) |
| `Assets` | COLUMN-DEF-ONLY | `email_campaigns.assets` (table empty) |
| `(Internal) Product` | COLUMN-DEF-ONLY | `email_campaign_products` (`schema/email-campaigns.ts:85`); `row.productNames` already resolved |
| `(Internal) Collections` | COLUMN-DEF-ONLY | `email_campaign_collections` (`:102`); `row.collectionNames` already resolved |

**Defect in the `Assignee` cell.** `assigneeName` is
`linked.assigneeNames.get(row.assigneeId) ?? null` (`packages/db/src/email-campaigns.ts:195-196`),
where the map is keyed on `users.clerk_user_id` (`:160`). Imported Airtable `singleCollaborator`
values are collaborator **name** strings, not Clerk ids, so every imported row misses the map and
the cell falls back to a dash — the stored name is dropped from the display. Themes handles the same
case correctly (module 4). This is a display bug, not a parity gap, and the table is empty today.

Extra column: `Updated`.

---

## 15 Email Flows Management — `/app/email-flows`

Columns: `apps/web/src/app/app/email-flows/email-flows-workspace.tsx:138-219`. Row type
`EmailFlowItem` (`email-flows/fields.ts:324-333`) over `EmailFlowListRow`
(`packages/db/src/email-flows.ts:44-50`). Table is **empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Flow name` **(frozen)** | `item.flow.flowName` | `email_flows.flow_name` |
| 2 | `Status` | `item.flow.status` | `email_flows.status` |
| 3 | `Type` | `item.flow.type` | `email_flows.type` |
| 4 | `Expected setup date` | `item.setupLabel` | `email_flows.expected_setup_date` |
| 5 | `Design due` | `item.designDueLabel` | **derived**, setup − 5 days |
| 6 | `Copywriting due` | `item.copywritingDueLabel` | **derived**, setup − 10 days |
| 7 | `Assignee` | `item.flow.assigneeName` | `email_flows.assignee_id`, looked up in `users` |
| 8 | `Klaviyo link` | `item.klaviyoHost` | `email_flows.klaviyo_link` |
| 9 | `Updated` | `item.updatedLabel` | `email_flows.updated_at` |

Pinned verdicts (13): **8 PRESENT, 5 MISSING — all COLUMN-DEF-ONLY.**

PRESENT (8): `Flow Name` · `Expected Setup Date` · `Status` ·
`Copywriting Due Date (formula)` (6, derived) · `Design Due Date (formula)` (5, derived) ·
`Klaviyo Link` (8) · `Type` (3) · `Assignee` (7).

| Missing field | Verdict | Column or junction |
| --- | --- | --- |
| `Flow Purpose` | COLUMN-DEF-ONLY | `email_flows.flow_purpose` (table empty) |
| `Copywriting` | COLUMN-DEF-ONLY | `email_flows.copywriting` (table empty) |
| `Design` | COLUMN-DEF-ONLY | `email_flows.design` (table empty) |
| `Inspo` | COLUMN-DEF-ONLY | `email_flows.inspo` (table empty) |
| `Campaigns & Offers` | COLUMN-DEF-ONLY | `email_flow_campaigns` (`schema/email-flows.ts:65`); `flow.campaignNames` already resolved |

The same `Assignee` null-collapse as module 14 applies here
(`packages/db/src/email-flows.ts:184`).

Extra column: `Updated`.

---

## 16 Campaigns & Offers — `/app/campaigns-offers`

`/app/campaigns` is a `permanentRedirect` here (`campaigns/page.tsx`).

Hand-built `<Table data-slot="campaigns-table">`,
`apps/web/src/app/app/campaigns-offers/campaigns-workspace.tsx:217-344`. Headers are literals at
`:220-230`; cells at `:295-337`. Over `campaigns_offers` (`packages/db/src/schema/campaigns.ts`).
Table is **empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` | `campaign.name` | `campaigns_offers.name` |
| 2 | `Holiday` | `campaign.holiday` | `campaigns_offers.holiday` |
| 3 | `Offer` | `campaign.discountOffer` | `campaigns_offers.discount_offer` |
| 4 | `Code` | `campaign.code` | `campaigns_offers.code` |
| 5 | `Official Date` | `campaign.officialDate` | `campaigns_offers.official_date` |
| 6 | `Ads Launch` | `campaign.adsLaunchDate` | `campaigns_offers.ads_launch_date` |
| 7 | `Ads End` | `campaign.adsEndDate` | `campaigns_offers.ads_end_date` |
| 8 | `Confirmed` | `campaign.confirmedByClient` | `campaigns_offers.confirmed_by_client` |
| 9 | `Launched` | `campaign.launched` | `campaigns_offers.launched` |
| 10 | `Product` | `productMap.get(campaign.productId)` | `products.name` via `campaigns_offers.product_id` |
| 11 | `Updated` | `updatedLabel` | `campaigns_offers.updated_at` |

No frozen column, no Fields control.

Pinned verdicts (16 listed): **9 PRESENT, 7 MISSING — all COLUMN-DEF-ONLY.**

PRESENT (9): `Name (formula)` (1) · `Holiday` (2) · `Official Date` (5) ·
`Interested` (8, header `Confirmed` — the importer maps `Interested` → `confirmedByClient`) ·
`Launched` (9) · `Ads Launch Date` (6) · `Ads End Date` (7) ·
`Discount Offer` (3, header `Offer`) · `Code` (4).

| Missing field | Verdict | Column or junction, and what the page already holds |
| --- | --- | --- |
| `Country` | COLUMN-DEF-ONLY | `campaigns_offers.country` (table empty) |
| `Description` | COLUMN-DEF-ONLY | `campaigns_offers.description` (table empty) |
| `Promotional Ideas` | COLUMN-DEF-ONLY | `campaigns_offers.promotional_ideas` (table empty) |
| `Collections` | COLUMN-DEF-ONLY | inverse of `collections.campaign_id`; the page already loads `collectionNames` and passes it to the panel (`campaigns-workspace.tsx:352`) |
| `COPY` | COLUMN-DEF-ONLY | `youtube_copy_campaigns`; page already loads `youtubeCopyLinks` (`:355`) |
| `Angles` | COLUMN-DEF-ONLY | `campaign_concepts` — the Airtable field is **named `Angles` but links the Concepts table** (importer note "The field is NAMED Angles but links the Gratsi CONCEPTS table"). The page already loads `conceptLinks` (`:357`) |
| `Email Campaigns` | COLUMN-DEF-ONLY | `email_campaign_campaigns`; page already loads `emailCampaignLinks` (`:353`) |

Extra columns: `Product` (the live base's `Product` on this table is a lookup, which the importer
skips as "multipleLookupValues, not a direct link"; the app's column reads its own
`campaigns_offers.product_id`), `Updated`.

---

## 17 Creative Reporting — `/app/creative-reporting`

Columns: `apps/web/src/app/app/creative-reporting/creative-reporting-workspace.tsx:80-186`. Row type
`CreativeReportItem` (`creative-reporting/fields.ts:271-285`) over `creative_reporting`. Table is
**empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name + Angle + Offer` **(frozen)** | `row.nameAngleOffer` | `creative_reporting.name_angle_offer` |
| 2 | `Creative` | `row.briefName` | `creative_briefs.name` via `creative_reporting.brief_id` |
| 3 | `CTR (%)` | `item.ctrLabel` | `creative_reporting.ctr` |
| 4 | `Thumb-stop rate` | `item.thumbStopLabel` | `creative_reporting.thumb_stop_rate` |
| 5 | `Results` | `item.resultsLabel` | `creative_reporting.results` |
| 6 | `CPA` | `item.cpaLabel` | `creative_reporting.cpa` |
| 7 | `Target CPA` | `item.targetCpaLabel` | `creative_reporting.target_cpa` |
| 8 | `Difference CPA` | `item.differenceCpa` | **computed**, `cpa − target_cpa` |
| 9 | `ROAS` | `item.roasLabel` | `creative_reporting.roas` |
| 10 | `Target ROAS` | `item.targetRoasLabel` | `creative_reporting.target_roas` |
| 11 | `Ad link` | `item.adLinkHost` | `creative_reporting.ad_link` |
| 12 | `Updated` | `item.updatedLabel` | `creative_reporting.updated_at` |

Pinned verdicts (13): **11 PRESENT, 2 MISSING — both COLUMN-DEF-ONLY.**

PRESENT (11): `Name + Angle + Offer` (1) · `Ad Link` (11) · `CTR` (3) · `Thumb-Stop Rate` (4) ·
`Results` (5) · `CPA` (6) · `Target CPA` (7) ·
`Difference CPA (formula)` (8, computed — matches the live formula `{CPA}-{Target CPA}`) ·
`ROAS` (9) · `Target ROAS` (10) · and `Creative Name (formula)` → column 2, `Creative`, **as an
equivalent rather than a copy**: the live Airtable formula is invalid (`"isValid": false`,
`"result": null`, pointing at a lookup whose `recordLinkFieldId` is `null`), no app column stores it,
and the app resolves the creative's name through `creative_reporting.brief_id` instead. I could not
establish any Gratsi field that feeds `brief_id` — the importer maps neither `Creative Name` nor
`Creative Name (from Creative)` to it, and the live table has no link field named `Creative`.

| Missing field | Verdict | Column |
| --- | --- | --- |
| `Notes` | COLUMN-DEF-ONLY | `creative_reporting.notes` (table empty) |
| `Ad Design` | COLUMN-DEF-ONLY | `creative_reporting.ad_design` (table empty) |

Extra column: `Updated`.

---

## 18 SM Campaign Management Feed — `/app/sm-campaign-feed`

Columns: `apps/web/src/app/app/sm-campaign-feed/sm-campaign-feed-workspace.tsx:79-140`. Row type
`SmTaskItem` (`sm-campaign-feed/fields.ts:186-192`) over `sm_campaign_feed_tasks`. Table is
**empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Task` **(frozen)** | `item.task.taskName` | `sm_campaign_feed_tasks.task_name` |
| 2 | `Platform` | `item.task.platform` | `sm_campaign_feed_tasks.platform` |
| 3 | `Due date` | `item.dueLabel` | `sm_campaign_feed_tasks.due_date` |
| 4 | `Status` | `item.task.status` | `sm_campaign_feed_tasks.status` |
| 5 | `Reminder` | `item.reminder` | **computed** by `reminderState(dueDate, status, now)` |
| 6 | `Notes` | `item.task.notes` | `sm_campaign_feed_tasks.notes` |
| 7 | `Updated` | `item.updatedLabel` | `sm_campaign_feed_tasks.updated_at` |

Pinned verdicts (6): **all PRESENT.** `Task Name` (1, header `Task`) · `Platform` (2) ·
`Due Date` (3, header `Due date`) · `Status` (4) · `Notes` (6) ·
`Reminder Trigger (formula)` (5, header `Reminder`, computed — the live formula is
`IF(IS_AFTER(NOW(), DATEADD({Due Date}, -12, 'hours')), "Yes", "No")`).

Extra column: `Updated`.

---

## 19 (Internal) Creative Dimensions — `/app/creative-dimensions`

Hand-built `<Table data-slot="creative-dimensions-table">`,
`apps/web/src/app/app/creative-dimensions/creative-dimensions-workspace.tsx:153-241`. Headers are
literals at `:156-159`; cells at `:219-235`. Over `creative_dimensions`. 22 live rows.

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` | `dimension.name` | `creative_dimensions.name` |
| 2 | `Dimensions` | `dimension.dimensions` | `creative_dimensions.dimensions` |
| 3 | `Link Description` | `dimension.linkDescription` | `creative_dimensions.link_description` |
| 4 | `Updated` | `updatedLabel` | `creative_dimensions.updated_at` |

No frozen column, no Fields control, no `ViewSwitcher` (no capability entry).

Pinned verdicts (4): **3 PRESENT, 1 MISSING.**
PRESENT: `Name` (1) · `Dimensions` (2) · `Link Description` (3).

| Missing field | Verdict | Column |
| --- | --- | --- |
| `(Internal) Creative Design` | **COLUMN-DEF-ONLY** | `creative_dimensions.creative_design_id` exists in the schema and the live database, but is **null on all 22 rows** — the importer skips the Airtable field (`drizzleColumn: null, handler: 'skip'`), so a column added today would render empty for every row |

Extra column: `Updated`.

---

## 20 Client Assets Organisation — `/app/client-assets`

Columns: `apps/web/src/app/app/client-assets/client-assets-workspace.tsx:80-139`. Over
`client_asset_folders`. Table is **empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Folder name` **(frozen)** | `folder.name` | `client_asset_folders.name` |
| 2 | `Description` | `folder.description` | `client_asset_folders.description` |
| 3 | `Location` | `locationHost` / `folder.locationUrl` | `client_asset_folders.location_url` |
| 4 | `Linked designs` | `item.designCount`, `folder.briefNames` | `creative_briefs.name` via `brief_asset_folders` |
| 5 | `Updated` | `updatedLabel` | `client_asset_folders.updated_at` |

Pinned verdicts (4): **all PRESENT.** `Name [Folder]` (1, header `Folder name`) ·
`Description` (2) · `Location` (3) ·
`(Internal) Creative Design` (4, header `Linked designs`, via `brief_asset_folders` — junction
empty).

Extra column: `Updated`.

---

## 21 Competitive research — `/app/competitive-research`

Hand-built `<Table data-slot="competitive-research-table">`,
`apps/web/src/app/app/competitive-research/competitive-research-workspace.tsx:167-266`. Headers come
from `COMPETITIVE_RESEARCH_COLUMNS` (`competitive-research/fields.ts:94-100`); cells at `:235-260`.
Over `competitive_research`. Table is **empty** (0 live rows).

| # | Header (verbatim) | Row property | Drizzle column |
| --- | --- | --- | --- |
| 1 | `Name` | `entry.name` | `competitive_research.name` |
| 2 | `Type` | `entry.type` | `competitive_research.type` |
| 3 | `Website` | `websiteHost` / `entry.website` | `competitive_research.website` |
| 4 | `Instagram` | `entry.instagram` | `competitive_research.instagram` |
| 5 | `Updated` | `updatedLabel` | `competitive_research.updated_at` |

No frozen column, no Fields control, no `ViewSwitcher` (no capability entry).

Pinned verdicts (7): **4 PRESENT, 3 MISSING — all COLUMN-DEF-ONLY.**
PRESENT: `Name` (1) · `Type` (2) · `Website` (3) · `Insta` (4, header `Instagram`).

| Missing field | Verdict | Column |
| --- | --- | --- |
| `FB Page` | COLUMN-DEF-ONLY | `competitive_research.facebook_page` (table empty) |
| `Meta Ads Library` | COLUMN-DEF-ONLY | `competitive_research.meta_ads_library` (table empty) |
| `Analysis` | COLUMN-DEF-ONLY | `competitive_research.analysis` (table empty) |

The `COMPETITIVE_RESEARCH_COLUMNS` key union is typed
`'name' | 'type' | 'website' | 'instagram' | 'updated'` (`fields.ts:90`), so adding the three
columns means widening that union as well as the array.

Extra column: `Updated`.

---

## Route directories under `apps/web/src/app/app/` with no pinned Gratsi table

Listed for completeness; none of the 21 pinned tables maps to these, so no PRESENT/MISSING verdict
applies. View facts are from `TABLE_VIEW_CAPABILITIES` where an entry exists.

| Directory | Route | What it renders | Views in the registry |
| --- | --- | --- | --- |
| ad-spy | `/app/ad-spy` | cards, `grid grid-cols-…` (`ad-spy-board.tsx:83`) | grid, kanban — **Kanban violation; no Gallery** |
| ai-characters | `/app/ai-characters` | hand-built `<Table>`, 4 columns `Name` `Status` `Basic Info` `Updated` (`ai-characters-workspace.tsx:157-164`); has a search box | no entry |
| assets | `/app/assets` | cards (`asset-grid.tsx:88`) | grid, kanban, gallery — **Kanban violation** |
| briefs | `/app/briefs` | `permanentRedirect` → `/app/creative-design` | n/a |
| campaigns | `/app/campaigns` | `permanentRedirect` → `/app/campaigns-offers` | n/a |
| copywriting | `/app/copywriting` | `permanentRedirect` → `/app/meta-copywriting` | n/a |
| creator-ranking | `/app/creator-ranking` | raw `<table>` leaderboard (`creator-leaderboard.tsx:40`) | grid — no Gallery |
| interface-config | `/app/interface-config` | config tree + preview, not a list | no entry |
| notifications | `/app/notifications` | hand-built `<Table>` over `NOTIFICATION_COLUMNS` (`notification-row.tsx:145-154`) | no entry |
| onboard | `/app/onboard` | wizard | no entry |
| onboarding-forms | `/app/onboarding-forms` | raw `<table>` (`onboarding-forms-table.tsx:38`) | grid, kanban — **Kanban violation; no Gallery** |
| performance | `/app/performance` | stat tiles + raw `<table>` (`performance-tracker.tsx:57, 102`) | grid — no Gallery |
| propagation | `/app/propagation` | two hand-built `<Table>`s (controls, promotion queue) | no entry |
| queue | `/app/queue/{client,internal}` | review queues | no entry |
| team | `/app/team` | hand-built `<Table>` over `TEAM_COLUMNS` (`team-table.tsx:27-33`) | no entry |
| upload-links | `/app/upload-links` | raw `<table>` (`upload-links-table.tsx:36`) | grid — no Gallery |

**Note on a sibling audit.** `docs/audits/displayed-columns-2026-10-02.md` (committed at `d5fd450`)
records angles as "4 columns, hand-built table" and concepts as 7 columns. At `22244ee` the source
has `ANGLE_COLUMNS` with 17 `GridColumn` entries feeding `AirtableGrid`
(`angles-workspace.tsx:134`, `:491`) and `CONCEPT_GRID_COLUMNS` with 21
(`concepts-workspace.tsx:120`, `:464`). Those two rows of that document no longer match the code.

---

## Build order

### A. Buildable now — COLUMN-DEF-ONLY (78 fields, no migration, no schema dependency)

Ordered by how much a change buys. Nothing in this section waits on Subagent A.

1. **Creative Design — 25 fields, 6 columns today against 31 pinned.** `/app/creative-design`. Every
   value already exists as a live column or junction, and most are already on the page in
   `BriefFormSnapshot` and `BriefItem`. The one piece of work beyond column definitions is the
   `Meta Copywriting` inverse (`copywriting.creative_brief_id` read back by brief id). This module
   also needs converting from the hand-built `<Table>` to `AirtableGrid` to get a frozen column and
   a Fields menu at all — which is the same change that makes 25 columns usable.
2. **Meta Copywriting — 11 fields.** `/app/meta-copywriting`. Nine of the eleven are already on
   `CopyItem`; only `Product` (`copywriting.product_id`) and the two junction columns need a source.
   Same `<Table>` → `AirtableGrid` conversion as above.
3. **Youtube Copywriting — 7 fields.** `/app/youtube-copywriting`. All seven are already resolved
   onto `YoutubeCopyItem`; this is seven column definitions and nothing else.
4. **Campaigns & Offers — 7 fields.** `/app/campaigns-offers`. Three plain columns plus four link
   columns whose data the page already loads for the panel. Also needs the `<Table>` → grid
   conversion.
5. **Email Campaigns — 6 fields** and **Email Flows — 5 fields.** Four plain columns each plus the
   junction columns whose names are already resolved on the row. Fix the `Assignee` null-collapse in
   the same pass (`packages/db/src/email-campaigns.ts:195-196`,
   `packages/db/src/email-flows.ts:184`) by adopting the Themes `assigneeValue` pattern.
6. **Creative Sheet — 4 fields.** `/app/creative-sheet`. Four column definitions.
7. **Concepts — 3 fields, one of which is a defect, not an omission.** `/app/concepts`.
   - **Fix first:** repoint the `Formats to create` column from `concepts.formats_to_create`
     (empty on 106/106) to `concepts.formats` (populated on 106/106), which is where Airtable `Type`
     is imported. One line in `concepts-workspace.tsx:199-205` plus `concepts/page.tsx:68`, and a
     header relabel to `Type`. Until this lands the page shows an always-empty column and hides real
     data.
   - `Campaigns & Offers`: one column over `campaign_concepts` (junction empty today).
   - `Production Status`: the column exists and holds data on 73/106 rows, but it was removed by
     recorded client direction (`docs/decisions.md:684-688`). **Take this one to the owner before
     building it** — the pinned spec and that decision contradict each other.
8. **Competitive research — 3 fields.** `/app/competitive-research`. Widen the
   `CompetitiveResearchColumn` key union (`fields.ts:90`) and add three cells.
9. **Angles — 2 fields.** `/app/angles`. `Concepts` (junction holds 115 rows — real data appears
   immediately) and `(Internal) Creative Modules` (junction empty). Both already loaded by
   `angles/page.tsx:80-81`.
10. **Collections — 2 fields**, **Creative Reporting — 2 fields**, **Creative Dimensions — 1 field.**
    Single columns each. For Collections' `(Internal) Creative Design`, confirm with the owner which
    of `creative_design_2_id` / `creative_design_note` the pinned entry means.

Columns that would render empty for every production row today, so they prove nothing until data
lands: everything on the eleven empty tables, plus `concepts.client_comments` (0/106),
`creative_dimensions.creative_design_id` (0/22), all five flagged `collections` columns (0/5), and
the `campaign_concepts`, `creative_module_angles`, `creative_module_designs`,
`copywriting_campaigns`, `copywriting_copy_types`, `creator_products`, `youtube_copy_*`,
`email_campaign_*`, `email_flow_campaigns` and `brief_asset_folders` junctions (all 0 rows).

### B. Blocked on schema — needs Subagent A's migration first (7 fields)

| Table | Gratsi field | What is missing |
| --- | --- | --- |
| Personas | `Passion` | a `passion` column on `personas`. The importer currently skips the field |
| Angles | `Creators` | any creator↔angle column or junction; none exists in `junction-tables.ts` |
| Concepts | `Performance` | a `performance` column on `concepts`. **The importer already maps this field to `performance`, a column that exists nowhere** — that mapping is broken today, not just unused |
| UGC Management | `Concepts` | a second creator↔concept junction beside `creator_concepts` |
| UGC Management | `Creator's cost (USD)` | a column, or a read-time formula wired into the row type. `packages/db/src/formulas/` arrived in `22244ee`; I could not establish that it is connected to the UGC row type |
| Meta Copywriting | `Angle` | an `angle` column on `copywriting` (Youtube Copywriting has one; Meta does not) |
| Meta Copywriting | `(Internal) Creative Design` | a second brief link beside `creative_brief_id` |

### C. Cross-cutting, independent of any field

1. **Grid default.** `/app/creative-design` opens on Kanban (`creative-design/page.tsx:70`). One
   argument change to `loadViewPreference('briefs', 'grid')`.
2. **Kanban beyond UGC and Creative Briefs.** Remove `'kanban'` from `supportedViews` for
   `concepts`, `personas`, `themes`, `angles`, `creative-sheet`, `sm-campaign-feed`,
   `email-campaigns`, `email-flows`, `youtube-copywriting`, `copywriting` — and, outside the pinned
   set, `assets`, `ad-spy`, `onboarding-forms`. Each of those pages also renders a Kanban branch and
   a group-by control that then become dead code.
3. **Gallery.** Missing on 13 of the 21 pinned tables. Three of them — `collections`,
   `creative-dimensions`, `competitive-research` — have **no capability entry at all**, so they need
   a `TABLE_VIEW_CAPABILITIES` entry before a view can be offered.
4. **Frozen column and Fields menu.** Six pinned pages have neither, because they render a hand-built
   `<Table>`: collections, competitive-research, creative-dimensions, creative-design,
   meta-copywriting, campaigns-offers. Converting them to `AirtableGrid` delivers both, and for
   creative-design and meta-copywriting it is a prerequisite for the 25 and 11 columns above being
   workable.
5. **Saved views vs per-browser hidden columns.** Nine pages use the uncontrolled grid, so their
   Fields choice lives in `localStorage` and is not a saved view. If the owner expects one Fields
   behaviour everywhere, these nine need `useTableView` + `ViewToolbar` like the six controlled
   pages.
