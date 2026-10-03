# Parent column set — Airtable template base `appnaSGAgOUbJ0f9m`

Subagent A, 2026-10-03. Read-only refresh of `docs/audits/parent-columns-2026-10-02.md`. No source
file, migration or database row was touched. Repo at `0ae92cb`, clean.

## What this document is

The **column definition** of the parent base, "Creative Hub Template" (`appnaSGAgOUbJ0f9m`): every
table, every field, in the order the Airtable Meta API returns them, each field classified and
paired with the Postgres column that would hold it.

It is the parent COLUMN DEFINITION only. It is **not** row data, and nothing in it describes Gratsi
content. No record endpoint was called; no row count was fetched.

## Method and provenance

- One call: `GET https://api.airtable.com/v0/meta/bases/appnaSGAgOUbJ0f9m/tables` — HTTP 200,
  51,259 bytes. Raw response kept outside the repo in this session's scratchpad as
  `A-parent-raw.json`.
- The response's only top-level key is `tables`. There is **no `offset`**, so all 15 tables are
  present and this is not a truncated page.
- **Field order is the order the API returned, preserved verbatim and unsorted in every table
  below.** That order is what `display_order` should be seeded from. The `Order` column in each
  table below is the API's index, 1-based.
- Field names, table names and types are quoted verbatim, including the trailing space in
  `Script & brief breakdown ` and the lower-case `v` difference noted in A9.
- Formula text is as the API exposed it, with every `fld…` id resolved to `{Field Name}`.
- Postgres pairings were read from `packages/db/src/schema/*.ts`; the Airtable→Drizzle evidence is
  `packages/db/src/scripts/import-mappings.ts` `TABLE_MAPPINGS[*]` and the row builders in
  `packages/db/src/airtable-import.ts`.
- I could **not** run a database read: `psql` is not on this machine's PATH. Nothing in this
  document depends on one — the parent base and the repo are the only sources it uses.

### Classification law as applied

| Class | Airtable types | Treatment |
| --- | --- | --- |
| STORED | `singleLineText`, `multilineText`, `richText`, `singleSelect`, `multipleSelects`, `checkbox`, `number`, `currency`, `date`, `url`, `multipleAttachments`, `singleCollaborator`, `autoNumber`, `createdTime`, `lastModifiedTime` | a plain value a column can hold |
| LINK | `multipleRecordLinks` | a record link; the target table is named |
| LOOKUP | `multipleLookupValues` | DERIVED — no stored column, no `column_definitions` data row |
| ROLLUP | `rollup`, `count` | DERIVED — **no field of either type exists in this base** |
| FORMULA | `formula` | DERIVED — formula text given |

`autoNumber`, `createdTime` and `lastModifiedTime` are Airtable-computed but hold a plain scalar, so
they are counted STORED and called out where it matters. **None of the four formulas in this base
uses `NOW()` or `TODAY()`**, so the parent contributes no wall-clock formula.

## Counts

**15 tables, 203 fields — 137 stored / 40 link / 22 lookup / 0 rollup / 4 formula.**

Every count in the 2026-10-02 audit's summary table is **confirmed**, table by table and field by
field. The 51,259-byte response is byte-identical in size to the one that audit recorded.

| Airtable table | id | Fields | S | L | K | R | F | Postgres |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Copywriting` | `tblZpBYPTcZcmQ1Kf` | 11 | 7 | 3 | 0 | 0 | 1 | `copywriting` |
| `Creative Sheet (Internal & Interface)` | `tblhU5yVNhVDwykUt` | 35 | 26 | 8 | 1 | 0 | 0 | `creative_briefs` |
| `Concepts` | `tblRlcp1ibmS7U7HG` | 22 | 9 | 4 | 8 | 0 | 1 | `concepts` |
| `Angles` | `tbl4UFSFcynlS2Pkn` | 11 | 5 | 5 | 1 | 0 | 0 | `angles` |
| `Themes` | `tblzS73a9JrJGiV2J` | 3 | 2 | 1 | 0 | 0 | 0 | `creative_modules` |
| `Personas` | `tblRXknfgKsROI961` | 15 | 14 | 1 | 0 | 0 | 0 | `personas` |
| `UGC Management` | `tblRsVqiqUaZRcQYd` | 32 | 30 | 2 | 0 | 0 | 0 | `creators` |
| `AI Characters / Personas` | `tblgfe8A7nmce6lzn` | 12 | 12 | 0 | 0 | 0 | 0 | `ai_characters` |
| `(Internal) Collections` | `tbl6LBNrRqa6Hh4I2` | 8 | 3 | 5 | 0 | 0 | 0 | `collections` |
| `(Internal) Product` | `tblfvfJMYNBz2OYYw` | 8 | 2 | 6 | 0 | 0 | 0 | `products` |
| `Campaigns & Offers` | `tblRNaWCVa1cCIwLL` | 14 | 10 | 3 | 0 | 0 | 1 | `campaigns_offers` |
| `(Internal) Creative Dimensions` | `tblli0Y76yJvG56zK` | 4 | 3 | 1 | 0 | 0 | 0 | `creative_dimensions` |
| `Competitive research` | `tbl9W6v78tKWznN9S` | 7 | 7 | 0 | 0 | 0 | 0 | `competitive_research` |
| `Client Assets Organisation` | `tbldFmPU6AWg62Fll` | 4 | 3 | 1 | 0 | 0 | 0 | `client_asset_folders` |
| `DONT USE Creative Sheet` | `tblGC0TxnHI7lKaNQ` | 17 | 4 | 0 | 12 | 0 | 1 | `creative_sheet_items` |

Airtable type totals: `multipleRecordLinks` 40, `multilineText` 40, `singleSelect` 29,
`singleLineText` 24, `multipleLookupValues` 22, `checkbox` 7, `multipleAttachments` 7, `richText` 6,
`date` 6, `url` 6, `formula` 4, `multipleSelects` 3, `currency` 3, `lastModifiedTime` 2,
`autoNumber` 1, `createdTime` 1, `singleCollaborator` 1, `number` 1. **All 203 fields fall into a
known type; none is unclassified.**

### What this means for `column_definitions`

- **137 STORED + 40 LINK = 177 fields are candidates for a `column_definitions` row.**
- The **26 DERIVED fields (22 lookup + 4 formula) get none.** They resolve through the link plus the
  read-time formula layer (`packages/db/src/formulas/`).
- Of those 26 DERIVED, **12 are already broken in the parent itself** (`isValid: false`, all in one
  table) — see A6. They should not seed anything at all, so the live derived set is 14.
- `column_definitions` does not exist yet. It appears in the repo only as a comment at
  `packages/db/src/schema/personas.ts:29`.

## Per-table column sets

Order is the Airtable Meta API's own field order, preserved verbatim — that is what `display_order`
seeds from. `no column` means nothing should hold the field and the Basis says why (a reverse link
stored on the other table, a DERIVED lookup or formula, an Airtable-internal counter).

### `Copywriting`

`tblZpBYPTcZcmQ1Kf` — **11 fields** (7 stored / 3 link / 0 lookup / 0 rollup / 1 formula) — Postgres `copywriting` (`packages/db/src/schema/copy.ts`)

Pairing basis: id + content. The mapping entry `copywriting` (import-mappings.ts:621) carries the GRATSI label `Meta Copywriting`, so a name lookup against this base finds nothing; the id matches.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Copy #` | `formula` | FORMULA — `" Copy " & {Autonumber} & " - " & {Creative}` | `copy_number` | mapping `copywriting` handler `text` |
| 2 | `Creative` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | `creative_brief_id` | mapping `copywriting` handler `singleLink` |
| 3 | `Status` | `singleSelect` | STORED | `status` | mapping `copywriting` handler `select` |
| 4 | `Collection` | `multipleRecordLinks` | LINK → `(Internal) Collections` | no column | reverse link; the stored side is `collections.copywriting_id` (collections.ts:31) |
| 5 | `Product` | `multipleRecordLinks` | LINK → `(Internal) Product` | no column | mapping `copywriting` handler `skip` |
| 6 | `Primary Copy` | `richText` | STORED | `primary_copy` | schema name match (copy.ts:69); no mapping entry |
| 7 | `Headline` | `multilineText` | STORED | `headline` | mapping `copywriting` handler `text` |
| 8 | `News Feed / Link Description` | `multilineText` | STORED | `link_description` | schema match on `link_description` (copy.ts:71); the mapping names Gratsi `News Feed`. Mine, not the mapping |
| 9 | `CTA` | `singleSelect` | STORED | `cta` | mapping `copywriting` handler `select` |
| 10 | `USED` | `checkbox` | STORED | `used` | mapping `copywriting` handler `checkbox` |
| 11 | `Autonumber` | `autoNumber` | STORED | no column | Airtable-internal counter; its value is consumed by the `Copy #` formula |

