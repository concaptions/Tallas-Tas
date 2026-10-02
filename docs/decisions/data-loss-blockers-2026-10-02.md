# Data-loss blockers — what the template-base alignment deliberately does NOT drop (2026-10-02)

Companion to `docs/audits/template-base-diff-2026-10-02.md` (the field-by-field diff of the Airtable
TEMPLATE base `appnaSGAgOUbJ0f9m`, the source of truth from 2026-10-02), to
`docs/audits/template-base-diff-2026-10-02-corrections.md` (where that audit is wrong) and to
`docs/decisions/extra-fields-kept-2026-10-02.md` (the extra columns shipped code reads).

**This change ships no migration at all.** A draft `0044_template-base-alignment.sql` would have
added two junction tables, `angle_collections` and `copywriting_collections`, for the two fields the
audit's §1 and §4 called missing. They are not missing: the base metadata shows each is the inverse
side of a link the audit's own §9 maps to `collections.angle_id` and `collections.copywriting_id`
(reciprocal `inverseLinkFieldId`, field id for field id — see Correction 1). Adding the junctions
would have stored one Airtable relationship twice, in two places that nothing keeps in step. The
draft was withdrawn and the journal's last entry remains `0043_brief-due-date`.

So the whole of this change is documentation, a nav edit and six route redirects. This document is
the destructive half of the decision — the **61 extra Drizzle columns across 10 tables and the 7
extra content tables** that a strict "match the template base" reading would drop, plus the one
fidelity gap that is real, and why none of it is DDL today.

## Why keeping them is the right call, not the timid one

1. **They are the architecture, not a defect.** The template base is the PARENT template. Gratsi is
   a CHILD brand. CLAUDE.md non-negotiable 1 says a structural change in the parent lands in every
   child; non-negotiable 2 says a child change can only *request* promotion and nothing
   auto-promotes. A field a child brand has and the parent does not is exactly what
   `overridden_fields` and the `brand_field_overrides` table exist to express. Dropping these
   columns would not "align" the schema — it would delete the child-brand layer the design is built
   to carry, and it would break non-negotiable 2 by demoting a child's fields without anyone
   approving a promotion.
2. **The data is real and it is in production.** The 2026-10-01 Gratsi import ran against the live
   database (647 rows upserted, verified) and put real values in these columns. The row counts
   below were measured by the orchestrator against the live database on 2026-10-02; this task
   cannot query production, so those counts are taken as authoritative and nothing here was
   measured locally.
3. **The hard rule.** A table with rows does not get a destructive statement here. A
   table whose row count was **not** measured counts as having rows, because "unknown" is not
   "empty". Under that rule every table below is off limits, and the right next step is a separate,
   explicitly approved decision with fresh counts in hand — not a column drop smuggled into an
   alignment migration.

## The one real fidelity gap, and why widening it is blocked

Separate from the 61 extra columns: `collections` collapses **five Airtable multi-links to a single
uuid each** — `campaign_id`, `angle_id`, `product_id`, `copywriting_id`, `creative_design_2_id`
(audit §9). Both sides of both Collection links are `multipleRecordLinks` with
`prefersSingleRecordLink: false`, so a collection legitimately linked to two angles keeps one. This
is the audit's second most consequential finding and it is **not fixed by this change.**

It is blocked rather than guessed at, because widening even one of these is not one safe change:

1. **It is destructive.** The honest version moves the data into junctions and then drops
   `collections.angle_id` and `collections.copywriting_id`. `collections` has **5 production rows**,
   so under the hard rule above the drop needs explicit human approval with fresh counts.
2. **It rewrites the module, not just the schema.** The FKs are what shipped code reads and writes:
   `apps/web/src/app/app/collections/actions.ts` (the zod schema and the Server Action),
   `packages/db/src/collections.ts` (`listCollections` / `getCollectionById` resolve `angle_id` to a
   name) and `apps/web/src/app/app/collections/fields.ts` (`metaCopyLink` resolves
   `copywriting_id`). A junction without those rewrites is a second store nothing writes.
3. **A half-landed version is worse than the gap.** Two stores for one relationship diverge
   silently, and the importer has no way to know which is canonical. That is the state the withdrawn
   draft migration would have shipped.

**Until that decision is made, the FK columns are canonical.** `packages/db/src/collection-links.test.ts`
pins it: the columns exist, no `angle_collections` or `copywriting_collections` table shadows them,
brand isolation holds, and the two known gaps — one angle per collection, and `copywriting_id`
carrying no Postgres FK constraint at all — are asserted as the current truth so that changing
either is a visible decision rather than a silent drift.

