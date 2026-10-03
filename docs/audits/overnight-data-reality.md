# Overnight audit — the data reality, per table per brand, in production

Subagent C, 2026-10-03. Repo `/Users/macbook/tallas-tas` at `0ae92cb` (clean). Every number below comes
from a `SELECT` against the production `DATABASE_URL` read in-process (the session set
`default_transaction_read_only = on` before every query) and, where stated, from a `GET` against the
Airtable REST API. No source file, migration or row was written.

**The table list is derived, not typed.** The 21 content tables are exactly the 21 schema files under
`packages/db/src/schema/` that spread `propagationColumns()` onto their primary `pgTable`, attributed
mechanically (each spread assigned to the nearest preceding `pgTable` name):
`ai-characters.ts:19`, `angles.ts:22`, `campaigns.ts:32`, `client-asset-folders.ts:21`,
`collections.ts:21`, `competitive-research.ts:16`, `concepts.ts:46`, `copy-types.ts:28`, `copy.ts:61`,
`briefs.ts:79`, `creative-dimensions.ts:17`, `creative-modules.ts:25`, `creative-reporting.ts:43`,
`creative-sheet-items.ts:61`, `creators.ts:86`, `email-campaigns.ts:37`, `email-flows.ts:36`,
`personas.ts:18`, `products.ts:15`, `sm-campaign-feed-tasks.ts:29`, `youtube-copy.ts:56`.
All 21 exist live with 493 columns total in `information_schema.columns`.
`themes` is deliberately outside that set — it is the GLOBAL library (CLAUDE.md non-negotiable 3) and
carries no `propagationColumns()`; it is audited separately below.

Plumbing excluded from every per-column list, per the brief: `id`, `brand_id`, `created_at`,
`updated_at`, `created_by`, `updated_by`, `deleted_at`, `template_row_id`, `overridden_fields`,
`custom_fields`. `legacy_airtable_id` is **kept** in the lists, because its presence or absence is the
single cleanest proof of whether a row was migrated from Airtable or seeded by hand.

## The headline, before the tables

**The owner's thesis — "the data is fine, only the presentation is wrong" — is true for 8 of the 21
content tables and false for the other 13.** It holds, and holds well, where it was tested (personas).
It does not generalise.

1. **13 of 21 content tables have zero rows for all six brands.** Ten of those are empty in the Gratsi
   Airtable base as well, so there is nothing to present and nothing lost. **Two are not:
   `creative_sheet_items` (377 Airtable records) and `creative_modules` (35 Airtable records) hold real
   Gratsi data that was never imported.** `ai_characters` has no Gratsi source table at all.
2. **The PARENT template brand has zero rows in all 21 content tables and in every junction table.**
   This is consistent with the settled design (the parent defines the column set, which will live in
   `column_definitions`, not in parent data rows), but it means there is no parent row anywhere to seed
   a column set *from data*. The parent's column set has to come from the parent Airtable base's field
   lists, not from Postgres.
3. **Niagara Sleep Solutions is not a migrated client. It is the development seed.** Every Niagara row
   has `created_by = 'user_seed_strategist'` and `legacy_airtable_id IS NULL`; every Gratsi row has
   `created_by = 'airtable-migration'` and a non-null `legacy_airtable_id`. Niagara's richer column
   coverage is a property of the fixture, not evidence about what a real brand fills in. **Seeding a
   per-brand column config from "what Niagara populates" would be seeding from fixtures.**
4. **Mattress Central, Funky Painting and `test` have zero content rows of any kind.** They exist only
   in `brands`, `brand_assignments`, `promotion_requests` and (for `test`) `interface_pages` /
   `interface_fields` / `notification_settings`.
5. **No `(table, brand)` pair is an EMPTY SHELL.** Every pair that has rows has at least one populated
   non-plumbing column. The pathology the brief anticipated does not occur in production.
6. **Zero soft-deleted rows exist anywhere** in the 21 content tables (697 live, 697 total). A Phase 7
   comparison can therefore use plain `count(*)`.

### Three findings that are not row counts, and that the seed must not trip over

**A. `personas.passion` exists in production but migration `0044_personas-passion` is NOT recorded as
applied.** `drizzle.__drizzle_migrations` holds 44 rows; `drizzle/meta/_journal.json` holds 45 entries.
Hashing each `drizzle/*.sql` file and matching against the stored hashes puts the last applied
migration at `0043_brief-due-date` (2026-10-03T22:40:00Z). Yet `personas.passion` is present in
`information_schema.columns`. `packages/db/drizzle/0044_personas-passion.sql` is a single statement with
no `IF NOT EXISTS`:

```sql
ALTER TABLE "personas" ADD COLUMN "passion" text;
```

So the column was applied to production outside Drizzle's ledger, and the next `drizzle-kit migrate`
against production will attempt it again and fail with `column "passion" of relation "personas" already
exists`. I could not establish from the repository *who or what* applied that DDL.

**B. The `Passion` → `core_desires` displacement bug the brief cites is NOT present in production data.
The data is correct. What is missing is `Passion` itself.** Verified row by row against Airtable
(`appllDG4OmkK2Hdnn` / `tblyt7X4VjHxtMDVS`, 28 records, no pagination offset), joining on
`personas.legacy_airtable_id`:

| check | result |
|---|---|
| Gratsi persona rows in Postgres | 28 |
| `legacy_airtable_id` not found in Airtable | 0 |
| `core_desires` matches Airtable `Drivers for this persona` (whitespace-normalised, case-folded) | **23** |
| `core_desires` matches Airtable `Passion` | **0** |
| `core_desires` matches neither | 0 |
| `core_desires` NULL (and Airtable `Drivers for this persona` empty) | 5 |
| Airtable records with non-empty `Passion` | **23** |
| Postgres `personas.passion` non-null, Gratsi | **0** |

