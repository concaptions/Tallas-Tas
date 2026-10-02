# Parent column set — Airtable template base `appnaSGAgOUbJ0f9m`

Subagent B, 2026-10-02. Read-only audit. No source file, migration or database was touched.

## What this document is

The **column definition** of the parent base, "Creative Hub Template" (`appnaSGAgOUbJ0f9m`): every
table, every field, in the order the Airtable Meta API returns them, each field classified and
paired with the Postgres column that would hold it.

It is **not** a source of row data, and nothing here describes Gratsi's data. Row counts were never
requested and never fetched.

## Method and provenance

- One call: `GET https://api.airtable.com/v0/meta/bases/appnaSGAgOUbJ0f9m/tables`, HTTP 200, 51,259 bytes.
- Raw response saved outside the repo at
  `/private/tmp/claude-501/-Users-macbook-Tallas-Tas/5d4da015-65d6-4343-8867-8bce924b68d2/scratchpad/parentB-template-raw.json`.
- The response carries no `offset` key, so all 15 tables are present; it is not a truncated page.
- **Field order is the order the API returned**, preserved verbatim and unsorted in every table
  below. That order is what `display_order` should be seeded from.
- Field names, table names and types are quoted verbatim from that JSON, including the trailing
  space in `Script & brief breakdown `.
- Formula text is as the API exposed it, with `fld…` ids resolved to `{Field Name}`.
- Drizzle column names were read from `packages/db/src/schema/*.ts`; the Airtable→Drizzle evidence
  is `packages/db/src/scripts/import-mappings.ts` `TABLE_MAPPINGS[*]` and `JUNCTION_MAPPINGS`.

### Classification

| Class | Airtable types counted | Meaning |
| --- | --- | --- |
| STORED | `singleLineText`, `multilineText`, `richText`, `singleSelect`, `multipleSelects`, `checkbox`, `number`, `currency`, `date`, `url`, `multipleAttachments`, `singleCollaborator`, `autoNumber`, `createdTime`, `lastModifiedTime` | a plain value a column can hold |
| LINK | `multipleRecordLinks` | a record link, with the table it points at |
| LOOKUP | `multipleLookupValues` | a read through a link (no `rollup` or `count` field exists in this base) |
| FORMULA | `formula` | computed, formula text given |

`autoNumber`, `createdTime` and `lastModifiedTime` are Airtable-computed but hold a plain scalar, so
they are counted STORED; each is called out in its table where that matters.

## Summary counts

**15 tables, 203 fields** — 137 stored, 40 link, 22 lookup, 4 formula.