### `Creative Sheet (Internal & Interface)`

`tblhU5yVNhVDwykUt` — **35 fields** (26 stored / 8 link / 1 lookup / 0 rollup / 0 formula) — Postgres `creative_briefs` (`packages/db/src/schema/briefs.ts`)

Pairing basis: id + content. The mapping entry `creativeBriefs` (import-mappings.ts:492) carries the GRATSI label `Creative Design (Internal & Interface)`; the id matches.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping `creativeBriefs` handler `text` |
| 2 | `Concept` | `multipleRecordLinks` | LINK → `Concepts` | `concept_id` | mapping `creativeBriefs` handler `singleLink` |
| 3 | `Source` | `singleSelect` | STORED | `source` | mapping `creativeBriefs` handler `select` |
| 4 | `Funnel` | `singleSelect` | STORED | `funnel` | mapping `creativeBriefs` handler `select` |
| 5 | `Type` | `singleSelect` | STORED | `type` | mapping `creativeBriefs` handler `select` |
| 6 | `Batch (from Concepts)` | `multipleLookupValues` | LOOKUP via `Concept`→`Batch` | (batch) — but DERIVED | LOOKUP through `Concept`→`Batch`. `creative_briefs.batch` exists (briefs.ts:90) and the mapping fills it from a Gratsi field NAMED `Batch`. Under the classification law a lookup gets no stored column: resolve through `concept_id`. See A8 |
| 7 | `Angle` | `multipleRecordLinks` | LINK → `Angles` | `angle_id` | mapping `creativeBriefs` handler `singleLink` |
| 8 | `Performance` | `singleSelect` | STORED | `performance` | mapping `creativeBriefs` handler `select` |
| 9 | `Priority` | `singleSelect` | STORED | `priority` | mapping `creativeBriefs` handler `select` |
| 10 | `Client Status` | `singleSelect` | STORED | `client_status` | mapping `creativeBriefs` handler `select` |
| 11 | `Internal Status` | `singleSelect` | STORED | `internal_status` | mapping `creativeBriefs` handler `select` |
| 12 | `Elements we are Testing` | `richText` | STORED | `elements_tested` | mapping `creativeBriefs` handler `richText` |
| 13 | `QA Checklist Doc` | `multipleAttachments` | STORED | `qa_checklist_doc` | mapping `creativeBriefs` handler `attachment` |
| 14 | `Video Editor QA` | `checkbox` | STORED | `qa_video_editor` | mapping `creativeBriefs` handler `checkbox` |
| 15 | `Graphic Designer QA` | `checkbox` | STORED | `qa_designer` | mapping `creativeBriefs` handler `checkbox` |
| 16 | `Creative Strategist QA` | `checkbox` | STORED | `qa_strategist` | mapping `creativeBriefs` handler `checkbox` |
| 17 | `Design File` | `multipleAttachments` | STORED | `design_file` | mapping `creativeBriefs` handler `attachment` |
| 18 | `Design Link URL` | `singleLineText` | STORED | `design_file_url` | mapping `creativeBriefs` handler `text` |
| 19 | `Inspiration` | `richText` | STORED | `inspiration_image` | mapping `creativeBriefs` handler `attachment` |
| 20 | `Inspiration Image` | `multipleAttachments` | STORED | `inspiration_image` | schema name match (briefs.ts:115, jsonb). No mapping entry — see A5 |
| 21 | `Brief` | `richText` | STORED | `brief_to_design` | mapping names Gratsi `Brief to Design/Editing`→`briefToDesign` (briefs.ts:100). Pairing is mine |
| 22 | `Ad Content` | `richText` | STORED | `ad_content` | schema name match (briefs.ts:113). The mapping names Gratsi `Script / Ad Content` |
| 23 | `(Internal) Product` | `multipleRecordLinks` | LINK → `(Internal) Product` | `product_id` | mapping `creativeBriefs` handler `singleLink` |
| 24 | `Collection` | `multipleRecordLinks` | LINK → `(Internal) Collections` | `collection_id` | schema has `collection_id` (briefs.ts:86). The mapping names Gratsi `(Internal) Collections 3` |
| 25 | `Campaigns & Offers` | `multipleRecordLinks` | LINK → `Campaigns & Offers` | `campaign_offer_id` | schema has `campaign_offer_id` (briefs.ts:87); listed as sourceless for Gratsi — see A7 |
| 26 | `Platform` | `multipleSelects` | STORED | `platform` | mapping `creativeBriefs` handler `multiSelect` |
| 27 | `Dimensions` | `multipleRecordLinks` | LINK → `(Internal) Creative Dimensions` | `dimensions` | mapping `creativeBriefs` handler `multiLink` |
| 28 | `Assets` | `multipleRecordLinks` | LINK → `Client Assets Organisation` | `asset_id` | schema has `asset_id` (briefs.ts:88); listed as sourceless for Gratsi — see A7 |
| 29 | `Created` | `createdTime` | STORED | no column | mapping `creativeBriefs` handler `skip` |
| 30 | `Click for AI Spell Checker Again` | `checkbox` | STORED | `click_for_ai_spell_checker` | mapping `creativeBriefs` handler `checkbox` |
| 31 | `Spelling Feedback` | `multilineText` | STORED | `spelling_feedback` | mapping `creativeBriefs` handler `text` |
| 32 | `Assignee` | `singleCollaborator` | STORED | `assignee` | mapping `creativeBriefs` handler `collaborator` |
| 33 | `Last Modified` | `lastModifiedTime` | STORED | no column | mapping `creativeBriefs` handler `skip` |
| 34 | `Meta Copywriting` | `multipleRecordLinks` | LINK → `Copywriting` | no column | mapping `creativeBriefs` handler `skip` |
| 35 | `Script & brief breakdown ` | `multipleAttachments` | STORED | `script_and_brief_breakdown` | mapping `creativeBriefs` handler `attachment` |

### `Concepts`

`tblRlcp1ibmS7U7HG` — **22 fields** (9 stored / 4 link / 8 lookup / 0 rollup / 1 formula) — Postgres `concepts` (`packages/db/src/schema/concepts.ts`)