`packages/db/src/scripts/import-mappings.ts:235-244` now maps `'Drivers for this persona'` →
`coreDesires` and `Passion` → `passion`, with the comment "its own column since 0044, never folded into
a neighbour". The mapping is right and the stored `core_desires` is right. **But 23 real values of
Gratsi's `Passion` field have never reached production.** This is a column-level data absence inside a
table the thesis counts as healthy.

**C. Six Airtable table IDs mean DIFFERENT tables in the Gratsi base and the parent base, and two of
them are a straight Angles/Concepts swap.** Airtable table IDs are unique per base, not globally, and
these two bases share a common ancestor, so the IDs collide. `import-mappings.ts:2` declares itself the
map "for the Gratsi base (appllDG4OmkK2Hdnn)" and keys every table by `airtableTableId`. Re-pointing
that map at the parent base to harvest the parent's column set would silently read the wrong tables:

| table id | Gratsi base name | parent base name | same underlying table? |
|---|---|---|---|
| `tbl4UFSFcynlS2Pkn` | Concepts | **Angles** | **No — swapped** |
| `tblRlcp1ibmS7U7HG` | Angles | **Concepts** | **No — swapped** |
| `tblzS73a9JrJGiV2J` | (Internal) Creative Modules | Themes | Yes — same table, different label |
| `tblGC0TxnHI7lKaNQ` | Creative Sheet | DONT USE Creative Sheet | Yes — parent's copy is marked unusable |
| `tblZpBYPTcZcmQ1Kf` | Meta Copywriting | Copywriting | Yes |
| `tblhU5yVNhVDwykUt` | Creative Design (Internal & Interface) | Creative Sheet (Internal & Interface) | Yes |

The first two are a genuine swap, confirmed by field sets, not by names: Gratsi `tbl4UFSFcynlS2Pkn`
carries `Batch`, `Theme`, `Style`, `Script`, `Hooks`, `Production Status` (concept fields) while the
parent's `tbl4UFSFcynlS2Pkn` carries `Pain Points`, `USP`, `Description`, `Concepts` (angle fields);
and the mirror holds for `tblRlcp1ibmS7U7HG`. `import-mappings.ts:259-260` maps `angles` →
`tblRlcp1ibmS7U7HG` and `:333-334` maps `concepts` → `tbl4UFSFcynlS2Pkn`, which is correct for Gratsi
and exactly inverted for the parent.

`tblzS73a9JrJGiV2J` is the level-shift the plan doc flags: it is the SAME table in both bases (primary
field `Module Name`, a `Concepts` link in both), but the parent calls it **Themes** and Gratsi calls it
**(Internal) Creative Modules**. Its 59 parent rows read as modules, not themes — "Special Discount
Module", "Green Screen Module", "Carousel Module", "Before & After". Gratsi additionally has a separate
real `Themes` table (`tbl1aFLMJXxhdVKiz`, 3 records) that the parent does not have at all. **Whether
the product's global `themes` library corresponds to the parent's "Themes" (= modules) or to Gratsi's
`Themes` is AMBIGUOUS and I am not guessing it.** It needs an explicit decision; see the decision
queue at the end.

## Summary matrix — rows / populated non-plumbing columns, by brand

`N / Mc` reads "N live rows, M of this table's non-plumbing columns carry at least one value for this
brand". The Airtable column is the Gratsi base (`appllDG4OmkK2Hdnn`), counted through the REST API with
full pagination.

| table | cols | Parent | Gratsi | Niagara | Mattress | Funky | test | Gratsi Airtable rows | verdict |
|---|---|---|---|---|---|---|---|---|---|
| `ai_characters` | 13 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | n/a | NO ROWS — no Gratsi source table |
| `angles` | 15 | NO ROWS | 43 / 6c | 5 / 11c | NO ROWS | NO ROWS | NO ROWS | 43 | DATA PRESENT |
| `campaigns_offers` | 14 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `client_asset_folders` | 4 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `collections` | 9 | NO ROWS | 5 / 2c | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 5 | DATA PRESENT |
| `competitive_research` | 8 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `concepts` | 18 | NO ROWS | 102 / 15c | 4 / 10c | NO ROWS | NO ROWS | NO ROWS | 102 | DATA PRESENT |
| `copy_types` | 3 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `copywriting` | 17 | NO ROWS | NO ROWS | 4 / 11c | NO ROWS | NO ROWS | NO ROWS | 0 | DATA PRESENT — **seed fixture only, no Gratsi rows** |
| `creative_briefs` | 43 | NO ROWS | 390 / 32c | 7 / 25c | NO ROWS | NO ROWS | NO ROWS | 390 | DATA PRESENT |
| `creative_dimensions` | 5 | NO ROWS | 22 / 3c | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 22 | DATA PRESENT |
| `creative_modules` | 3 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 35 | **NO ROWS — 35 rows exist in Airtable, NOT IMPORTED** |
| `creative_reporting` | 13 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `creative_sheet_items` | 14 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 377 | **NO ROWS — 377 rows exist in Airtable, NOT IMPORTED** |
| `creators` | 40 | NO ROWS | 70 / 31c | 5 / 31c | NO ROWS | NO ROWS | NO ROWS | 70 | DATA PRESENT |
| `email_campaigns` | 13 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `email_flows` | 11 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `personas` | 17 | NO ROWS | 28 / 6c | 3 / 15c | NO ROWS | NO ROWS | NO ROWS | 28 | DATA PRESENT |
| `products` | 4 | NO ROWS | 6 / 3c | 3 / 3c | NO ROWS | NO ROWS | NO ROWS | 6 | DATA PRESENT |
| `sm_campaign_feed_tasks` | 6 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |
| `youtube_copy` | 13 | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | NO ROWS | 0 | NO ROWS — empty at source too |