| Airtable table | id | Fields | S | L | K | F | Drizzle table |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Copywriting` | `tblZpBYPTcZcmQ1Kf` | 11 | 7 | 3 | 0 | 1 | `copywriting` |
| `Creative Sheet (Internal & Interface)` | `tblhU5yVNhVDwykUt` | 35 | 26 | 8 | 1 | 0 | `creative_briefs` |
| `Concepts` | `tblRlcp1ibmS7U7HG` | 22 | 9 | 4 | 8 | 1 | `concepts` |
| `Angles` | `tbl4UFSFcynlS2Pkn` | 11 | 5 | 5 | 1 | 0 | `angles` |
| `Themes` | `tblzS73a9JrJGiV2J` | 3 | 2 | 1 | 0 | 0 | `creative_modules` |
| `Personas` | `tblRXknfgKsROI961` | 15 | 14 | 1 | 0 | 0 | `personas` |
| `UGC Management` | `tblRsVqiqUaZRcQYd` | 32 | 30 | 2 | 0 | 0 | `creators` |
| `AI Characters / Personas` | `tblgfe8A7nmce6lzn` | 12 | 12 | 0 | 0 | 0 | `ai_characters` |
| `(Internal) Collections` | `tbl6LBNrRqa6Hh4I2` | 8 | 3 | 5 | 0 | 0 | `collections` |
| `(Internal) Product` | `tblfvfJMYNBz2OYYw` | 8 | 2 | 6 | 0 | 0 | `products` |
| `Campaigns & Offers` | `tblRNaWCVa1cCIwLL` | 14 | 10 | 3 | 0 | 1 | `campaigns_offers` |
| `(Internal) Creative Dimensions` | `tblli0Y76yJvG56zK` | 4 | 3 | 1 | 0 | 0 | `creative_dimensions` |
| `Competitive research` | `tbl9W6v78tKWznN9S` | 7 | 7 | 0 | 0 | 0 | `competitive_research` |
| `Client Assets Organisation` | `tbldFmPU6AWg62Fll` | 4 | 3 | 1 | 0 | 0 | `client_asset_folders` |
| `DONT USE Creative Sheet` | `tblGC0TxnHI7lKaNQ` | 17 | 4 | 0 | 12 | 1 | `creative_sheet_items` |

Airtable type totals across the base: `multipleRecordLinks` 40, `multilineText` 40, `singleSelect` 29,
`singleLineText` 24, `multipleLookupValues` 22, `checkbox` 7, `multipleAttachments` 7, `richText` 6,
`date` 6, `url` 6, `formula` 4, `multipleSelects` 3, `currency` 3, `lastModifiedTime` 2, `autoNumber` 1,
`createdTime` 1, `singleCollaborator` 1, `number` 1.

## How each table was paired with a Drizzle table

`TABLE_MAPPINGS` is keyed to the **Gratsi** base. Its own header says so
(`packages/db/src/scripts/import-mappings.ts:1-8`): "Complete Airtable → Drizzle field mapping for
the Gratsi base (appllDG4OmkK2Hdnn)… The ids below are documentation only — the fetcher resolves
tables by NAME". So `airtableTableId` in that file is a **Gratsi** id, and pairing a *template* table
by that id is exactly the mistake `packages/db/src/airtable-tables.ts:1-11` warns about: "Resolving
by id against the wrong base silently imports the wrong table."

My fetch independently confirms all six collisions that `airtable-tables.ts:48-56` records, by id and
by name: `tblZpBYPTcZcmQ1Kf`=`Copywriting`, `tblhU5yVNhVDwykUt`=`Creative Sheet (Internal & Interface)`,
`tbl4UFSFcynlS2Pkn`=`Angles`, `tblRlcp1ibmS7U7HG`=`Concepts`, `tblGC0TxnHI7lKaNQ`=`DONT USE Creative Sheet`,
`tblzS73a9JrJGiV2J`=`Themes`.

I therefore paired each table on **content** — its field set against the Drizzle columns — and state
the basis per row. Three rows conflict with the id-based answer and are flagged.

| Template table | Drizzle | Schema file | Basis |
| --- | --- | --- | --- |
| `Copywriting` | `copywriting` | `packages/db/src/schema/copy.ts` | id + 7/11 field-name overlap. Template label `Copywriting`; Gratsi label `Meta Copywriting`. |
| `Creative Sheet (Internal & Interface)` | `creative_briefs` | `packages/db/src/schema/briefs.ts` | id + 28/35 field-name overlap. Template label `Creative Sheet (Internal & Interface)`; Gratsi label `Creative Design (Internal & Interface)`. |
| `Concepts` | `concepts` | `packages/db/src/schema/concepts.ts` | **CONTENT**, not id: carries `Batch` + the `Name` formula `{Batch} & "-" & {Angles} & "-" & {Themes}` (the Concept formula, CLAUDE.md non-negotiable 6). Pairing by id would give `angles` - CONFLICT, see Discrepancies D1. |
| `Angles` | `angles` | `packages/db/src/schema/angles.ts` | **CONTENT**, not id: owns `Pain Points`, `USP`, `Type`, `Personas`, `Product` - the attributes template Concepts reads back as `(from Angles)` lookups. Pairing by id would give `concepts` - CONFLICT, see D1. |
| `Themes` | `creative_modules` | `packages/db/src/schema/creative-modules.ts` | **CONTENT + id**: primary field is `fld2r3Lk543QCAO9v` `Module Name`, the exact field id `creative-modules.ts:16` cites for `module_name`. The template LABEL is `Themes`, which does NOT pair with Drizzle `themes` - CONFLICT, see D2. |
| `Personas` | `personas` | `packages/db/src/schema/personas.ts` | Label match + 12 of 15 fields correspond 1:1 to `personas` columns. The template id is absent from `TABLE_MAPPINGS` (which carries the Gratsi id `tblyt7X4VjHxtMDVS`). |
| `UGC Management` | `creators` | `packages/db/src/schema/creators.ts` | id + label + 25/32 field-name overlap. |
| `AI Characters / Personas` | `ai_characters` | `packages/db/src/schema/ai-characters.ts` | **Not in `TABLE_MAPPINGS` by id or by label.** Paired on content only: 8 of 12 fields correspond 1:1 to `ai_characters` columns (`voice_link`, `traits_and_habits`, `hobbies_and_lifestyle`, `work_and_background`, `why_promotes_brand`, ...). No importer evidence exists - see D3. |
| `(Internal) Collections` | `collections` | `packages/db/src/schema/collections.ts` | id + label + 7/8 field-name overlap. |
| `(Internal) Product` | `products` | `packages/db/src/schema/products.ts` | id + label + 5/8 field-name overlap. |
| `Campaigns & Offers` | `campaigns_offers` | `packages/db/src/schema/campaigns.ts` | id + label + 12/14 field-name overlap. |
| `(Internal) Creative Dimensions` | `creative_dimensions` | `packages/db/src/schema/creative-dimensions.ts` | id + label + 4/4 field-name overlap. |
| `Competitive research` | `competitive_research` | `packages/db/src/schema/competitive-research.ts` | id + label + 7/7 field-name overlap. |
| `Client Assets Organisation` | `client_asset_folders` | `packages/db/src/schema/client-asset-folders.ts` | id + label + 4/4 field-name overlap. |
| `DONT USE Creative Sheet` | `creative_sheet_items` | `packages/db/src/schema/creative-sheet-items.ts` | id. Template label `DONT USE Creative Sheet`; Gratsi label `Creative Sheet`. The template label says do not use it - see D4. |

## Discrepancies the owner has to settle

**D1 — `Concepts` and `Angles` carry each other's ids across the two bases.** In this template base
`tblRlcp1ibmS7U7HG` is named `Concepts` and `tbl4UFSFcynlS2Pkn` is named `Angles`; in Gratsi those two
ids are the other way round. Content settles it for the template: `Concepts` holds `Batch` and the
`Name` formula `{Batch} & "-" & {Angles} & "-" & {Themes}` — the Concept formula of CLAUDE.md
non-negotiable 6 — while `Angles` owns `Pain Points`, `USP`, `Type`, `Product`, `Personas`, which
`Concepts` reads back as four `(from Angles)` lookups. So template `Concepts`→`concepts` and template
`Angles`→`angles`. A seeder that resolves these by id gets both backwards.

**D2 — the template table named `Themes` is not the themes library.** `tblzS73a9JrJGiV2J` is labelled
`Themes` but its three fields are `Module Name`, `Reference Link` and a link named `Concepts`. Its
primary field id is `fld2r3Lk543QCAO9v`, which is the exact id
`packages/db/src/schema/creative-modules.ts:16` cites for `module_name`. Drizzle `themes` has
`name`/`notes`/`reference_links`/`status`/`assignee_id` and no `module_name`. So this table pairs with
`creative_modules`, and its label is stale. Two consequences:

- **The parent base defines no themes table.** That is consistent with CLAUDE.md non-negotiable 3
  (themes are a global library, not seeded per brand), but it means the Template base cannot seed
  `themes`, and I cannot establish from this base whether that is intended or an omission.
- `Concepts` field 3 `Themes` links **this** table, so in the template that link is
  concept↔creative_module. Drizzle has `concept_themes` (concepts↔themes),
  `creative_module_angles` and `creative_module_designs`, but **no concept↔creative_modules
  junction**. This is the one field in all 203 whose target I could not establish.

**D3 — `AI Characters / Personas` has no importer entry at all.** `tblgfe8A7nmce6lzn` appears in
`TABLE_MAPPINGS` neither by id nor by name. A Drizzle table `ai_characters`
(`packages/db/src/schema/ai-characters.ts`) exists and 8 of the 12 fields correspond to its columns
one-to-one (`voice_link`, `traits_and_habits`, `hobbies_and_lifestyle`, `work_and_background`,
`why_promotes_brand`, `appearance`, `personality_traits`, `tone_of_voice`). The pairing is strong on
content but **unevidenced by the importer**: I cannot establish that anything imports this table.

**D4 — `DONT USE Creative Sheet` is named as deprecated in the parent.** `tblGC0TxnHI7lKaNQ` is the id
that Gratsi calls the live `Creative Sheet` and that `TABLE_MAPPINGS` maps to `creative_sheet_items`.
Whether a column set the parent labels "DONT USE" should seed anything is a product decision, not
something this base can answer.

**D5 — `Inspiration` and `Inspiration Image` are two fields in the parent, one in the mapping.**
`Creative Sheet (Internal & Interface)` has field 19 `Inspiration` (`richText`) and field 20
`Inspiration Image` (`multipleAttachments`). `creative_briefs` has both `inspiration` and
`inspiration_image`. But `TABLE_MAPPINGS.creativeBriefs` sends Gratsi's `Inspiration` to
`inspirationImage`. Carried over unchanged, both parent fields land in the same column. I assigned
`Inspiration`→`inspiration` and `Inspiration Image`→`inspiration_image` as the only non-colliding
reading, and flag it rather than claim the mapping says so.

**D6 — two mapping entries name a column the schema does not have.**

- `TABLE_MAPPINGS.concepts` maps Gratsi `Performance` to `performance`, but
  `packages/db/src/schema/concepts.ts` has no `performance` column (grep for `performance` in that
  file returns nothing). In the parent, `Performance` is a LOOKUP through `Creative Sheet`, not a
  stored value, so no column is needed — but the mapping is wrong either way.
- `TABLE_MAPPINGS.personas` maps `Problem-Solution Awareness Level` to `stageOfAwareness`, which
  **does** exist (`personas.ts:45`, the `awareness_stage` pg enum). No defect; recorded because the
  column is declared with `awarenessStageEnum(...)` rather than a plain type and is easy to miss.

**D7 — the parent supplies 21 columns the importer records as having no Airtable source.**
`DRIZZLE_COLUMNS_WITHOUT_AIRTABLE_SOURCE` (`import-mappings.ts:1303-1332`) lists 39 columns as
sourceless. That list is scoped to Gratsi. Against the parent base, 21 of the 39 are defined as
fields — counting only fields whose target column I name directly below, so reverse-link columns such
as `collections.product_id` are excluded and 21 is a floor:

| Drizzle column | Parent field that defines it |
| --- | --- |
| `campaigns_offers.product_id` | `(Internal) Product` |
| `personas.day_in_the_life` | `A Day in the Life` |
| `personas.pain_points` | `Pain Points (Cashvertising)` |
| `personas.success_factors` | `Success Factors (Buyer Personas)` |
| `personas.perceived_barriers` | `Perceived Barriers (Buyer Personas)` |
| `personas.buying_triggers` | `Buying Triggers (Breakthrough Advertising)` |
| `personas.problem_challenge` | `Problem/Challenge (StoryBrand)` |
| `personas.success_transformation` | `Success/Transformation (StoryBrand)` |
| `personas.trigger_words` | `Trigger Words (Mindstates)` |
| `angles.type` | `Type` |
| `angles.pain_points` | `Pain Points` |
| `angles.usp` | `USP` |
| `concepts.ad_inspo_links` | `Ad Inspo` |
| `concepts.formats_to_create` | `Formats to create` |
| `creative_briefs.campaign_offer_id` | `Campaigns & Offers` |
| `creative_briefs.asset_id` | `Assets` |
| `creative_briefs.ad_content` | `Ad Content` |
| `creative_briefs.inspiration` | `Inspiration` |
| `copywriting.product_id` | `Product` |
| `creators.for_partnership_ads` | `For Partnership Ads?` |
| `creators.internal_assets_status` | `Internal Assets Status` |

That is 21 rows. Most of it is `personas` (8 of its 9 listed columns) and `angles`
(`type`, `pain_points`, `usp` — all three). `packages/db/src/schema/personas.ts:11-17` already says
those columns are "NOT shown on the Gratsi-pinned Personas page… the Gratsi base defines no field for
them" and that per-brand visibility "belongs in `brand_field_overrides`". The parent base is where
their definitions come from, which is what the inheritance work needs.

One row is conditional: `creative_briefs.inspiration` holds only under the D5 reading of
`Inspiration` vs `Inspiration Image`. The other 20 do not depend on a contested assignment.

## Per-table column sets

`target Drizzle column` is the column that would hold the field. `no column` means nothing should hold
it and the notes say why (a reverse link stored on the other table, a lookup, an Airtable-internal
counter). `cannot establish` appears once, for D2.

### `Copywriting`

`tblZpBYPTcZcmQ1Kf` — 11 fields (7 stored / 3 link / 0 lookup / 1 formula) — Drizzle `copywriting` (`packages/db/src/schema/copy.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Copy #` | `formula` | FORMULA | `copy_number` | `" Copy " & {Autonumber} & " - " & {Creative}` · mapping |
| 2 | `Creative` | `multipleRecordLinks` | LINK | `creative_brief_id` | -> `Creative Sheet (Internal & Interface)` · mapping |
| 3 | `Status` | `singleSelect` | STORED | `status` | mapping |
| 4 | `Collection` | `multipleRecordLinks` | LINK | no column | -> `(Internal) Collections` · reverse side stored as `collections.copywriting_id` |
| 5 | `Product` | `multipleRecordLinks` | LINK | `product_id` | -> `(Internal) Product` · candidate: schema has `product_id`; mapping marks Gratsi `Product` skip |
| 6 | `Primary Copy` | `richText` | STORED | `primary_copy` | schema name match |
| 7 | `Headline` | `multilineText` | STORED | `headline` | mapping |
| 8 | `News Feed / Link Description` | `multilineText` | STORED | `link_description` | candidate: Gratsi `News Feed` -> `linkDescription` |
| 9 | `CTA` | `singleSelect` | STORED | `cta` | mapping |
| 10 | `USED` | `checkbox` | STORED | `used` | mapping |
| 11 | `Autonumber` | `autoNumber` | STORED | no column | autoNumber counter; `copy_number` holds the `Copy #` result |