Pairing basis: CONTENT + NAME. By id this table pairs with `angles` — see A1.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `formula` | FORMULA — `{Batch} & "-" & {Angles} & "-" & {Themes}` | `name` | mapping `concepts` handler `text` |
| 2 | `Batch` | `singleSelect` | STORED | `batch` | mapping `concepts` handler `select` |
| 3 | `Themes` | `multipleRecordLinks` | LINK → `Themes` | junction — CANNOT ESTABLISH | LINK → the table LABELLED `Themes`, which is creative-modules shaped (A2). Drizzle has `concept_themes` (concepts↔themes), `creative_module_angles` and `creative_module_designs`, but NO concept↔creative_modules junction. I could not establish this target |
| 4 | `Angles` | `multipleRecordLinks` | LINK → `Angles` | junction `concept_angles` | LINK → `Angles`. `prefersSingleRecordLink: true` |
| 5 | `Type (from Angles)` | `multipleLookupValues` | LOOKUP via `Angles`→`Type` | no column | LOOKUP via `Angles`→`Type`; DERIVED |
| 6 | `Category` | `singleSelect` | STORED | `category` | mapping `concepts` handler `select` |
| 7 | `Concept Style` | `singleSelect` | STORED | `concept_style` | schema name match (concepts.ts:53). The mapping names Gratsi `Style` |
| 8 | `Approval Status` | `singleSelect` | STORED | `approval_status` | schema name match (concepts.ts:64). The mapping names Gratsi `Status` |
| 9 | `Description` | `multipleLookupValues` | LOOKUP via `Angles`→`Description` | no column | LOOKUP via `Angles`→`Description`; DERIVED. `concepts.description` exists (concepts.ts:60) and the mapping fills it from a Gratsi field, but in the PARENT this is a lookup |
| 10 | `Performance` | `multipleLookupValues` | LOOKUP via `Creative Sheet (Internal & Interface)`→`Performance` | (none — mapping names `performance`) | mapping `concepts` handler `select` — **no such column in the schema** |
| 11 | `Creators` | `multipleLookupValues` | LOOKUP via `Creator`→`Creator name (Filled by UGC Manager)` | no column | LOOKUP via `Creator`→`Creator name (Filled by UGC Manager)`; DERIVED |
| 12 | `Hook examples` | `multilineText` | STORED | `hook_examples` | schema name match (concepts.ts:56). The mapping names Gratsi `Hooks` |
| 13 | `Script idea` | `multilineText` | STORED | `script_idea` | schema name match (concepts.ts:57). The mapping names Gratsi `Script` |
| 14 | `Pain Points (from Angles)` | `multipleLookupValues` | LOOKUP via `Angles`→`Pain Points` | no column | LOOKUP via `Angles`→`Pain Points`; DERIVED. `concepts.pain_points` exists but must not hold a lookup |
| 15 | `USP (from Angles)` | `multipleLookupValues` | LOOKUP via `Angles`→`USP` | no column | LOOKUP via `Angles`→`USP`; DERIVED. `concepts.usp` exists but must not hold a lookup |
| 16 | `Product (from Angles)` | `multipleLookupValues` | LOOKUP via `Angles`→`Product` | no column | LOOKUP via `Angles`→`Product`; DERIVED |
| 17 | `Personas (from Angles)` | `multipleLookupValues` | LOOKUP via `Angles`→`Personas` | no column | LOOKUP via `Angles`→`Personas`; DERIVED |
| 18 | `Formats to create` | `multipleSelects` | STORED | `formats_to_create` | schema name match (concepts.ts:65); listed as sourceless for Gratsi — see A7 |
| 19 | `Production Status` | `singleSelect` | STORED | `production_status` | mapping `concepts` handler `select` |
| 20 | `Ad Inspo` | `multilineText` | STORED | `ad_inspo_links` | schema `ad_inspo_links` jsonb (concepts.ts:55); listed as sourceless for Gratsi — see A7 |
| 21 | `Creator` | `multipleRecordLinks` | LINK → `UGC Management` | junction `creator_concepts` | LINK → `UGC Management` |
| 22 | `Creative Sheet (Internal & Interface)` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | no column | reverse link; the stored side is `creative_briefs.concept_id` |

### `Angles`

`tbl4UFSFcynlS2Pkn` — **11 fields** (5 stored / 5 link / 1 lookup / 0 rollup / 0 formula) — Postgres `angles` (`packages/db/src/schema/angles.ts`)

Pairing basis: CONTENT + NAME. By id this table pairs with `concepts` — see A1.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping `angles` handler `text` |
| 2 | `Type` | `multipleSelects` | STORED | `type` | schema name match (angles.ts); listed as sourceless for Gratsi — see A7 |
| 3 | `Product` | `multipleRecordLinks` | LINK → `(Internal) Product` | junction `angle_products` | LINK → `(Internal) Product` |
| 4 | `Collection` | `multipleRecordLinks` | LINK → `(Internal) Collections` | no column | LINK → `(Internal) Collections`; the stored side is `collections.angle_id` (collections.ts:28) |
| 5 | `Personas` | `multipleRecordLinks` | LINK → `Personas` | junction `angle_personas` | LINK → `Personas` |
| 6 | `Description` | `multilineText` | STORED | `description` | mapping `angles` handler `text` |
| 7 | `Pain Points` | `multilineText` | STORED | `pain_points` | schema name match; listed as sourceless for Gratsi — see A7 |
| 8 | `USP` | `multilineText` | STORED | `usp` | schema name match; listed as sourceless for Gratsi — see A7 |
| 9 | `Concepts` | `multipleRecordLinks` | LINK → `Concepts` | no column | mapping `angles` handler `skip` |
| 10 | `Performance (from Concepts)` | `multipleLookupValues` | LOOKUP via `Concepts`→`Performance` | no column | LOOKUP via `Concepts`→`Performance`, and that field is ITSELF a lookup, so this is a two-hop chain ending at `Creative Sheet`.`Performance`. DERIVED |
| 11 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | no column | mapping `angles` handler `skip` |

### `Themes`

`tblzS73a9JrJGiV2J` — **3 fields** (2 stored / 1 link / 0 lookup / 0 rollup / 0 formula) — Postgres `creative_modules` (`packages/db/src/schema/creative-modules.ts`)