Totals: **697 live rows** across the 21 content tables, all of them Gratsi (666) or Niagara (31).
Across all 21 tables and all rows: `template_row_id` set on **0**, `overridden_fields` non-`[]` on
**0**, `custom_fields` non-`{}` on **0**, `deleted_at` non-null on **0**. This extends
`existing-inheritance-2026-10-02.md:279`, which checked 591 rows across 5 tables and found the same;
its arithmetic is correct (`personas` 31 + `products` 9 + `angles` 48 + `concepts` 106 +
`creative_briefs` 397 = 591) and its conclusion survives the extension to all 21 tables and 697 rows.
I found no error in it.

## Per table, per brand, per column


### `ai_characters` — 13 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: **no such table in the Gratsi base**.

### `angles` — 15 non-plumbing columns

**Gratsi — 43 rows, 6 of 15 columns carry a value**

- populated: `name` 43/43, `description` 31/43, `winning` 43/43, `client_notes` 1/43, `legacy_airtable_id` 43/43, `status` 31/43
- non-null but EMPTY (jsonb `[]`/`{}` or blank text, so renders as a blank column): `type` 43/43, `formats` 43/43, `ad_inspo_links` 43/43
- all-NULL: `pain_points`, `usp`, `potential`, `internal_notes`, `brief_url`, `exact_script_url`

**Niagara — 5 rows, 11 of 15 columns carry a value**

- populated: `name` 5/5, `description` 5/5, `pain_points` 5/5, `usp` 5/5, `type` 5/5, `formats` 5/5, `ad_inspo_links` 5/5, `potential` 5/5, `winning` 5/5, `internal_notes` 5/5, `client_notes` 3/5
- all-NULL: `legacy_airtable_id`, `brief_url`, `exact_script_url`, `status`


### `campaigns_offers` — 14 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `client_asset_folders` — 4 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `collections` — 9 non-plumbing columns

**Gratsi — 5 rows, 2 of 9 columns carry a value**

- populated: `name` 5/5, `legacy_airtable_id` 5/5
- all-NULL: `url`, `campaign_id`, `angle_id`, `product_id`, `creative_design_note`, `copywriting_id`, `creative_design_2_id`


### `competitive_research` — 8 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `concepts` — 18 non-plumbing columns

**Gratsi — 102 rows, 15 of 18 columns carry a value**

- populated: `name` 102/102, `batch` 27/102, `category` 102/102, `concept_style` 102/102, `hook_examples` 85/102, `script_idea` 88/102, `formats` 102/102, `internal_status` 102/102, `client_status` 102/102, `legacy_airtable_id` 102/102, `approval_status` 101/102, `production_status` 73/102, `description` 102/102, `pain_points` 102/102, `usp` 90/102
- non-null but EMPTY (jsonb `[]`/`{}` or blank text, so renders as a blank column): `ad_inspo_links` 102/102, `formats_to_create` 102/102
- all-NULL: `client_comments`

**Niagara — 4 rows, 10 of 18 columns carry a value**

- populated: `name` 4/4, `batch` 4/4, `category` 4/4, `concept_style` 4/4, `hook_examples` 4/4, `script_idea` 4/4, `formats` 4/4, `ad_inspo_links` 4/4, `internal_status` 4/4, `client_status` 4/4
- non-null but EMPTY (jsonb `[]`/`{}` or blank text, so renders as a blank column): `formats_to_create` 4/4
- all-NULL: `legacy_airtable_id`, `approval_status`, `production_status`, `description`, `pain_points`, `usp`, `client_comments`


### `copy_types` — 3 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `copywriting` — 17 non-plumbing columns

**Niagara — 4 rows, 11 of 17 columns carry a value**

- populated: `creative_brief_id` 3/4, `copy_number` 4/4, `primary_copy` 4/4, `headline` 4/4, `link_description` 4/4, `cta` 4/4, `status` 4/4, `client_comment` 1/4, `used` 4/4, `winning` 4/4, `click_for_ai_spell_checker` 4/4
- all-NULL: `legacy_airtable_id`, `product_id`, `funnel`, `meta_rating`, `spelling_feedback`, `concept_id`


### `creative_briefs` — 43 non-plumbing columns

**Gratsi — 390 rows, 32 of 43 columns carry a value**

- populated: `concept_id` 377/390, `name` 390/390, `batch` 386/390, `source` 390/390, `funnel` 390/390, `type` 390/390, `version` 390/390, `sequence` 390/390, `priority` 380/390, `brief_to_design` 388/390, `script_content` 263/390, `elements_tested` 370/390, `dimensions` 361/390, `platform` 334/390, `design_file_url` 205/390, `qa_video_editor` 390/390, `qa_designer` 390/390, `qa_strategist` 390/390, `spelling_feedback` 26/390, `internal_status` 390/390, `client_status` 390/390, `performance` 61/390, `legacy_airtable_id` 390/390, `angle_id` 386/390, `product_id` 84/390, `click_for_ai_spell_checker` 390/390, `inspiration_image` 16/390, `qa_checklist_doc` 390/390, `design_file` 321/390, `language` 124/390, `offer` 4/390, `collection_id` 6/390
- non-null but EMPTY (jsonb `[]`/`{}` or blank text, so renders as a blank column): `inspo_links` 390/390
- all-NULL: `assignee`, `spelling_feedback_2`, `ad_content`, `inspiration`, `script_and_brief_breakdown`, `campaign_offer_id`, `asset_id`, `launched_at`, `launch_priority`, `due_date`

**Niagara — 7 rows, 25 of 43 columns carry a value**

- populated: `concept_id` 6/7, `name` 7/7, `batch` 7/7, `source` 7/7, `funnel` 7/7, `type` 7/7, `version` 7/7, `sequence` 7/7, `priority` 7/7, `assignee` 7/7, `brief_to_design` 7/7, `script_content` 7/7, `elements_tested` 7/7, `inspo_links` 6/7, `dimensions` 7/7, `platform` 7/7, `design_file_url` 5/7, `qa_video_editor` 7/7, `qa_designer` 7/7, `qa_strategist` 7/7, `spelling_feedback` 1/7, `internal_status` 7/7, `client_status` 7/7, `performance` 2/7, `click_for_ai_spell_checker` 7/7
- all-NULL: `legacy_airtable_id`, `angle_id`, `product_id`, `spelling_feedback_2`, `ad_content`, `inspiration`, `inspiration_image`, `qa_checklist_doc`, `design_file`, `script_and_brief_breakdown`, `language`, `offer`, `collection_id`, `campaign_offer_id`, `asset_id`, `launched_at`, `launch_priority`, `due_date`