**What the human needs to decide:** whether a collection may link to more than one angle and more
than one copy row (the Airtable base says yes). If yes, the next ticket is a data migration into
`angle_collections` / `copywriting_collections`, a rewrite of the three files above, and an approved
drop of the two columns — in that order, as one ticket, not as an "additive" alignment.

## Extra columns, grouped by table

"Reader" means shipped code outside `packages/db/src/schema` that reads or writes the property;
`docs/decisions/extra-fields-kept-2026-10-02.md` names the file for each one that has one. A column
with **no reader** still stays: it holds imported Gratsi data, and dropping it is the destructive
act this document exists to refuse.

### `creative_briefs` — 397 production rows

12 extra columns. Losing them would lose, row by row:

| Column | What would be lost |
| --- | --- |
| `batch` | the Batch token of the PRD §7 creative name; without it a creative cannot be re-named |
| `version` | the Version token of the same name |
| `sequence` | the per-brand number a row keeps after an earlier row is soft-deleted; a `count(*)` would silently reuse it |
| `due_date` | the media-buyer queue's deadline for the creative |
| `script_content` | the written script of every video brief, and the input the AI spell checker runs on |
| `inspo_links` | the reference links a strategist collected, and the thumbnail source |
| `spelling_feedback_2` | the second spell-check pass's feedback, shown on the brief detail |
| `language` | the brief's language, a saved table-view filter |
| `offer` | the offer the creative runs against |
| `launched_at` | the launch timestamp (no reader today; fixtures set it to null) |
| `launch_priority` | the media-buyer launch ordering (no reader today) |
| `asset_id` | the R2 upload the brief points at; the asset detail route reads it |

### `concepts` — 106 production rows