Pairing basis: CONTENT + ID. By NAME this table pairs with `themes` — which is how the importer resolves. See A2.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Module Name` | `singleLineText` | STORED | `module_name` | mapping `creativeModules` handler `text` |
| 2 | `Reference Link` | `singleLineText` | STORED | no column | singleLineText. The `creativeModules` mapping expects `Foreplay Link`, which this table does not have; `creative_modules.foreplay_link` is the only candidate and I did not assert it. See A2 |
| 3 | `Concepts` | `multipleRecordLinks` | LINK → `Concepts` | junction `creativeModuleAngles` | mapping `creativeModules` handler `multiLink` |

### `Personas`

`tblRXknfgKsROI961` — **15 fields** (14 stored / 1 link / 0 lookup / 0 rollup / 0 formula) — Postgres `personas` (`packages/db/src/schema/personas.ts`)

Pairing basis: NAME + content. The mapping holds the Gratsi id `tblyt7X4VjHxtMDVS`, not this one.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Persona Name` | `multilineText` | STORED | `name` | primary field → `personas.name` NOT NULL (personas.ts:23). The mapping names Gratsi `Name` |
| 2 | `A Day in the Life` | `multilineText` | STORED | `day_in_the_life` | schema name match (personas.ts:31); sourceless for Gratsi — A7 |
| 3 | `Demographic` | `multilineText` | STORED | `demographic` | schema name match (personas.ts:32). The mapping names Gratsi `Description  [Age Status Salary]` |
| 4 | `Psychographic` | `multilineText` | STORED | `psychographic` | schema name match (personas.ts:33). The mapping names Gratsi `Personality` |
| 5 | `Core Desires (Cashvertising)` | `multilineText` | STORED | `core_desires` | schema name match (personas.ts:34). The mapping names Gratsi `Drivers for this persona` — the field the `Passion` bug displaced |
| 6 | `Emotional Triggers (Cashvertising)` | `multilineText` | STORED | `emotional_triggers` | schema name match (personas.ts:40) |
| 7 | `Pain Points (Cashvertising)` | `multilineText` | STORED | `pain_points` | schema name match; sourceless for Gratsi — A7 |
| 8 | `Success Factors (Buyer Personas)` | `multilineText` | STORED | `success_factors` | schema name match; sourceless for Gratsi — A7 |
| 9 | `Perceived Barriers (Buyer Personas)` | `multilineText` | STORED | `perceived_barriers` | schema name match; sourceless for Gratsi — A7 |
| 10 | `Stage of Market Awareness (Breakthrough Advertising)` | `singleSelect` | STORED | `stage_of_awareness` | `awareness_stage` pg enum (personas.ts:44). The mapping names Gratsi `Problem-Solution Awareness Level` |
| 11 | `Buying Triggers (Breakthrough Advertising)` | `multilineText` | STORED | `buying_triggers` | schema name match; sourceless for Gratsi — A7 |
| 12 | `Problem/Challenge (StoryBrand)` | `multilineText` | STORED | `problem_challenge` | schema name match; sourceless for Gratsi — A7 |
| 13 | `Success/Transformation (StoryBrand)` | `multilineText` | STORED | `success_transformation` | schema name match; sourceless for Gratsi — A7 |
| 14 | `Trigger Words (Mindstates)` | `multilineText` | STORED | `trigger_words` | schema name match; sourceless for Gratsi — A7 |
| 15 | `Angles` | `multipleRecordLinks` | LINK → `Angles` | no column | mapping `personas` handler `skip` |

### `UGC Management`

`tblRsVqiqUaZRcQYd` — **32 fields** (30 stored / 2 link / 0 lookup / 0 rollup / 0 formula) — Postgres `creators` (`packages/db/src/schema/creators.ts`)

Pairing basis: name + id.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Creator name (Filled by UGC Manager)` | `singleLineText` | STORED | `name` | mapping `creators` handler `text` |
| 2 | `(Internal) Deadline for the request` | `date` | STORED | `deadline` | schema `deadline` timestamptz (creators.ts:105); no mapping entry |
| 3 | `Date of Management` | `date` | STORED | `date_of_management` | mapping `creators` handler `date` |
| 4 | `Age` | `singleSelect` | STORED | `age_bracket` | mapping `creators` handler `select` |
| 5 | `Gender` | `singleSelect` | STORED | `gender` | mapping `creators` handler `select` |
| 6 | `Ethnicity` | `singleLineText` | STORED | `ethnicity` | mapping `creators` handler `text` |
| 7 | `Internal Brief` | `multilineText` | STORED | `internal_brief` | schema name match (creators.ts:101); no mapping entry |
| 8 | `Concepts to film` | `multipleRecordLinks` | LINK → `Concepts` | `concept_ids` | jsonb `concept_ids` (creators.ts:110); the mapping names Gratsi `Concept to film`. Sourceless for Gratsi — A7 |
| 9 | `Products` | `multipleRecordLinks` | LINK → `(Internal) Product` | junction `creatorProducts` | mapping `creators` handler `multiLink` |
| 10 | `Budget per 60sec video` | `currency` | STORED | `budget_per_60s` | mapping `creators` handler `currency` |
| 11 | `For Partnership Ads?` | `singleSelect` | STORED | `for_partnership_ads` | schema name match (creators.ts:125); sourceless for Gratsi — A7 |
| 12 | `Internal Creator's Status` | `singleSelect` | STORED | `internal_creator_status` | schema name match (creators.ts:114). The mapping names Gratsi `Creator Status` |
| 13 | `Status` | `singleSelect` | STORED | `internal_creator_status` | mapping `creators` handler `select` |
| 14 | `Internal Assets Status` | `singleSelect` | STORED | `internal_assets_status` | schema name match (creators.ts:118); sourceless for Gratsi — A7 |
| 15 | `Creator's Video Intro` | `multipleAttachments` | STORED | `video_intro_url` | schema `video_intro_url` (creators.ts:98). The mapping key differs only in CASE — `Creator's video Intro` — see A9 |
| 16 | `Creator's Profile Pic` | `multipleAttachments` | STORED | `profile_pic_url` | mapping `creators` handler `attachment` |
| 17 | `Platform` | `singleSelect` | STORED | `platform` | mapping `creators` handler `select` |
| 18 | `(Client's) Note or Comments` | `multilineText` | STORED | `client_note` | mapping `creators` handler `text` |
| 19 | `Creator's cost (USD)` | `currency` | STORED | no column | mapping `creators` handler `skip` |
| 20 | `Raw assets` | `url` | STORED | `raw_assets_url` | mapping `creators` handler `text` |
| 21 | `Shipping Location` | `multilineText` | STORED | `shipping_location` | mapping `creators` handler `text` |
| 22 | `Tracking Number ` | `singleLineText` | STORED | `tracking_number` | mapping `creators` handler `text` |
| 23 | `Partnership Activity` | `singleSelect` | STORED | `partnership_activity` | mapping `creators` handler `select` |
| 24 | `Creator Link` | `url` | STORED | `creator_link` | mapping `creators` handler `text` |
| 25 | `Instagram Username` | `singleLineText` | STORED | `instagram_username` | mapping `creators` handler `text` |
| 26 | `Date of Partnership Activation` | `date` | STORED | `partnership_activated_at` | mapping `creators` handler `date` |
| 27 | `Partnership Time Period (days)` | `number` | STORED | `partnership_period_days` | mapping `creators` handler `number` |
| 28 | `Continue Working With?` | `singleSelect` | STORED | `continue_working_with` | mapping `creators` handler `select` |
| 29 | `Extension Time Period` | `singleSelect` | STORED | `extension_days` | mapping `creators` handler `select` |
| 30 | `Partnership Price per 30 days` | `currency` | STORED | `partnership_price_per_30_days` | mapping `creators` handler `currency` |
| 31 | `Notes for Partnership ads` | `multilineText` | STORED | `partnership_notes` | mapping `creators` handler `text` |
| 32 | `Facebook Profile for Partnership` | `richText` | STORED | `facebook_profile_url` | mapping `creators` handler `richText` |

### `AI Characters / Personas`

`tblgfe8A7nmce6lzn` — **12 fields** (12 stored / 0 link / 0 lookup / 0 rollup / 0 formula) — Postgres `ai_characters` (`packages/db/src/schema/ai-characters.ts`)