### `creative_dimensions` — 5 non-plumbing columns

**Gratsi — 22 rows, 3 of 5 columns carry a value**

- populated: `name` 22/22, `dimensions` 20/22, `legacy_airtable_id` 22/22
- all-NULL: `link_description`, `creative_design_id`


### `creative_modules` — 3 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 35 records.

### `creative_reporting` — 13 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `creative_sheet_items` — 14 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 377 records.

### `creators` — 40 non-plumbing columns

**Gratsi — 70 rows, 31 of 40 columns carry a value**

- populated: `name` 70/70, `age_bracket` 27/70, `gender` 33/70, `ethnicity` 27/70, `profile_pic_url` 27/70, `video_intro_url` 52/70, `platform` 64/70, `internal_brief` 18/70, `shipping_location` 35/70, `tracking_number` 13/70, `date_of_management` 38/70, `creator_cost` 27/70, `internal_creator_status` 70/70, `client_status` 70/70, `internal_assets_status` 70/70, `client_note` 15/70, `instagram_username` 5/70, `for_partnership_ads` 70/70, `partnership_activity` 70/70, `partnership_activated_at` 6/70, `partnership_period_days` 9/70, `continue_working_with` 6/70, `extension_days` 70/70, `partnership_price_per_30_days` 5/70, `partnership_notes` 1/70, `facebook_profile_url` 49/70, `legacy_airtable_id` 70/70, `cost_usd` 23/70, `slack_notified` 70/70, `requires_attention` 70/70, `payment_date` 23/70
- non-null but EMPTY (jsonb `[]`/`{}` or blank text, so renders as a blank column): `concept_ids` 70/70, `product_ids` 70/70
- all-NULL: `creator_link`, `deadline`, `budget_per_60s`, `raw_assets_url`, `current_period_start`, `partnership_ended_at`, `creator_info_request`

**Niagara — 5 rows, 31 of 40 columns carry a value**

- populated: `name` 5/5, `age_bracket` 5/5, `gender` 5/5, `ethnicity` 5/5, `profile_pic_url` 4/5, `video_intro_url` 4/5, `creator_link` 5/5, `platform` 5/5, `internal_brief` 5/5, `shipping_location` 5/5, `tracking_number` 5/5, `date_of_management` 5/5, `deadline` 5/5, `budget_per_60s` 5/5, `creator_cost` 5/5, `internal_creator_status` 5/5, `client_status` 5/5, `internal_assets_status` 5/5, `client_note` 3/5, `instagram_username` 4/5, `for_partnership_ads` 5/5, `partnership_activity` 5/5, `partnership_activated_at` 3/5, `partnership_period_days` 3/5, `continue_working_with` 3/5, `extension_days` 5/5, `partnership_price_per_30_days` 3/5, `partnership_notes` 3/5, `facebook_profile_url` 2/5, `slack_notified` 5/5, `requires_attention` 5/5
- non-null but EMPTY (jsonb `[]`/`{}` or blank text, so renders as a blank column): `concept_ids` 5/5, `product_ids` 5/5
- all-NULL: `legacy_airtable_id`, `raw_assets_url`, `cost_usd`, `current_period_start`, `partnership_ended_at`, `payment_date`, `creator_info_request`


### `email_campaigns` — 13 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `email_flows` — 11 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `personas` — 17 non-plumbing columns

**Gratsi — 28 rows, 6 of 17 columns carry a value**

- populated: `name` 28/28, `demographic` 25/28, `psychographic` 20/28, `core_desires` 23/28, `stage_of_awareness` 14/28, `legacy_airtable_id` 28/28
- all-NULL: `product_id`, `day_in_the_life`, `emotional_triggers`, `pain_points`, `success_factors`, `perceived_barriers`, `buying_triggers`, `problem_challenge`, `success_transformation`, `trigger_words`, `passion`

**Niagara — 3 rows, 15 of 17 columns carry a value**

- populated: `product_id` 3/3, `name` 3/3, `day_in_the_life` 3/3, `demographic` 3/3, `psychographic` 3/3, `core_desires` 3/3, `emotional_triggers` 3/3, `pain_points` 3/3, `success_factors` 3/3, `perceived_barriers` 3/3, `stage_of_awareness` 3/3, `buying_triggers` 3/3, `problem_challenge` 3/3, `success_transformation` 3/3, `trigger_words` 3/3
- all-NULL: `legacy_airtable_id`, `passion`


### `products` — 4 non-plumbing columns

**Gratsi — 6 rows, 3 of 4 columns carry a value**

- populated: `name` 6/6, `link` 1/6, `legacy_airtable_id` 6/6
- all-NULL: `collection_link`

**Niagara — 3 rows, 3 of 4 columns carry a value**

- populated: `name` 3/3, `link` 3/3, `collection_link` 2/3
- all-NULL: `legacy_airtable_id`


### `sm_campaign_feed_tasks` — 6 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.

### `youtube_copy` — 13 non-plumbing columns

No rows for any of the six brands. Gratsi Airtable source: 0 records.
## `themes` — the global library, audited on its own

`themes` is the one content table outside the 21: `packages/db/src/schema/themes.ts:18` declares it with
no `propagationColumns()`, and all 9 production rows have `brand_id IS NULL`, which is exactly what
CLAUDE.md non-negotiable 3 requires.

Live columns beyond plumbing: `name`, `reference_links` (jsonb), `notes`, `category`
(`theme_category` enum), `legacy_airtable_id`, `assignee_id`, `status`, `attachments` (jsonb),
`ai_attachment_summary`, `is_active`.