### `Creative Sheet (Internal & Interface)`

`tblhU5yVNhVDwykUt` — 35 fields (26 stored / 8 link / 1 lookup / 0 formula) — Drizzle `creative_briefs` (`packages/db/src/schema/briefs.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping |
| 2 | `Concept` | `multipleRecordLinks` | LINK | `concept_id` | -> `Concepts` · mapping |
| 3 | `Source` | `singleSelect` | STORED | `source` | mapping |
| 4 | `Funnel` | `singleSelect` | STORED | `funnel` | mapping |
| 5 | `Type` | `singleSelect` | STORED | `type` | mapping |
| 6 | `Batch (from Concepts)` | `multipleLookupValues` | LOOKUP | `batch` | via `Concept` -> `Batch` · materialised: LOOKUP here, stored column in Drizzle |
| 7 | `Angle` | `multipleRecordLinks` | LINK | `angle_id` | -> `Angles` · mapping |
| 8 | `Performance` | `singleSelect` | STORED | `performance` | mapping |
| 9 | `Priority` | `singleSelect` | STORED | `priority` | mapping |
| 10 | `Client Status` | `singleSelect` | STORED | `client_status` | mapping |
| 11 | `Internal Status` | `singleSelect` | STORED | `internal_status` | mapping |
| 12 | `Elements we are Testing` | `richText` | STORED | `elements_tested` | mapping |
| 13 | `QA Checklist Doc` | `multipleAttachments` | STORED | `qa_checklist_doc` | mapping |
| 14 | `Video Editor QA` | `checkbox` | STORED | `qa_video_editor` | mapping |
| 15 | `Graphic Designer QA` | `checkbox` | STORED | `qa_designer` | mapping |
| 16 | `Creative Strategist QA` | `checkbox` | STORED | `qa_strategist` | mapping |
| 17 | `Design File` | `multipleAttachments` | STORED | `design_file` | mapping |
| 18 | `Design Link URL` | `singleLineText` | STORED | `design_file_url` | mapping |
| 19 | `Inspiration` | `richText` | STORED | `inspiration` | candidate; mapping sends Gratsi `Inspiration` to `inspiration_image` - see D5 |
| 20 | `Inspiration Image` | `multipleAttachments` | STORED | `inspiration_image` | schema name match |
| 21 | `Brief` | `richText` | STORED | `brief_to_design` | candidate: Gratsi `Brief to Design/Editing` -> `briefToDesign` |
| 22 | `Ad Content` | `richText` | STORED | `ad_content` | schema name match |
| 23 | `(Internal) Product` | `multipleRecordLinks` | LINK | `product_id` | -> `(Internal) Product` · mapping |
| 24 | `Collection` | `multipleRecordLinks` | LINK | `collection_id` | -> `(Internal) Collections` · candidate: Gratsi `(Internal) Collections 3` -> `collectionId` |
| 25 | `Campaigns & Offers` | `multipleRecordLinks` | LINK | `campaign_offer_id` | -> `Campaigns & Offers` · candidate: schema has `campaign_offer_id` |
| 26 | `Platform` | `multipleSelects` | STORED | `platform` | mapping |
| 27 | `Dimensions` | `multipleRecordLinks` | LINK | `dimensions` | -> `(Internal) Creative Dimensions` · mapping |
| 28 | `Assets` | `multipleRecordLinks` | LINK | `asset_id` | -> `Client Assets Organisation` · candidate: schema has `asset_id` |
| 29 | `Created` | `createdTime` | STORED | `created_at` | mapping marks skip; `baseColumns()` supplies it |
| 30 | `Click for AI Spell Checker Again` | `checkbox` | STORED | `click_for_ai_spell_checker` | mapping |
| 31 | `Spelling Feedback` | `multilineText` | STORED | `spelling_feedback` | mapping |
| 32 | `Assignee` | `singleCollaborator` | STORED | `assignee` | mapping |
| 33 | `Last Modified` | `lastModifiedTime` | STORED | `updated_at` | mapping marks skip; `baseColumns()` supplies it |
| 34 | `Meta Copywriting` | `multipleRecordLinks` | LINK | no column | -> `Copywriting` · reverse side stored as `copywriting.creative_brief_id` |
| 35 | `Script & brief breakdown ` | `multipleAttachments` | STORED | `script_and_brief_breakdown` | mapping |

### `Concepts`

`tblRlcp1ibmS7U7HG` — 22 fields (9 stored / 4 link / 8 lookup / 1 formula) — Drizzle `concepts` (`packages/db/src/schema/concepts.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `formula` | FORMULA | `name` | `{Batch} & "-" & {Angles} & "-" & {Themes}` · mapping |
| 2 | `Batch` | `singleSelect` | STORED | `batch` | mapping |
| 3 | `Themes` | `multipleRecordLinks` | LINK | **cannot establish** | -> `Themes` · links tblzS73a9JrJGiV2J (Module Name/Reference Link). `concept_themes` points at `themes`; no concept<->creative_modules junction exists - see D2 |
| 4 | `Angles` | `multipleRecordLinks` | LINK | junction `concept_angles` | -> `Angles` · JUNCTION_MAPPINGS.conceptAngles |
| 5 | `Type (from Angles)` | `multipleLookupValues` | LOOKUP | no column | via `Angles` -> `Type` · read through link |
| 6 | `Category` | `singleSelect` | STORED | `category` | mapping |
| 7 | `Concept Style` | `singleSelect` | STORED | `concept_style` | schema name match |
| 8 | `Approval Status` | `singleSelect` | STORED | `approval_status` | schema name match |
| 9 | `Description` | `multipleLookupValues` | LOOKUP | `description` | via `Angles` -> `Description` · column exists, but this field is a LOOKUP through `Angles` here |
| 10 | `Performance` | `multipleLookupValues` | LOOKUP | no column | via `Creative Sheet (Internal & Interface)` -> `Performance` · LOOKUP through `Creative Sheet`; `concepts` has NO `performance` column - see D6 |
| 11 | `Creators` | `multipleLookupValues` | LOOKUP | no column | via `Creator` -> `Creator name (Filled by UGC Manager)` · read through link |
| 12 | `Hook examples` | `multilineText` | STORED | `hook_examples` | schema name match |
| 13 | `Script idea` | `multilineText` | STORED | `script_idea` | schema name match |
| 14 | `Pain Points (from Angles)` | `multipleLookupValues` | LOOKUP | no column | via `Angles` -> `Pain Points` · read through link |
| 15 | `USP (from Angles)` | `multipleLookupValues` | LOOKUP | no column | via `Angles` -> `USP` · read through link |
| 16 | `Product (from Angles)` | `multipleLookupValues` | LOOKUP | no column | via `Angles` -> `Product` · read through link |
| 17 | `Personas (from Angles)` | `multipleLookupValues` | LOOKUP | no column | via `Angles` -> `Personas` · read through link |
| 18 | `Formats to create` | `multipleSelects` | STORED | `formats_to_create` | schema name match |
| 19 | `Production Status` | `singleSelect` | STORED | `production_status` | mapping |
| 20 | `Ad Inspo` | `multilineText` | STORED | `ad_inspo_links` | candidate: Gratsi `Ad Inspo` -> `adInspoLinks` |
| 21 | `Creator` | `multipleRecordLinks` | LINK | junction `creator_concepts` | -> `UGC Management` · JUNCTION_MAPPINGS.creatorConcepts (reverse) |
| 22 | `Creative Sheet (Internal & Interface)` | `multipleRecordLinks` | LINK | no column | -> `Creative Sheet (Internal & Interface)` · reverse side stored as `creative_briefs.concept_id` |

### `Angles`

`tbl4UFSFcynlS2Pkn` — 11 fields (5 stored / 5 link / 1 lookup / 0 formula) — Drizzle `angles` (`packages/db/src/schema/angles.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping |
| 2 | `Type` | `multipleSelects` | STORED | `type` | schema name match |
| 3 | `Product` | `multipleRecordLinks` | LINK | junction `angle_products` | -> `(Internal) Product` · JUNCTION_MAPPINGS.angleProducts |
| 4 | `Collection` | `multipleRecordLinks` | LINK | no column | -> `(Internal) Collections` · reverse side stored as `collections.angle_id` |
| 5 | `Personas` | `multipleRecordLinks` | LINK | junction `angle_personas` | -> `Personas` · JUNCTION_MAPPINGS.anglePersonas |
| 6 | `Description` | `multilineText` | STORED | `description` | mapping |
| 7 | `Pain Points` | `multilineText` | STORED | `pain_points` | schema name match |
| 8 | `USP` | `multilineText` | STORED | `usp` | schema name match |
| 9 | `Concepts` | `multipleRecordLinks` | LINK | no column | -> `Concepts` · mapping: skip |
| 10 | `Performance (from Concepts)` | `multipleLookupValues` | LOOKUP | no column | via `Concepts` -> `Performance` · read through link |
| 11 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK | no column | -> `Creative Sheet (Internal & Interface)` · mapping: skip |

### `Themes`

`tblzS73a9JrJGiV2J` — 3 fields (2 stored / 1 link / 0 lookup / 0 formula) — Drizzle `creative_modules` (`packages/db/src/schema/creative-modules.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Module Name` | `singleLineText` | STORED | `module_name` | mapping |
| 2 | `Reference Link` | `singleLineText` | STORED | `foreplay_link` | candidate: Gratsi names the same slot `Foreplay Link` - see D2 |
| 3 | `Concepts` | `multipleRecordLinks` | LINK | junction `creative_module_angles` | -> `Concepts` · JUNCTION_MAPPINGS.creativeModuleAngles - but in THIS base the link points at Concepts, not Angles - see D2 |

### `Personas`

`tblRXknfgKsROI961` — 15 fields (14 stored / 1 link / 0 lookup / 0 formula) — Drizzle `personas` (`packages/db/src/schema/personas.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Persona Name` | `multilineText` | STORED | `name` | candidate: primary field |
| 2 | `A Day in the Life` | `multilineText` | STORED | `day_in_the_life` | candidate: 1:1 |
| 3 | `Demographic` | `multilineText` | STORED | `demographic` | schema name match |
| 4 | `Psychographic` | `multilineText` | STORED | `psychographic` | schema name match |
| 5 | `Core Desires (Cashvertising)` | `multilineText` | STORED | `core_desires` | candidate: 1:1 |
| 6 | `Emotional Triggers (Cashvertising)` | `multilineText` | STORED | `emotional_triggers` | candidate: 1:1 |
| 7 | `Pain Points (Cashvertising)` | `multilineText` | STORED | `pain_points` | candidate: 1:1 |
| 8 | `Success Factors (Buyer Personas)` | `multilineText` | STORED | `success_factors` | candidate: 1:1 |
| 9 | `Perceived Barriers (Buyer Personas)` | `multilineText` | STORED | `perceived_barriers` | candidate: 1:1 |
| 10 | `Stage of Market Awareness (Breakthrough Advertising)` | `singleSelect` | STORED | `stage_of_awareness` | candidate: 1:1 (`awareness_stage` pg enum) |
| 11 | `Buying Triggers (Breakthrough Advertising)` | `multilineText` | STORED | `buying_triggers` | candidate: 1:1 |
| 12 | `Problem/Challenge (StoryBrand)` | `multilineText` | STORED | `problem_challenge` | candidate: 1:1 |
| 13 | `Success/Transformation (StoryBrand)` | `multilineText` | STORED | `success_transformation` | candidate: 1:1 |
| 14 | `Trigger Words (Mindstates)` | `multilineText` | STORED | `trigger_words` | candidate: 1:1 |
| 15 | `Angles` | `multipleRecordLinks` | LINK | no column | -> `Angles` · mapping: skip |

### `UGC Management`

`tblRsVqiqUaZRcQYd` — 32 fields (30 stored / 2 link / 0 lookup / 0 formula) — Drizzle `creators` (`packages/db/src/schema/creators.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Creator name (Filled by UGC Manager)` | `singleLineText` | STORED | `name` | mapping |
| 2 | `(Internal) Deadline for the request` | `date` | STORED | `deadline` | candidate: schema has `deadline` |
| 3 | `Date of Management` | `date` | STORED | `date_of_management` | mapping |
| 4 | `Age` | `singleSelect` | STORED | `age_bracket` | mapping |
| 5 | `Gender` | `singleSelect` | STORED | `gender` | mapping |
| 6 | `Ethnicity` | `singleLineText` | STORED | `ethnicity` | mapping |
| 7 | `Internal Brief` | `multilineText` | STORED | `internal_brief` | schema name match |
| 8 | `Concepts to film` | `multipleRecordLinks` | LINK | junction `creator_concepts` | -> `Concepts` · candidate: Gratsi `Concept to film` (singular) |
| 9 | `Products` | `multipleRecordLinks` | LINK | junction `creatorProducts` | -> `(Internal) Product` · mapping |
| 10 | `Budget per 60sec video` | `currency` | STORED | `budget_per_60s` | mapping |
| 11 | `For Partnership Ads?` | `singleSelect` | STORED | `for_partnership_ads` | schema name match |
| 12 | `Internal Creator's Status` | `singleSelect` | STORED | `internal_creator_status` | candidate: Gratsi `Status` -> `internalCreatorStatus` |
| 13 | `Status` | `singleSelect` | STORED | `internal_creator_status` | mapping |
| 14 | `Internal Assets Status` | `singleSelect` | STORED | `internal_assets_status` | schema name match |
| 15 | `Creator's Video Intro` | `multipleAttachments` | STORED | `video_intro_url` | candidate: Gratsi `Creator's video Intro` (lower-case v) |
| 16 | `Creator's Profile Pic` | `multipleAttachments` | STORED | `profile_pic_url` | mapping |
| 17 | `Platform` | `singleSelect` | STORED | `platform` | mapping |
| 18 | `(Client's) Note or Comments` | `multilineText` | STORED | `client_note` | mapping |
| 19 | `Creator's cost (USD)` | `currency` | STORED | no column | mapping: skip |
| 20 | `Raw assets` | `url` | STORED | `raw_assets_url` | mapping |
| 21 | `Shipping Location` | `multilineText` | STORED | `shipping_location` | mapping |
| 22 | `Tracking Number ` | `singleLineText` | STORED | `tracking_number` | mapping |
| 23 | `Partnership Activity` | `singleSelect` | STORED | `partnership_activity` | mapping |
| 24 | `Creator Link` | `url` | STORED | `creator_link` | mapping |
| 25 | `Instagram Username` | `singleLineText` | STORED | `instagram_username` | mapping |
| 26 | `Date of Partnership Activation` | `date` | STORED | `partnership_activated_at` | mapping |
| 27 | `Partnership Time Period (days)` | `number` | STORED | `partnership_period_days` | mapping |
| 28 | `Continue Working With?` | `singleSelect` | STORED | `continue_working_with` | mapping |
| 29 | `Extension Time Period` | `singleSelect` | STORED | `extension_days` | mapping |
| 30 | `Partnership Price per 30 days` | `currency` | STORED | `partnership_price_per_30_days` | mapping |
| 31 | `Notes for Partnership ads` | `multilineText` | STORED | `partnership_notes` | mapping |
| 32 | `Facebook Profile for Partnership` | `richText` | STORED | `facebook_profile_url` | mapping |

### `AI Characters / Personas`

`tblgfe8A7nmce6lzn` — 12 fields (12 stored / 0 link / 0 lookup / 0 formula) — Drizzle `ai_characters` (`packages/db/src/schema/ai-characters.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | schema name match |
| 2 | `Attachments` | `multipleAttachments` | STORED | `attachments` | schema name match |
| 3 | `Status` | `singleSelect` | STORED | `status` | schema name match |
| 4 | `Basic Info` | `multilineText` | STORED | `basic_info` | schema name match |
| 5 | `Tone of Voice` | `multilineText` | STORED | `tone_of_voice` | schema name match |
| 6 | `Voice Link (Eleven Labs)` | `url` | STORED | `voice_link` | candidate: 1:1 |
| 7 | `Personality Traits` | `multilineText` | STORED | `personality_traits` | schema name match |
| 8 | `Appearance` | `multilineText` | STORED | `appearance` | schema name match |
| 9 | `Traits & Habits` | `multilineText` | STORED | `traits_and_habits` | candidate: 1:1 |
| 10 | `Hobbies & Lifestyle` | `multilineText` | STORED | `hobbies_and_lifestyle` | candidate: 1:1 |
| 11 | `Work & Background` | `multilineText` | STORED | `work_and_background` | candidate: 1:1 |
| 12 | `Why He Promotes this brand?` | `multilineText` | STORED | `why_promotes_brand` | candidate: 1:1 |

### `(Internal) Collections`

`tbl6LBNrRqa6Hh4I2` — 8 fields (3 stored / 5 link / 0 lookup / 0 formula) — Drizzle `collections` (`packages/db/src/schema/collections.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Collection Name` | `singleLineText` | STORED | `name` | candidate: Gratsi `Main Collection` -> `name` |
| 2 | `URL` | `url` | STORED | `url` | mapping |
| 3 | `Campaigns & Offers` | `multipleRecordLinks` | LINK | `campaign_id` | -> `Campaigns & Offers` · mapping |
| 4 | `Angles` | `multipleRecordLinks` | LINK | junction `conceptCollections` | -> `Angles` · mapping |
| 5 | `(Internal) Product` | `multipleRecordLinks` | LINK | no column | -> `(Internal) Product` · mapping: skip |
| 6 | `(Internal) Creative Design` | `singleLineText` | STORED | no column | mapping: skip |
| 7 | `Ads Copywriting copy` | `multipleRecordLinks` | LINK | `copywriting_id` | -> `Copywriting` · mapping |
| 8 | `(Internal) Creative Design 2` | `multipleRecordLinks` | LINK | `creative_design_note` | -> `Creative Sheet (Internal & Interface)` · mapping |

### `(Internal) Product`

`tblfvfJMYNBz2OYYw` — 8 fields (2 stored / 6 link / 0 lookup / 0 formula) — Drizzle `products` (`packages/db/src/schema/products.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Product Name / Landing Page Name` | `multilineText` | STORED | `name` | mapping |
| 2 | `Link` | `url` | STORED | `link` | mapping |
| 3 | `(Internal) Collections` | `multipleRecordLinks` | LINK | no column | -> `(Internal) Collections` · reverse side stored as `collections.product_id` |
| 4 | `Campaigns & Offers` | `multipleRecordLinks` | LINK | no column | -> `Campaigns & Offers` · reverse side stored as `campaigns_offers.product_id` |
| 5 | `Angles` | `multipleRecordLinks` | LINK | no column | -> `Angles` · mapping: skip |
| 6 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK | no column | -> `Creative Sheet (Internal & Interface)` · mapping: skip |
| 7 | `Meta Copywriting` | `multipleRecordLinks` | LINK | no column | -> `Copywriting` · reverse side stored as `copywriting.product_id` |
| 8 | `UGC Management` | `multipleRecordLinks` | LINK | no column | -> `UGC Management` · mapping: skip |

### `Campaigns & Offers`

`tblRNaWCVa1cCIwLL` — 14 fields (10 stored / 3 link / 0 lookup / 1 formula) — Drizzle `campaigns_offers` (`packages/db/src/schema/campaigns.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `formula` | FORMULA | `name` | `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})` · mapping |
| 2 | `Holiday` | `singleLineText` | STORED | `holiday` | mapping |
| 3 | `Official Date` | `date` | STORED | `official_date` | mapping |
| 4 | `Country` | `singleLineText` | STORED | `country` | mapping |
| 5 | `Description` | `multilineText` | STORED | `description` | mapping |
| 6 | `Confirmed by Client` | `checkbox` | STORED | `confirmed_by_client` | schema name match |
| 7 | `Launched` | `checkbox` | STORED | `launched` | mapping |
| 8 | `Ads Launch Date` | `date` | STORED | `ads_launch_date` | mapping |
| 9 | `Ads End Date` | `date` | STORED | `ads_end_date` | mapping |
| 10 | `Discount Offer` | `singleLineText` | STORED | `discount_offer` | mapping |
| 11 | `Code` | `singleLineText` | STORED | `code` | mapping |
| 12 | `Collections` | `multipleRecordLinks` | LINK | no column | -> `(Internal) Collections` · mapping: skip |
| 13 | `(Internal) Product` | `multipleRecordLinks` | LINK | `product_id` | -> `(Internal) Product` · candidate: schema has `product_id` |
| 14 | `Design attached` | `multipleRecordLinks` | LINK | no column | -> `Creative Sheet (Internal & Interface)` · mapping: skip |

### `(Internal) Creative Dimensions`

`tblli0Y76yJvG56zK` — 4 fields (3 stored / 1 link / 0 lookup / 0 formula) — Drizzle `creative_dimensions` (`packages/db/src/schema/creative-dimensions.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping |
| 2 | `Dimensions` | `singleLineText` | STORED | `dimensions` | mapping |
| 3 | `Link Description` | `singleSelect` | STORED | `link_description` | mapping |
| 4 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK | no column | -> `Creative Sheet (Internal & Interface)` · mapping: skip |

### `Competitive research`

`tbl9W6v78tKWznN9S` — 7 fields (7 stored / 0 link / 0 lookup / 0 formula) — Drizzle `competitive_research` (`packages/db/src/schema/competitive-research.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `singleLineText` | STORED | `name` | mapping |
| 2 | `Type` | `singleSelect` | STORED | `type` | mapping |
| 3 | `Website` | `singleLineText` | STORED | `website` | mapping |
| 4 | `Insta` | `singleLineText` | STORED | `instagram` | mapping |
| 5 | `FB Page` | `singleLineText` | STORED | `facebook_page` | mapping |
| 6 | `Meta Ads Library` | `multilineText` | STORED | `meta_ads_library` | mapping |
| 7 | `Analysis` | `multilineText` | STORED | `analysis` | mapping |

### `Client Assets Organisation`

`tbldFmPU6AWg62Fll` — 4 fields (3 stored / 1 link / 0 lookup / 0 formula) — Drizzle `client_asset_folders` (`packages/db/src/schema/client-asset-folders.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name [Folder]` | `singleLineText` | STORED | `name` | mapping |
| 2 | `Description` | `multilineText` | STORED | `description` | mapping |
| 3 | `Location` | `url` | STORED | `location_url` | mapping |
| 4 | `(Internal) Creative Design` | `multipleRecordLinks` | LINK | no column | -> `Creative Sheet (Internal & Interface)` · mapping: skip |

### `DONT USE Creative Sheet`

`tblGC0TxnHI7lKaNQ` — 17 fields (4 stored / 0 link / 12 lookup / 1 formula) — Drizzle `creative_sheet_items` (`packages/db/src/schema/creative-sheet-items.ts`)

| # | Field | Airtable type | Class | Target Drizzle column | Basis / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name + Angle + Offer` | `formula` | FORMULA | no column | `CONCATENATE({Creative Name})` · mapping marks Gratsi `Name` skip; `creative_sheet_items` has no name column |
| 2 | `Creative Name` | `singleLineText` | STORED | `brief_id` | mapping |
| 3 | `Performance (from Creative Name)` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Performance` · read through link |
| 4 | `(Internal) Product (from Creative Name)` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `(Internal) Product` · read through link |
| 5 | `Angle (from Creative Name)` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Angle` · read through link |
| 6 | `Concepts (from Angle) (from Creative Name)` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Concept` · read through link |
| 7 | `Elements we are Testing` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Elements we are Testing` · read through link |
| 8 | `Design File` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Design File` · read through link |
| 9 | `Status` | `singleSelect` | STORED | `status` | mapping |
| 10 | `Client's Comments` | `multilineText` | STORED | `client_comments` | mapping |
| 11 | `Design Link URL` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Design Link URL` · read through link |
| 12 | `Collection` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Collection` · read through link |
| 13 | `Platform` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Platform` · read through link |
| 14 | `Funnel` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Funnel` · read through link |
| 15 | `Type` | `multipleLookupValues` | LOOKUP | no column | via `?` -> `Type` · read through link |
| 16 | `Creative Module` | `multipleLookupValues` | LOOKUP | no column | via `Creative Name` -> `?` · read through link |
| 17 | `Last Modified` | `lastModifiedTime` | STORED | `updated_at` | `baseColumns()` supplies it |

## What I could not establish

- **Which Drizzle table `Concepts` field 3 `Themes` should populate** (D2). It links the table whose
  columns are `Module Name`/`Reference Link`; no concept↔creative_modules junction exists.
- **Whether anything imports `AI Characters / Personas`** (D3). The table is absent from
  `TABLE_MAPPINGS` by id and by name; the `ai_characters` pairing rests on field correspondence only.
- **Whether `DONT USE Creative Sheet` should seed anything** (D4). Its own name says not to use it.
- **Whether the parent is meant to define a themes table** (D2). It defines none.
- **Row data of any kind.** Not fetched and not in scope.
- **Whether any brand has already detached a column.** Nothing in this base expresses attachment or
  detachment; `overridden_fields` in `packages/db/src/columns.ts:38-43` tracks per-**row** field
  edits for propagation, which is a different mechanism from the per-**column** inheritance this
  audit serves. I found no column-level attach/detach state anywhere I read.

## Seeding notes

- Field order above is the API's own order and is what `display_order` should take.
- 31 target columns are marked `candidate`: the parent field name differs from the Gratsi field name
  the mapping is keyed to, so the column is inferred from the schema rather than read from
  `TABLE_MAPPINGS`. Each says so in its Basis cell. 107 are read straight from the mapping and 24
  match a schema column name exactly.
- The 22 LOOKUP fields are reads through a link. Only one is materialised as a column in Drizzle:
  `Creative Sheet (Internal & Interface)` field 6 `Batch (from Concepts)` → `creative_briefs.batch`.
- The parent defines no `brands`, `users`, `memberships` or any other platform table. It is content
  tables only.