Pairing basis: CONTENT ONLY. Absent from TABLE_MAPPINGS by name and by id, and from the importer entirely — see A3.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | schema `name` NOT NULL (ai-characters.ts:24). Enumerated 1st in the schema docstring (ai-characters.ts:9-12) — A3 |
| 2 | `Attachments` | `multipleAttachments` | STORED | `attachments` | schema `attachments` text (ai-characters.ts:25); docstring says "stored as JSON URLs" — A3 |
| 3 | `Status` | `singleSelect` | STORED | `status` | schema `status` (ai-characters.ts:26) — A3 |
| 4 | `Basic Info` | `multilineText` | STORED | `basic_info` | schema `basic_info` (ai-characters.ts:27) — A3 |
| 5 | `Tone of Voice` | `multilineText` | STORED | `tone_of_voice` | schema `tone_of_voice` (ai-characters.ts:28) — A3 |
| 6 | `Voice Link (Eleven Labs)` | `url` | STORED | `voice_link` | schema `voice_link` (ai-characters.ts:29) — A3 |
| 7 | `Personality Traits` | `multilineText` | STORED | `personality_traits` | schema `personality_traits` (ai-characters.ts:30) — A3 |
| 8 | `Appearance` | `multilineText` | STORED | `appearance` | schema `appearance` (ai-characters.ts:31) — A3 |
| 9 | `Traits & Habits` | `multilineText` | STORED | `traits_and_habits` | schema `traits_and_habits` (ai-characters.ts:32) — A3 |
| 10 | `Hobbies & Lifestyle` | `multilineText` | STORED | `hobbies_and_lifestyle` | schema `hobbies_and_lifestyle` (ai-characters.ts:33) — A3 |
| 11 | `Work & Background` | `multilineText` | STORED | `work_and_background` | schema `work_and_background` (ai-characters.ts:34) — A3 |
| 12 | `Why He Promotes this brand?` | `multilineText` | STORED | `why_promotes_brand` | schema `why_promotes_brand` (ai-characters.ts:35) — A3 |

### `(Internal) Collections`

`tbl6LBNrRqa6Hh4I2` — **8 fields** (3 stored / 5 link / 0 lookup / 0 rollup / 0 formula) — Postgres `collections` (`packages/db/src/schema/collections.ts`)

Pairing basis: name + id.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Collection Name` | `singleLineText` | STORED | `name` | primary field → `collections.name` NOT NULL (collections.ts:25). The mapping names Gratsi `Main Collection` |
| 2 | `URL` | `url` | STORED | `url` | mapping `collections` handler `text` |
| 3 | `Campaigns & Offers` | `multipleRecordLinks` | LINK → `Campaigns & Offers` | `campaign_id` | mapping `collections` handler `singleLink` |
| 4 | `Angles` | `multipleRecordLinks` | LINK → `Angles` | junction `conceptCollections` | mapping `collections` handler `skip` |
| 5 | `(Internal) Product` | `multipleRecordLinks` | LINK → `(Internal) Product` | no column | mapping `collections` handler `skip` |
| 6 | `(Internal) Creative Design` | `singleLineText` | STORED | no column | mapping `collections` handler `skip` |
| 7 | `Ads Copywriting copy` | `multipleRecordLinks` | LINK → `Copywriting` | `copywriting_id` | mapping `collections` handler `singleLink` |
| 8 | `(Internal) Creative Design 2` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | `creative_design_note` | mapping `collections` handler `text` |

### `(Internal) Product`

`tblfvfJMYNBz2OYYw` — **8 fields** (2 stored / 6 link / 0 lookup / 0 rollup / 0 formula) — Postgres `products` (`packages/db/src/schema/products.ts`)

Pairing basis: name + id.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Product Name / Landing Page Name` | `multilineText` | STORED | `name` | mapping `products` handler `text` |
| 2 | `Link` | `url` | STORED | `link` | mapping `products` handler `text` |
| 3 | `(Internal) Collections` | `multipleRecordLinks` | LINK → `(Internal) Collections` | no column | reverse link; the stored side is `collections.product_id` (collections.ts:29) |
| 4 | `Campaigns & Offers` | `multipleRecordLinks` | LINK → `Campaigns & Offers` | no column | reverse link; the stored side is `campaigns_offers.product_id` (campaigns.ts:48) — A7 |
| 5 | `Angles` | `multipleRecordLinks` | LINK → `Angles` | no column | mapping `products` handler `skip` |
| 6 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | no column | mapping `products` handler `skip` |
| 7 | `Meta Copywriting` | `multipleRecordLinks` | LINK → `Copywriting` | no column | reverse link; the stored side is `copywriting.product_id` (copy.ts:67) — A7 |
| 8 | `UGC Management` | `multipleRecordLinks` | LINK → `UGC Management` | no column | mapping `products` handler `skip` |

### `Campaigns & Offers`

`tblRNaWCVa1cCIwLL` — **14 fields** (10 stored / 3 link / 0 lookup / 0 rollup / 1 formula) — Postgres `campaigns_offers` (`packages/db/src/schema/campaigns.ts`)

Pairing basis: name + id.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `formula` | FORMULA — `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})` | `name` | mapping `campaignsOffers` handler `formula` |
| 2 | `Holiday` | `singleLineText` | STORED | `holiday` | mapping `campaignsOffers` handler `text` |
| 3 | `Official Date` | `date` | STORED | `official_date` | mapping `campaignsOffers` handler `date` |
| 4 | `Country` | `singleLineText` | STORED | `country` | mapping `campaignsOffers` handler `text` |
| 5 | `Description` | `multilineText` | STORED | `description` | mapping `campaignsOffers` handler `text` |
| 6 | `Confirmed by Client` | `checkbox` | STORED | `confirmed_by_client` | schema name match (campaigns.ts:44) |
| 7 | `Launched` | `checkbox` | STORED | `launched` | mapping `campaignsOffers` handler `checkbox` |
| 8 | `Ads Launch Date` | `date` | STORED | `ads_launch_date` | mapping `campaignsOffers` handler `date` |
| 9 | `Ads End Date` | `date` | STORED | `ads_end_date` | mapping `campaignsOffers` handler `date` |
| 10 | `Discount Offer` | `singleLineText` | STORED | `discount_offer` | mapping `campaignsOffers` handler `text` |
| 11 | `Code` | `singleLineText` | STORED | `code` | mapping `campaignsOffers` handler `text` |
| 12 | `Collections` | `multipleRecordLinks` | LINK → `(Internal) Collections` | no column | mapping `campaignsOffers` handler `skip` |
| 13 | `(Internal) Product` | `multipleRecordLinks` | LINK → `(Internal) Product` | `product_id` | schema has `product_id` (campaigns.ts:48); sourceless for Gratsi — A7 |
| 14 | `Design attached` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | no column | mapping `campaignsOffers` handler `skip` |

### `(Internal) Creative Dimensions`

`tblli0Y76yJvG56zK` — **4 fields** (3 stored / 1 link / 0 lookup / 0 rollup / 0 formula) — Postgres `creative_dimensions` (`packages/db/src/schema/creative-dimensions.ts`)

Pairing basis: name + id; all 4 field names agree.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping `creativeDimensions` handler `text` |
| 2 | `Dimensions` | `singleLineText` | STORED | `dimensions` | mapping `creativeDimensions` handler `text` |
| 3 | `Link Description` | `singleSelect` | STORED | `link_description` | mapping `creativeDimensions` handler `select` |
| 4 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | no column | mapping `creativeDimensions` handler `skip` |

### `Competitive research`

`tbl9W6v78tKWznN9S` — **7 fields** (7 stored / 0 link / 0 lookup / 0 rollup / 0 formula) — Postgres `competitive_research` (`packages/db/src/schema/competitive-research.ts`)

Pairing basis: name + id; all 7 field names agree.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping `competitiveResearch` handler `text` |
| 2 | `Type` | `singleSelect` | STORED | `type` | mapping `competitiveResearch` handler `select` |
| 3 | `Website` | `singleLineText` | STORED | `website` | mapping `competitiveResearch` handler `text` |
| 4 | `Insta` | `singleLineText` | STORED | `instagram` | mapping `competitiveResearch` handler `text` |
| 5 | `FB Page` | `singleLineText` | STORED | `facebook_page` | mapping `competitiveResearch` handler `text` |
| 6 | `Meta Ads Library` | `multilineText` | STORED | `meta_ads_library` | mapping `competitiveResearch` handler `text` |
| 7 | `Analysis` | `multilineText` | STORED | `analysis` | mapping `competitiveResearch` handler `text` |

### `Client Assets Organisation`