9 rows, by name: `Green Screen`, `Holiday Gifting`, `POV: X vs Y`, `Problem/Solution`,
`Spring x Soccer`, `Untitled`, `Untitled`, `Untitled`, `Yapper Style`.

Only **3** of the 9 carry a `legacy_airtable_id` (`recRzNHDESBuhIfEE`, `rec7BInM4DEyMxWDU`,
`recRyhNznZ8r8eND7`) — and those three are precisely the three named `Untitled`. The other six were
seeded by hand.

**The three `Untitled` rows are a faithful import, not an import bug.** Gratsi's Airtable `Themes`
table (`tbl1aFLMJXxhdVKiz`) holds exactly 3 records, and on all three every field is empty except the
`aiText` field `Attachment Summary`, which is itself in an error state
(`{"state":"error","errorType":"emptyDependency","value":null}`). The source `Name` really is blank, so
the importer's `default: 'Untitled'` fired correctly. **The content is absent at source.** Presenting
these better is not possible; someone has to fill them in, in Airtable or in the app.

**Separately: the parent base's table labelled "Themes" holds 59 rows that are not in production at
all.** Those 59 rows are module names, not theme names (see finding C). Whether they belong in `themes`
or in `creative_modules` is the open decision.

## Junction tables

Junctions back the two-way link columns. A column config that lists a link column while its junction is
empty renders a blank column, so these counts are part of the evidence base for the seed. Junctions are
not brand-scoped; the brand pairing below is derived by joining through to each endpoint's `brand_id`.

| junction | rows | brand pairing (left → right) | distinct left | distinct right | orphan FKs |
|---|---|---|---|---|---|
| `angle_personas` | **78** | Gratsi→Gratsi 73, Niagara→Niagara 5 | 37 angles | 27 personas | 0 |
| `angle_products` | **57** | Gratsi→Gratsi 52, Niagara→Niagara 5 | 39 angles | 9 products | 0 |
| `concept_angles` | **115** | Gratsi→Gratsi 111, Niagara→Niagara 4 | 87 concepts | 38 angles | 0 |
| `concept_collections` | **207** | Gratsi→Gratsi 207 | 69 concepts | **3 collections** | 0 |
| `concept_themes` | **4** | **Niagara→(global) 4 only** | 4 concepts | 4 themes | 0 |
| `creator_concepts` | **87** | Gratsi→Gratsi 87 | 47 creators | 33 concepts | 0 |
| `creator_products` | **0** | — | 0 | 0 | 0 |
| `brief_asset_folders` | 0 | — | 0 | 0 | 0 |
| `campaign_concepts` | 0 | — | — | — | — |
| `copywriting_campaigns` | 0 | — | — | — | — |
| `copywriting_copy_types` | 0 | — | — | — | — |
| `creative_module_angles` | 0 | — | — | — | — |
| `creative_module_designs` | 0 | — | — | — | — |
| `email_campaign_campaigns` | 0 | — | — | — | — |
| `email_campaign_collections` | 0 | — | — | — | — |
| `email_campaign_products` | 0 | — | — | — | — |
| `email_flow_campaigns` | 0 | — | — | — | — |
| `youtube_copy_campaigns` | 0 | — | — | — | — |
| `youtube_copy_collections` | 0 | — | — | — | — |
| `youtube_copy_copy_types` | 0 | — | — | — | — |

That is 20 junction tables, 6 of them populated. Notes that bear on the seed:

- **No cross-brand link exists** (every populated junction pairs a row with a row of the same brand),
  and **no orphan FK exists**, and **no junction row points at a soft-deleted parent**. Referential
  hygiene is clean.
- **`concept_themes` is Gratsi-empty.** All 4 rows are Niagara's. Gratsi's 102 concepts have zero theme
  links, so a "Themes" link column on Gratsi's concepts grid renders blank for every row — even though
  Gratsi's Airtable Concepts table has a `Theme<multipleSelects>` field (not a link; see below).
- **`concept_collections` has 207 rows pointing at only 3 distinct collections**, out of the 5
  collections that exist. Two Gratsi collections have no concepts.
- **`creator_products` is empty**, while `creators.product_ids` (jsonb) is non-null-but-`[]` on all 75
  creator rows. The creators "Products" link column is blank for every brand through both paths.
- **No junction table has `deleted_at`** (`packages/db/src/schema/junction-tables.ts` uses a bare
  two-column `primaryKey`). That contradicts CLAUDE.md's "every table has … `deleted_at` (soft
  delete). No exceptions." It is out of scope here, but a soft-delete of a link is not representable
  today.
- Gratsi's Airtable Concepts `Theme` field is `multipleSelects`, not `multipleRecordLinks`
  (`tbl4UFSFcynlS2Pkn`, field list read from the meta API). A select is not backed by a junction. That
  is a classification question for subagent B, not a data defect.

## Other brand-scoped tables (non-content), for completeness

| table | rows | by brand |
|---|---|---|
| `brand_assignments` | 14 | Niagara 4, Mattress Central 4, Gratsi 4, Funky Painting 2 |
| `promotion_requests` | 5 | Niagara 1, Mattress Central 2, Gratsi 1, Funky Painting 1 |
| `interface_fields` | 51 | Niagara 23, test 28 |
| `interface_pages` | 11 | Niagara 5, test 6 |
| `notification_settings` | 16 | Niagara 8, test 8 |
| `user_view_preferences` | 11 | Niagara 4, Gratsi 6, test 1 |
| `custom_field_schemas` | **0** | — |
| `propagation_runs` | **0** | — |
| `activity_log`, `ad_metrics`, `annotations`, `assets`, `collaboration_instances`, `comments`, `competitor_ads`, `creator_rankings`, `notification_log`, `onboarding_forms`, `upload_links` | 0 | — |

Two of these matter to the inheritance work:

- **`custom_field_schemas` is completely empty in production (0 rows).** The mechanism the plan doc
  considers borrowing from has never been exercised with real data.