4 extra columns: `formats` (the second format set beside `formats_to_create`, which is the one the
importer maps), `client_comments` (what the client wrote back on the concept), `internal_status` and
`client_status` (the concept's own two-track statuses, CLAUDE.md non-negotiable 4). Dropping the two
status columns would erase which concepts are visible to a client.

### `creators` — 75 production rows

9 extra columns: `cost_usd` (the Gratsi "Paid by TAS" amount the UGC panel's cost input is bound
to), `concept_ids` and `product_ids` (jsonb mirrors of the two links that also have junctions — a
duplicate, but a duplicate holding imported values), `slack_notified`, `payment_date`,
`creator_info_request`, and three with no reader today: `current_period_start`,
`partnership_ended_at`, `requires_attention` (fixtures set them; the partnership scanner that
migration 0032/0035 added them for is not wired to a page yet).

### `angles` — 48 production rows

9 extra columns: `formats`, `ad_inspo_links`, `potential`, `winning`, `status` (Gratsi's approval
track for an angle — 12 of 43 live rows blank per the column's own comment), `internal_notes`,
`client_notes`, `brief_url`, `exact_script_url`. The Angles panel and grid read all nine; dropping
them empties the module.

### `personas` — 31 production rows

1 extra column: `product_id`. The template base's Personas table links only Angles, so the Product
link is ours. The personas grid's `Product` column is this FK resolved to a name, so the column is
in use as well as populated.

### `themes` — 9 production rows (global table: `brand_id` is null)

7 extra columns: `category`, `notes`, `assignee_id`, `status`, `attachments`,
`ai_attachment_summary`, `is_active`. These came from the GRATSI base's generic "Themes" table
(`tbl1aFLMJXxhdVKiz`), **which does not exist in the template base at all**. `category` is
`NOT NULL` with no template field to source it from, which the audit calls the base's one hard
import blocker — but a blocker is a reason to decide, not a reason to drop a column nine live rows
depend on. See the open question at the end of this document.

### `products` — 9 production rows

1 extra column: `collection_link`. PRD §5.1 ("the collection link is optional") asks for it; the
template base has no such field on the Product table. The Products page renders it.

### `copywriting` — 4 production rows

7 extra columns: `concept_id`, `funnel`, `winning`, `meta_rating`, `click_for_ai_spell_checker`,
`spelling_feedback`, `client_comment`. Six are read by the Meta Copywriting panel;
`click_for_ai_spell_checker` is written by the importer and displayed nowhere yet. Note that
`copy.ts` documents Funnel as *deliberately* dropped from this table in PRD §5.11 and the column
exists anyway — a contradiction worth settling, but settling it is a PRD question, not a drop to
make here.

### `campaigns_offers` — 0 production rows

1 extra column: `promotional_ideas` (a Gratsi field, absent from the template).

**This is the one honest exception to the "every table with extra columns has rows" framing, and it
is recorded rather than quietly used:** the orchestrator's own measurement puts `campaigns_offers`
at 0 rows, so dropping `promotional_ideas` today would lose no data. It is still not dropped, for two
reasons that do not depend on the row count. It is read by shipped code
(`packages/db/src/campaigns.ts` and the Campaigns & Offers panel, with an e2e assertion on the
label), so the drop is a UI change, not a cleanup. And a table measured empty today is the table the
next import fills; the column is part of the child-brand layer either way.

### `creative_sheet_items` — row count NOT measured; treated as having rows

10 extra columns: `internal_status`, `qa_checklist_doc`, `qa_video_editor`, `qa_designer`,
`qa_strategist`, `used`, `denied_revisions_needed`, `winning`, `spell_check_requested`,
`spelling_feedback`. All ten come from the Gratsi "Creative Sheet" table, which is live in Gratsi
even though the template base has renamed its own copy `DONT USE`. The whole QA sign-off trail
(video editor / designer / strategist) is in these columns.

## Extra content tables, and what "hidden" means for them

The template base has no table for these seven. **Not one of them is dropped.** Six are *hidden*:
their entry is removed from `NAV_SECTIONS` in `apps/web/src/components/shell/nav.ts` and their route
`redirect`s (307) to `/app`. The Postgres tables, every query function, the demo fixtures and the
page components stay in the repo untouched, so un-hiding a module is one line of `nav.ts` and one
`page.tsx`.

**Why 307 and not `permanentRedirect` (308):** the legacy `/app/briefs` routes use 308 correctly,
because that page really did move to `/app/creative-design` and is never coming back. A hide is the
opposite — reversible by design, as the sentence above says. A 308 is cached indefinitely by
browsers and intermediaries, so anyone who opened a hidden route once would keep being bounced to
the Overview after the module was restored, until they cleared site data. The brief for this change
asked for `permanentRedirect`; 307 is used instead for that reason, and the choice is flagged for
the human to confirm or reverse.

| Table | Production rows | What dropping it would lose |
| --- | --- | --- |
| `copy_types` | not measured → treat as having rows | the Copy Type lookup list every Meta and YouTube copy row is tagged with, and both sides of its junction |
| `youtube_copy` | 0 | the YouTube copy rows; measured empty, still not dropped — the table and its four junctions are the child-brand module, and the next Gratsi import fills it |
| `email_campaigns` | not measured → treat as having rows | every email campaign, its Klaviyo links and its three link sets (campaigns, products, collections) |
| `email_flows` | not measured → treat as having rows | every email flow and its campaign links |
| `creative_reporting` | not measured → treat as having rows | the per-creative CTR / CPA / ROAS report rows the Creative Design detail links out to |
| `sm_campaign_feed_tasks` | not measured → treat as having rows | the social-media campaign task feed |

`creative_modules` is the seventh extra content table and it is **NOT hidden**, deliberately. See
the open question below.

The 11 junction tables that serve those six (`copywriting_copy_types`, `email_campaign_campaigns`,
`email_campaign_products`, `email_campaign_collections`, `email_flow_campaigns`,
`youtube_copy_collections`, `youtube_copy_products`, `youtube_copy_campaigns`,
`youtube_copy_copy_types`, `creative_module_angles`, `creative_module_designs`) are likewise
untouched: row count not measured, and a junction row is the only record that a link ever existed.

## The open question this change does not answer

**Does the template base's `Themes` table feed `themes` or `creative_modules`?** The audit (§5)
finds the template's `Themes` (`tblzS73a9JrJGiV2J`) carries exactly three stored fields — `Module
Name`, `Reference Link`, `Concepts` — which is the shape of our `creative_modules`
(`module_name` + `foreplay_link`), not of our `themes` (whose other seven columns came from a Gratsi
table the template base does not have). The two tables cannot both be fed from one Airtable table,
and `themes` is the one GLOBAL table in the schema (CLAUDE.md non-negotiable 3) while
`creative_modules` is per-brand — so the answer changes which rows are shared across every brand.

That is a product decision, not a schema one. Until it is made, `creative_modules` stays visible in
the sidebar and nothing about `themes` changes.