`tbldFmPU6AWg62Fll` — **4 fields** (3 stored / 1 link / 0 lookup / 0 rollup / 0 formula) — Postgres `client_asset_folders` (`packages/db/src/schema/client-asset-folders.ts`)

Pairing basis: name + id; all 4 field names agree.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name [Folder]` | `singleLineText` | STORED | `name` | mapping `clientAssetFolders` handler `text` |
| 2 | `Description` | `multilineText` | STORED | `description` | mapping `clientAssetFolders` handler `text` |
| 3 | `Location` | `url` | STORED | `location_url` | mapping `clientAssetFolders` handler `text` |
| 4 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK → `Creative Sheet (Internal & Interface)` | no column | mapping `clientAssetFolders` handler `skip` |

### `DONT USE Creative Sheet`

`tblGC0TxnHI7lKaNQ` — **17 fields** (4 stored / 0 link / 12 lookup / 0 rollup / 1 formula) — Postgres `creative_sheet_items` (`packages/db/src/schema/creative-sheet-items.ts`)

Pairing basis: ID ONLY. The mapping entry carries the GRATSI label `Creative Sheet`. See A4.

| Order | Field | Airtable type | Classification | Target Postgres column | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name + Angle + Offer` | `formula` | FORMULA — `CONCATENATE({Creative Name})` | no column | FORMULA, DERIVED. `creative_sheet_items` has no name column; the mapping entry is keyed `Name` (import-mappings.ts:979) and so does not match this field name |
| 2 | `Creative Name` | `singleLineText` | STORED | brief_id — CONTESTED | the mapping reads this as a `singleLink` → `brief_id`, but in the PARENT it is a `singleLineText`, not a link. See A6 |
| 3 | `Performance (from Creative Name)` | `multipleLookupValues` | LOOKUP via `(none)`→`Performance` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 4 | `(Internal) Product (from Creative Name)` | `multipleLookupValues` | LOOKUP via `(none)`→`(Internal) Product` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 5 | `Angle (from Creative Name)` | `multipleLookupValues` | LOOKUP via `(none)`→`Angle` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 6 | `Concepts (from Angle) (from Creative Name)` | `multipleLookupValues` | LOOKUP via `(none)`→`Concept` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 7 | `Elements we are Testing` | `multipleLookupValues` | LOOKUP via `(none)`→`Elements we are Testing` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 8 | `Design File` | `multipleLookupValues` | LOOKUP via `(none)`→`Design File` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 9 | `Status` | `singleSelect` | STORED | `status` | mapping `creativeSheetItems` handler `select` |
| 10 | `Client's Comments` | `multilineText` | STORED | `client_comments` | mapping `creativeSheetItems` handler `text` |
| 11 | `Design Link URL` | `multipleLookupValues` | LOOKUP via `(none)`→`Design Link URL` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 12 | `Collection` | `multipleLookupValues` | LOOKUP via `(none)`→`Collection` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 13 | `Platform` | `multipleLookupValues` | LOOKUP via `(none)`→`Platform` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 14 | `Funnel` | `multipleLookupValues` | LOOKUP via `(none)`→`Funnel` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 15 | `Type` | `multipleLookupValues` | LOOKUP via `(none)`→`Type` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 16 | `Creative Module` | `multipleLookupValues` | LOOKUP via `Creative Name`→`(none)` **[isValid:false]** | no column | DERIVED, and BROKEN in Airtable: isValid:false with no resolvable link field. Seeds nothing — A6 |
| 17 | `Last Modified` | `lastModifiedTime` | STORED | `updated_at` | `baseColumns()` supplies it (columns.ts:18) |
## Anomalies

The 2026-10-02 audit raised seven (D1–D7). Each is re-checked below against the live base and the
live source, keeping its original number, and three new ones (A8–A10) are added.

### A1 (was D1) — `Concepts` and `Angles` ids cross between the bases — **STILL HOLDS, confirmed**

In this template base `tblRlcp1ibmS7U7HG` is named `Concepts` and `tbl4UFSFcynlS2Pkn` is named
`Angles`. `TABLE_MAPPINGS` has them the other way round:

- `import-mappings.ts:258-261` — `angles: { airtableTable: 'Angles', airtableTableId: 'tblRlcp1ibmS7U7HG', drizzleImport: 'angles' }`
- `import-mappings.ts:332-335` — `concepts: { airtableTable: 'Concepts', airtableTableId: 'tbl4UFSFcynlS2Pkn', drizzleImport: 'concepts' }`

So for these two tables **resolution by name and resolution by id disagree**, and the ids in that
file are Gratsi's. Content settles the template reading: `Concepts` holds `Batch` and the `Name`
formula `{Batch} & "-" & {Angles} & "-" & {Themes}` — the Concept formula of CLAUDE.md
non-negotiable 6 — while `Angles` owns `Type`, `Pain Points`, `USP`, `Product`, `Personas`, which
`Concepts` reads back as four `(from Angles)` lookups. Template `Concepts`→`concepts`,
template `Angles`→`angles`. A seeder that resolves by id gets both backwards.

`packages/db/src/airtable-tables.ts:48-56` already records all six cross-base id collisions, and my
fetch independently confirms every one by id and by name: `tblZpBYPTcZcmQ1Kf`=`Copywriting`,
`tblhU5yVNhVDwykUt`=`Creative Sheet (Internal & Interface)`, `tbl4UFSFcynlS2Pkn`=`Angles`,
`tblRlcp1ibmS7U7HG`=`Concepts`, `tblGC0TxnHI7lKaNQ`=`DONT USE Creative Sheet`,
`tblzS73a9JrJGiV2J`=`Themes`.

### A2 (was D2) — the table LABELLED `Themes` is a Creative-Modules shape — **HOLDS, and is worse than recorded**

`tblzS73a9JrJGiV2J` is labelled `Themes`. Its three fields are `Module Name` (primary, `singleLineText`),
`Reference Link` (`singleLineText`) and `Concepts` (a link to `Angles`… see below). Its primary field
id is `fld2r3Lk543QCAO9v`, the exact id `packages/db/src/schema/creative-modules.ts:16` cites for
`module_name`. Postgres `themes` has `name`/`category`/`reference_links`/`notes`/`assignee_id`/
`status`/`attachments`/`ai_attachment_summary`/`is_active` and no `module_name`. The content pairing
is `creative_modules`, and the label is stale.

**What the earlier audit did not say, and this is the sharp edge.** The importer resolves tables by
**NAME**, not by id (`airtable-tables.ts:19-42`, `resolveTableIds`), and `GRATSI_TABLES` maps the key
`Themes` to the name `'Themes'`. `TABLE_MAPPINGS.themes` (`import-mappings.ts:122-125`) also carries
`airtableTable: 'Themes'`. This base **has** a table named `Themes`. So pointing the name-based
resolver at the parent base does not fail loudly — it silently resolves `Themes` to the
Creative-Modules-shaped table and feeds it to the `themes` mapping, whose fields are `Name`, `Notes`,
`Assignee`, `Status`, `Attachments`, `Attachment Summary`. **Not one of those six names exists on
this table.** The result is a table of empty `themes` rows, not an error. Calling the label "stale"
understates it: it is a name collision that defeats the very resolver built to prevent id collisions.

Two further consequences stand:

- **The parent base defines no themes table.** Consistent with CLAUDE.md non-negotiable 3 (themes are
  a GLOBAL library, not seeded per brand), but it means this base cannot seed `themes`. Whether that
  is intended or an omission **I could not establish** from this base.