- **`interface_fields` has 51 rows, for Niagara and `test` only — neither of which is a real client, and
  Gratsi has none.** The label/visible/position triple the plan borrows is proven in code but not in
  client data.
- **The parent brand `b993e8c3-…` appears in no brand-scoped table except `brands` itself.**

## Tables where data is genuinely absent

Three distinct kinds. Only the first is a loss.

### 1. Real Gratsi data that exists in Airtable and was never imported

| table | Postgres rows | Gratsi Airtable rows | source table |
|---|---|---|---|
| `creative_sheet_items` | **0** | **377** | `tblGC0TxnHI7lKaNQ` "Creative Sheet" |
| `creative_modules` | **0** | **35** | `tblzS73a9JrJGiV2J` "(Internal) Creative Modules" |

Both are mapped in `import-mappings.ts` (`:973-975` and `:946-948`), so the field maps exist; the rows
simply are not there. `creative_sheet_items` is the second-largest table in the Gratsi base after
Creative Design (390). Its Airtable field list is dominated by `multipleLookupValues` — 13 of its 29
fields — so a large part of it is DERIVED under the classification law and would resolve through links
plus the read-time formula layer rather than through stored columns. **But `Internal Status`, `Status`,
`QA Checklist Doc`, the three QA checkboxes, `Client's Comments`, `Used`, `Denied/revisions needed`,
`Winning`, `Click for AI Spell Checker Again` and `Spelling Feedback` are stored, first-class fields on
377 real records, and they are missing.** `creative_modules` has only 4 Airtable fields
(`Module Name`, `Concepts`, `Foreplay Link`, `(Internal) Creative Design`), so its 35 rows are cheap to
recover.

Plus the column-level case from finding B:

| table | column | Postgres non-null | Airtable non-empty | source field |
|---|---|---|---|---|
| `personas` | `passion` | **0** | **23 of 28** | `Passion` (richText) |

### 2. Empty at source — nothing lost, nothing to present

Ten tables are empty in Postgres *and* in the Gratsi Airtable base, so there is no presentation problem
and no migration gap:

`campaigns_offers` (`tblRNaWCVa1cCIwLL`, 0 records), `client_asset_folders` (`tbldFmPU6AWg62Fll`, 0),
`competitive_research` (`tbl9W6v78tKWznN9S`, 0), `copy_types` (`tblQiBPj9ypCmYxev`, 0),
`copywriting` (`tblZpBYPTcZcmQ1Kf` "Meta Copywriting", 0 — Postgres has 4 Niagara *seed* rows and no
Gratsi rows), `creative_reporting` (`tblgW4bwDSSeqihlr`, 0), `email_campaigns` (`tblABjVpwRpYtY7de`, 0),
`email_flows` (`tblubVflAQZgJSxcF`, 0), `sm_campaign_feed_tasks` (`tblLRajTW55XEhVhk`, 0),
`youtube_copy` (`tblVR1UmkbDoDzJ7z`, 0).

Each of these tables still has a field list in Airtable — `youtube_copy` has 29 fields,
`campaigns_offers` 20, `creative_reporting` 14 — so the parent's master column set for them must be
derived from the field definitions, never from the rows. There are no rows.

### 3. No source table at all

`ai_characters` — **the Gratsi base has no AI Characters table.** The source exists only in the parent
base, as `tblgfe8A7nmce6lzn` "AI Characters / Personas" (12 fields, **1 record**), and there is no entry
for it anywhere in `import-mappings.ts` (grep for `aiCharacters`, `ai_characters` and `AI Character`
returns nothing in `import-mappings.ts` or `packages/db/src/airtable-import.ts`). Its 13 Postgres
columns map one-to-one onto the parent table's 12 fields plus `legacy_airtable_id`, so the schema was
written from that parent table by hand. The table is correct and simply unused.

Also worth recording: the parent base holds one template row in most tables (`UGC Management` 1,
`Personas` 1, `(Internal) Collections` 1, `(Internal) Product` 1, `Campaigns & Offers` 1,
`Client Assets Organisation` 1, `AI Characters / Personas` 1, `Concepts` 3, `Angles` 3,
`Creative Sheet (Internal & Interface)` 4, `(Internal) Creative Dimensions` 21, `Themes` 59,
`Copywriting` 0, `Competitive research` 0, `DONT USE Creative Sheet` 1) and **none of it is in
Postgres**. That is by design under the settled plan — the parent contributes columns, not rows — but it
is worth stating plainly so nobody later reads the parent's 0 Postgres rows as data loss.

## Columns populated for some brands only

These are exactly the columns a per-brand column config must be able to hide, and they are the evidence
base for the seed. Only Gratsi and Niagara have rows anywhere, so "diverges" can only ever mean "Gratsi
but not Niagara" or the reverse — and Niagara is the seed fixture, so the right reading of every row
below is **"Gratsi, the only real client, leaves this blank"** or **"Gratsi fills this and the fixture
does not"**.

**`angles`** — both Gratsi and Niagara have rows; 9 columns diverge.

| column | type | populated for | empty for |
|---|---|---|---|
| `pain_points` | text | Niagara 5/5 | Gratsi |
| `usp` | text | Niagara 5/5 | Gratsi |
| `type` | jsonb | Niagara 5/5 | Gratsi |
| `formats` | jsonb | Niagara 5/5 | Gratsi |
| `ad_inspo_links` | jsonb | Niagara 5/5 | Gratsi |
| `potential` | text | Niagara 5/5 | Gratsi |
| `internal_notes` | text | Niagara 5/5 | Gratsi |
| `legacy_airtable_id` | text | Gratsi 43/43 | Niagara |
| `status` | text | Gratsi 31/43 | Niagara |

**`concepts`** — both Gratsi and Niagara have rows; 7 columns diverge.