- `Concepts` field 3 `Themes` links **this** table. Its `linkedTableId` is `tblzS73a9JrJGiV2J` and its
  inverse is this table's `Concepts` field. Postgres has `concept_themes` (concepts↔themes),
  `creative_module_angles` and `creative_module_designs`, but **no concept↔creative_modules
  junction**. Of all 203 fields this is the one whose target **I could not establish**.
- The `creativeModules` mapping expects `Foreplay Link` and `(Internal) Creative Design`; this table
  has **neither**, and has `Reference Link`, which the mapping does not know. The parent's
  creative-modules shape and Gratsi's are different field sets.

### A3 (was D3) — `AI Characters / Personas` has no importer entry — **HOLDS; the pairing is stronger than recorded**

`tblgfe8A7nmce6lzn` appears in `TABLE_MAPPINGS` neither by id nor by name, and `grep` for
`aiCharacters` or `AI Characters` across `airtable-import.ts`, `import-mappings.ts` and
`airtable-tables.ts` returns **nothing**. There is no row builder and no `GRATSI_TABLES` key. Nothing
imports this table. That part of the earlier finding stands exactly.

**Correction to the earlier audit.** It said "8 of the 12 fields correspond 1:1" and called the
pairing "unevidenced". Both understate it. **All 12 fields correspond 1:1** to `ai_characters`
columns, and the pairing is evidenced in the repo: the schema docstring at
`packages/db/src/schema/ai-characters.ts:9-12` enumerates the twelve fields *in this base's exact
order* — "Name, Attachments (stored as JSON URLs), Status (single-select), Basic Info, Tone of Voice,
Voice Link/Eleven Labs, Personality Traits, Appearance, Traits & Habits, Hobbies & Lifestyle,
Work & Background, Why promotes this brand." The table is certain; only the importer is missing.

### A4 (was D4) — `DONT USE Creative Sheet` — **HOLDS**

`tblGC0TxnHI7lKaNQ` is the id Gratsi calls the live `Creative Sheet`, and
`TABLE_MAPPINGS.creativeSheetItems` (`import-mappings.ts:973-975`) maps it to `creative_sheet_items`
under the Gratsi label `Creative Sheet`. In the parent its label begins `DONT USE`. Whether a column
set the parent labels "DONT USE" should seed anything is a product decision this base cannot answer.
Note that only 3 of its 17 fields are genuinely usable (A6).

### A5 (was D5) — two `Inspiration` fields, one mapping entry — **HOLDS, and it is also a type mismatch**

`Creative Sheet (Internal & Interface)` has field 19 `Inspiration` (`richText`) and field 20
`Inspiration Image` (`multipleAttachments`). Postgres has both: `creative_briefs.inspiration`
(`text`, briefs.ts:114) and `creative_briefs.inspiration_image` (`jsonb` string[], briefs.ts:115).

But `import-mappings.ts:548-549` sends Airtable `Inspiration` → `inspirationImage`. Carried over
unchanged that puts a **richText value into a jsonb attachment-array column** and leaves field 20
`Inspiration Image` with no mapping entry at all. I assigned `Inspiration`→`inspiration` and
`Inspiration Image`→`inspiration_image` as the only non-colliding, type-correct reading, and flag it
rather than claim the mapping says so.

### A6 (NEW, extends D4) — 12 of the parent's 22 lookups are **broken in Airtable itself**

Every lookup in `DONT USE Creative Sheet` carries `"isValid": false`. Eleven of them have
`"recordLinkFieldId": null` — the link field they read through has been deleted, so they resolve to
nothing:

`Performance (from Creative Name)`, `(Internal) Product (from Creative Name)`,
`Angle (from Creative Name)`, `Concepts (from Angle) (from Creative Name)`,
`Elements we are Testing`, `Design File`, `Design Link URL`, `Collection`, `Platform`, `Funnel`, `Type`.

The twelfth, `Creative Module`, has `recordLinkFieldId: fldoKpIeYfbCvg3cg` — which is this table's
own `Creative Name`, a `singleLineText`, not a link — and `fieldIdInLinkedTable: null`.

So the table's 17 fields reduce to five that carry anything: the formula `Name + Angle + Offer`,
`Creative Name`, `Status`, `Client's Comments` and `Last Modified`. Base-wide this is **12 of 26
computed fields dead**; every one of them is in this single table. The 2026-10-02 audit counted
these 12 as ordinary lookups and did not record that they are invalid. They should seed nothing —
not a stored column, not a `column_definitions` row, not a formula-layer function.

**And the one field the mapping does rely on has the wrong type here.**
`TABLE_MAPPINGS.creativeSheetItems` reads `Creative Name` as a `singleLink` into
`creative_sheet_items.brief_id` ("First link → creative_briefs", `import-mappings.ts:985-988`). In
the parent, `Creative Name` is a **`singleLineText`** — `fldoKpIeYfbCvg3cg`, the same field the dead
`Creative Module` lookup still points at. There is no link to follow, which is also why the eleven
sibling lookups lost their `recordLinkFieldId`. Read against the parent, the only column this table
could populate is a free-text name with nowhere to put it. I have marked that row CONTESTED rather
than assert `brief_id`.

### A7 (was D7) — columns the importer calls sourceless that the parent does define — **HOLDS; the true floor is 25, not 21**

`DRIZZLE_COLUMNS_WITHOUT_AIRTABLE_SOURCE` (`import-mappings.ts:1303-1332`) lists **39** columns, and
that list is scoped to Gratsi. I re-derived the overlap against the parent base and **confirm the
earlier audit's 21**, with the same membership. Its own caveat — "reverse-link columns such as
`collections.product_id` are excluded and 21 is a floor" — was correct, and the floor is loose by
exactly four. Counting link-backed columns too gives **25**:

| Postgres column | Parent field that defines it | In the earlier 21? |
| --- | --- | --- |
| `campaigns_offers.product_id` | `Campaigns & Offers`.`(Internal) Product` | yes |
| `personas.day_in_the_life` | `A Day in the Life` | yes |
| `personas.pain_points` | `Pain Points (Cashvertising)` | yes |
| `personas.success_factors` | `Success Factors (Buyer Personas)` | yes |
| `personas.perceived_barriers` | `Perceived Barriers (Buyer Personas)` | yes |
| `personas.buying_triggers` | `Buying Triggers (Breakthrough Advertising)` | yes |
| `personas.problem_challenge` | `Problem/Challenge (StoryBrand)` | yes |
| `personas.success_transformation` | `Success/Transformation (StoryBrand)` | yes |
| `personas.trigger_words` | `Trigger Words (Mindstates)` | yes |
| `angles.type` | `Angles`.`Type` | yes |
| `angles.pain_points` | `Angles`.`Pain Points` | yes |
| `angles.usp` | `Angles`.`USP` | yes |
| `concepts.ad_inspo_links` | `Concepts`.`Ad Inspo` | yes |
| `concepts.formats_to_create` | `Concepts`.`Formats to create` | yes |
| `creative_briefs.campaign_offer_id` | `Campaigns & Offers` (link) | yes |
| `creative_briefs.asset_id` | `Assets` (link) | yes |
| `creative_briefs.ad_content` | `Ad Content` | yes |
| `creative_briefs.inspiration` | `Inspiration` (conditional on A5) | yes |
| `copywriting.product_id` | `Copywriting`.`Product` (link) | yes |
| `creators.for_partnership_ads` | `For Partnership Ads?` | yes |
| `creators.internal_assets_status` | `Internal Assets Status` | yes |
| `collections.product_id` | `(Internal) Collections`.`(Internal) Product` (link) | **no — new** |
| `collections.creative_design_2_id` | `(Internal) Collections`.`(Internal) Creative Design 2` (link) | **no — new** |
| `creators.concept_ids` | `UGC Management`.`Concepts to film` (link) | **no — new** |
| `creators.product_ids` | `UGC Management`.`Products` (link) | **no — new** |