| column | type | populated for | empty for |
|---|---|---|---|
| `ad_inspo_links` | jsonb | Niagara 4/4 | Gratsi |
| `legacy_airtable_id` | text | Gratsi 102/102 | Niagara |
| `approval_status` | text | Gratsi 101/102 | Niagara |
| `production_status` | text | Gratsi 73/102 | Niagara |
| `description` | text | Gratsi 102/102 | Niagara |
| `pain_points` | text | Gratsi 102/102 | Niagara |
| `usp` | text | Gratsi 90/102 | Niagara |

**`creative_briefs`** — both Gratsi and Niagara have rows; 11 columns diverge.

| column | type | populated for | empty for |
|---|---|---|---|
| `assignee` | text | Niagara 7/7 | Gratsi |
| `inspo_links` | jsonb | Niagara 6/7 | Gratsi |
| `legacy_airtable_id` | text | Gratsi 390/390 | Niagara |
| `angle_id` | uuid | Gratsi 386/390 | Niagara |
| `product_id` | uuid | Gratsi 84/390 | Niagara |
| `inspiration_image` | jsonb | Gratsi 16/390 | Niagara |
| `qa_checklist_doc` | jsonb | Gratsi 390/390 | Niagara |
| `design_file` | jsonb | Gratsi 321/390 | Niagara |
| `language` | text | Gratsi 124/390 | Niagara |
| `offer` | text | Gratsi 4/390 | Niagara |
| `collection_id` | uuid | Gratsi 6/390 | Niagara |

**`creators`** — both Gratsi and Niagara have rows; 6 columns diverge.

| column | type | populated for | empty for |
|---|---|---|---|
| `creator_link` | text | Niagara 5/5 | Gratsi |
| `deadline` | timestamptz | Niagara 5/5 | Gratsi |
| `budget_per_60s` | int4 | Niagara 5/5 | Gratsi |
| `legacy_airtable_id` | text | Gratsi 70/70 | Niagara |
| `cost_usd` | int4 | Gratsi 23/70 | Niagara |
| `payment_date` | timestamptz | Gratsi 23/70 | Niagara |

**`personas`** — both Gratsi and Niagara have rows; 11 columns diverge.

| column | type | populated for | empty for |
|---|---|---|---|
| `product_id` | uuid | Niagara 3/3 | Gratsi |
| `day_in_the_life` | text | Niagara 3/3 | Gratsi |
| `emotional_triggers` | text | Niagara 3/3 | Gratsi |
| `pain_points` | text | Niagara 3/3 | Gratsi |
| `success_factors` | text | Niagara 3/3 | Gratsi |
| `perceived_barriers` | text | Niagara 3/3 | Gratsi |
| `buying_triggers` | text | Niagara 3/3 | Gratsi |
| `problem_challenge` | text | Niagara 3/3 | Gratsi |
| `success_transformation` | text | Niagara 3/3 | Gratsi |
| `trigger_words` | text | Niagara 3/3 | Gratsi |
| `legacy_airtable_id` | text | Gratsi 28/28 | Niagara |

**`products`** — both Gratsi and Niagara have rows; 2 columns diverge.

| column | type | populated for | empty for |
|---|---|---|---|
| `collection_link` | text | Niagara 2/3 | Gratsi |
| `legacy_airtable_id` | text | Gratsi 6/6 | Niagara |

### Reading the divergence, for the seed

- **`legacy_airtable_id` diverges in every single table.** Gratsi always has it, Niagara never does.
  That is the provenance split, not a column-config question; the seed should treat
  `legacy_airtable_id` as plumbing even though the brief's exclusion list does not name it.
- **Gratsi leaves `angles.pain_points`, `angles.usp`, `angles.type`, `angles.formats`,
  `angles.potential`, `angles.internal_notes` entirely empty across all 43 rows** — yet the Gratsi
  Airtable Angles table has no `Pain Points` or `USP` field at all (its 21 fields are `Name`, `Status`,
  `Potential`, `Description`, `Creators`, `Concepts`, `Product (from Angles)`, `Personas (from Angles)`,
  `(Internal) Creative Modules`, `Formats to create`, `Client Notes`, `(Internal) Creative Design`,
  `Brief`, `Exact Script`, `Ad Inspo`, `Winning`, `Internal Notes`, `Creative Sheet`,
  `(Internal) Creative Design 2`, `UGC Management copy`, `Concepts copy`). So `pain_points` and `usp`
  are PARENT-ONLY columns on angles for Gratsi — hide them. `Potential`, `Ad Inspo`, `Internal Notes`
  and `Formats to create` DO exist in Gratsi's Airtable but are empty on all 43 records, which is a
  different thing: the column belongs to Gratsi and is simply unused. **The config must distinguish
  "the brand does not have this column" from "the brand has it and it is empty", because hiding the
  second kind would hide a column the client can legitimately start filling.** I could not establish
  that distinction from Postgres alone for any table — it needs the Airtable field list alongside the
  non-null count, which is how the two columns of each table's section above should be read together.
- **`concepts.ad_inspo_links` and `concepts.formats_to_create` are non-null-but-`[]` on all 102 Gratsi
  rows**, as are `angles.type`, `angles.formats`, `angles.ad_inspo_links` on all 43, `creators.concept_ids`
  and `creators.product_ids` on all 75, and `creative_briefs.inspo_links` on all 390. A `count(col)`
  reports these as present. They render blank. Every count in this document distinguishes the two
  (`populated` vs `non-null but EMPTY`), and the seed must use the `populated` number.
- **`creative_briefs` is where the thesis is strongest**: 32 of 43 columns carry values on Gratsi's 390
  rows, including `script_content` 263, `design_file_url` 205, `design_file` 321, `platform` 334,
  `language` 124, `performance` 61. The data is genuinely rich and the presentation is the problem.
- **`collections` is where it is weakest among tables that have rows**: 2 of 9 columns populated on
  Gratsi's 5 rows (`name` and `legacy_airtable_id` only). `url`, `campaign_id`, `angle_id`,
  `product_id`, `creative_design_note`, `copywriting_id`, `creative_design_2_id` are all NULL, although
  Gratsi's Airtable `(Internal) Collections` has 13 fields and 3 of them hold data. A collections grid
  built from the parent's column set would be almost entirely blank for the one brand that has rows.

## Decision queue — the AMBIGUOUS items I did not guess

Per the classification law, these become hidden child-added rows plus a line in a decision doc. I am
recording them, not resolving them.

1. **Does the product's global `themes` library correspond to the parent base's "Themes"
   (`tblzS73a9JrJGiV2J`, 59 rows, field `Module Name`, semantically modules) or to Gratsi's "Themes"
   (`tbl1aFLMJXxhdVKiz`, 3 rows, all blank)?** The same table id is "(Internal) Creative Modules" in
   Gratsi. Postgres has both `themes` (global, 9 rows) and `creative_modules` (per-brand, 0 rows), so
   the schema has already committed to them being two different things — but then the parent base
   supplies a column set for `themes` that is really the modules column set, and supplies nothing for
   `creative_modules` under that name.
2. **Should `import-mappings.ts` be re-keyed by table NAME rather than table ID before anything reads
   the parent base?** Finding C shows the ID route silently swaps Angles and Concepts. I am not
   changing the file; flagging the hazard.
3. **Is `copywriting`'s Gratsi source `Meta Copywriting` (0 records, 30 fields) or does Gratsi simply
   not do Meta copy in Airtable yet?** Postgres' only 4 `copywriting` rows are Niagara seed rows, so
   every stored value in that table today is fixture data.
4. **`ai_characters` has no Gratsi counterpart.** Is it a parent-only table that every child hides by
   default, or a table Gratsi should be given? Its parent source is literally named
   "AI Characters / Personas", which also raises whether it is a separate table or a view of Personas.

## What I could not establish

- **I could not establish who or what applied `personas.passion` to production outside Drizzle's
  ledger.** The column exists, the migration is unrecorded, and nothing in the repository records the
  action.
- **I could not establish whether Gratsi's 23 missing `Passion` values were lost in a past import run
  or simply never re-imported after migration 0044 added the column.** Both are consistent with what I
  can see; the import logs are not in the repository and `propagation_runs` is empty.
- **I could not establish, from Postgres alone, which empty columns are "absent for this brand" versus
  "present but unused".** That needs the Airtable field list joined to the non-null count; I did it by
  hand for `angles` above and did not attempt it for the other 20.
- **I did not audit the four non-Gratsi client Airtable bases.** Niagara, Mattress Central and Funky
  Painting have no `legacy_airtable_id` anywhere in Postgres, so if client bases exist for them I had
  no base id to read and no imported row to join against.
- **I did not verify value-level fidelity for any table other than `personas`.** The row-by-row
  Airtable comparison in finding B was run on personas only; the other tables' numbers are row and
  non-null counts, which prove presence, not correctness.

## Baseline for Phase 7

A Phase 7 check that no data was lost can compare these exact counts. All rows are live; there are no
soft-deleted rows to exclude, but `where deleted_at is null` is still the correct predicate.

```
21 content tables, live rows, 2026-10-03
  parent b993e8c3-71d5-4bb2-a4be-e20984974b9a : 0 in every table
  Gratsi 11111111-1111-4111-8111-111111111113 : angles 43, collections 5, concepts 102,
    creative_briefs 390, creative_dimensions 22, creators 70, personas 28, products 6  = 666
  Niagara 11111111-1111-4111-8111-111111111111 : angles 5, concepts 4, copywriting 4,
    creative_briefs 7, creators 5, personas 3, products 3  = 31
  Mattress Central …112 : 0    Funky Painting …114 : 0    test 1e8c34ea-… : 0
  TOTAL 697
global themes (brand_id null) : 9
junctions : angle_personas 78, angle_products 57, concept_angles 115, concept_collections 207,
  concept_themes 4, creator_concepts 87, creator_products 0, brief_asset_folders 0,
  campaign_concepts 0, copywriting_campaigns 0, copywriting_copy_types 0, creative_module_angles 0,
  creative_module_designs 0, email_campaign_campaigns 0, email_campaign_collections 0,
  email_campaign_products 0, email_flow_campaigns 0, youtube_copy_campaigns 0,
  youtube_copy_collections 0, youtube_copy_copy_types 0    = 548
other brand-scoped : brand_assignments 14, promotion_requests 5, interface_fields 51,
  interface_pages 11, notification_settings 16, user_view_preferences 11, custom_field_schemas 0,
  propagation_runs 0
inheritance plumbing, all 21 tables : template_row_id set 0, overridden_fields non-[] 0,
  custom_fields non-{} 0, deleted_at non-null 0
```

## Method

- Table list derived from `packages/db/src/schema/*.ts` by attributing each `propagationColumns()`
  spread to the nearest preceding `pgTable(` name; 21 tables, cross-checked against
  `information_schema.columns` (all 21 present, 493 columns).
- Column list and types read from `information_schema.columns`, not from the TypeScript, so the counts
  describe production and not the schema's intent.
- Per-column counts: `count(col)` for presence, plus a second count excluding jsonb `[]`/`{}`/`""`/`null`
  and blank-or-whitespace text, so a non-null-but-empty column is never reported as populated.
- Airtable counts: REST `GET /v0/{base}/{tableId}` with `pageSize=100` followed to exhaustion via
  `offset`; field lists from `GET /v0/meta/bases/{base}/tables`.
- Migration state: `drizzle.__drizzle_migrations` compared against SHA-256 of each
  `packages/db/drizzle/*.sql` file named in `drizzle/meta/_journal.json`.
- Every database statement was a `SELECT`, issued after `SET default_transaction_read_only = on`, by a
  throwaway script that refused any statement matching insert/update/delete/drop/alter/create/truncate.
  Credentials were read inline from `/Users/macbook/Tallas Tas/.env.local` per command and never
  written to disk.