The remaining 14 of the 39 are genuinely absent from the parent: `products.collection_link`,
`themes.category`/`reference_links`/`is_active`, `personas.product_id`,
`concepts.internal_status`/`client_status`, `creative_briefs.version`/`sequence`/`inspo_links`,
`copywriting.concept_id`/`click_for_ai_spell_checker`/`spelling_feedback`,
`creative_reporting.brief_id`.

`packages/db/src/schema/personas.ts:28-30` already says those persona columns are "NOT shown on the
Gratsi-pinned Personas page… the Gratsi base defines no field for them" and that per-brand
visibility "belongs in the `column_definitions` table". The parent base is where their definitions
come from, which is exactly what the inheritance work needs. I confirm `column_definitions` does
**not** exist yet: `grep` across `packages/db/src/schema/` and `packages/db/drizzle/*.sql` finds it
only in that one comment.

### A8 (was D6) — mapping entries naming a column the schema does not have — **HOLDS for concepts, dissolves for personas**

- **Confirmed.** `TABLE_MAPPINGS.concepts` maps `Performance` → `performance`
  (`import-mappings.ts:364-367`), and `packages/db/src/schema/concepts.ts` has **no `performance`
  column** — `grep -n performance` on that file returns nothing. The mapping is wrong regardless of
  base. In the parent, `Concepts`.`Performance` is a **LOOKUP** through
  `Creative Sheet (Internal & Interface)`→`Performance`, so under the classification law it needs no
  column at all. (`creative_briefs.performance` **does** exist, briefs.ts:130, and correctly holds the
  `singleSelect` on `Creative Sheet` field 8.)
- **No defect.** `TABLE_MAPPINGS.personas` maps `Problem-Solution Awareness Level` → `stageOfAwareness`,
  which exists at `personas.ts:44` as `awarenessStageEnum('stage_of_awareness')`. Recorded only
  because the enum declaration is easy to miss in a grep for `text(`.

Also in this class, and new: `Creative Sheet (Internal & Interface)` field 6
`Batch (from Concepts)` is a **LOOKUP** in the parent, while `creative_briefs.batch` is a stored
column (briefs.ts:90) that the mapping fills from a Gratsi field *named* `Batch`. The two bases
disagree about whether batch is stored or derived. Under the classification law the parent's reading
is DERIVED — resolve through `concept_id` — and `creative_briefs.batch` is then a materialised
denormalisation, not an inherited column. **This needs an owner's decision**; I did not assume one.

### A9 (NEW) — `TABLE_MAPPINGS` field names are Gratsi's, and barely overlap the parent's

This is the largest practical gap and the 2026-10-02 audit did not quantify it. `TABLE_MAPPINGS` is
keyed to Gratsi **field** names, and the parent's names differ table by table. Only **three** of the
fifteen tables have full field-name agreement: `(Internal) Creative Dimensions` (4/4),
`Competitive research` (7/7) and `Client Assets Organisation` (4/4).

Parent fields with **no entry at all** in the paired mapping:

| Table | Parent fields unmatched | of | Mapping names absent from the parent |
| --- | --- | --- | --- |
| `Personas` | **14** | 15 | 6 |
| `Concepts` | 17 | 22 | 18 |
| `DONT USE Creative Sheet` | 14 | 17 | 11 |
| `AI Characters / Personas` | 12 | 12 | n/a (no mapping) |
| `Angles` | 7 | 11 | 17 |
| `Creative Sheet (Internal & Interface)` | 7 | 35 | 13 |
| `UGC Management` | 7 | 32 | 11 |
| `Copywriting` | 4 | 11 | 23 |
| `(Internal) Product` | 3 | 8 | 5 |
| `Campaigns & Offers` | 2 | 14 | 8 |
| `(Internal) Collections` | 1 | 8 | 5 |
| `Themes` | 1 | 3 | 2 |

`Personas` is the headline: **14 of its 15 parent fields have no mapping entry**, because Gratsi
calls them `Description  [Age Status Salary]`, `Personality`, `Drivers for this persona`, `Passion`
and `Problem-Solution Awareness Level`. Every pairing in the Personas section below is therefore mine,
on schema name match, not the importer's. The 2026-10-02 audit reached the same column names and
labelled them "candidate" / "schema name match" rather than "mapping", so its Personas table is
**correct** — but a reader could not tell from it how little importer evidence exists. It does exist
for the three tables listed above and nowhere else.

One case-only collision, which matters because the resolver compares exact strings: the parent's
field 15 is `Creator's Video Intro` (capital V); the mapping key at `import-mappings.ts:773` is
`Creator's video Intro` (lower-case v). A name match against the parent fails on case alone.

### A10 (NEW) — three parent fields whose own shape contradicts their name

- `(Internal) Collections` field 6 `(Internal) Creative Design` is a **`singleLineText`**, not a link,
  though every sibling of that name elsewhere in the base is a link. Postgres already reflects this
  correctly as `collections.creative_design_note` (`text`, collections.ts:30), and field 8
  `(Internal) Creative Design 2` is the real link. Nothing to fix; recorded so no one "corrects" it
  into a link during seeding.
- `Themes` field 3 `Concepts` has `linkedTableId: tbl4UFSFcynlS2Pkn`, which in **this** base is
  `Angles`. `packages/db/src/schema/creative-modules.ts:40-43` already documents exactly this and
  sends it to `creative_module_angles`. The field name says Concepts; the link says Angles.
- `(Internal) Creative Dimensions` field 3 `Link Description` is a `singleSelect` whose choices are
  `Todo`, `In progress`, `Done` and a bare URL,
  `https://business.twitter.com/en/help/campaign-setup/creative-ad-specifications.html`. That is a
  leftover Airtable default select with one real value pasted in. `creative_dimensions` pairs it to a
  column, but the choice list is not a status vocabulary and should not seed one.

### Formula coverage

The parent has exactly four formulas. Against `packages/db/src/formulas/` (index.ts exports
`creatorNotifyFlag`, `emailCampaignCopywritingDueDate`, `emailCampaignDesignDueDate`,
`emailFlowCopywritingDueDate`, `emailFlowDesignDueDate`, `smReminderTrigger`, `creatorCostWithFee`,
`differenceCpa`, `campaignOfferName`, `creativeSheetName`):

| Parent formula field | Formula | Read-time function |
| --- | --- | --- |
| `Campaigns & Offers`.`Name` | `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})` | `campaignOfferName` — **exact match** (names.ts:19) |
| `Concepts`.`Name` | `{Batch} & "-" & {Angles} & "-" & {Themes}` | none in `formulas/`; this is the Concept name of CLAUDE.md non-negotiable 6, owned by `packages/domain` naming |
| `Copywriting`.`Copy #` | `" Copy " & {Autonumber} & " - " & {Creative}` | none; the importer instead parses the first digit run into `copy_number` (`integer`) via `copyNumberFromText` (`airtable-import.ts:598-603`) |
| `DONT USE Creative Sheet`.`Name + Angle + Offer` | `CONCATENATE({Creative Name})` | `creativeSheetName` exists but implements Gratsi's **different** formula, `DATETIME_FORMAT({Created}, "MMMM") & "-" & {Creative Name}` (names.ts:36). **The parent and Gratsi disagree on this formula.** |

`campaigns_offers.name` and `concepts.name` are both stored `NOT NULL` columns while the parent
defines them as formulas — the same stored-vs-derived tension as A8, already resolved in the repo's
favour of storing an auto-generated name.

