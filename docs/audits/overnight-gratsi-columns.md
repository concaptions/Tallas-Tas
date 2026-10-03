# The GRATSI child column set, classified for seeding `column_definitions`

**Date** 2026-10-03 · **Author** Subagent B · **Scope** the Gratsi base `appllDG4OmkK2Hdnn` as a child
column set, against the parent template `appnaSGAgOUbJ0f9m`, classified for seeding.
**Repo** `/Users/macbook/tallas-tas`. The brief said `main @ 0ae92cb`; by the time I read it HEAD was
**`ec71f39`** (`Merge INHERIT-CORE: column_definitions + the read-time resolver (migration 0045)`), i.e.
two commits further on, with `docs/audits/overnight-parent-columns.md` present and untracked from a
sibling. Read-only pass: I changed no source file and wrote only this document.

## Method, and what each claim rests on

- **Airtable metadata** — `GET /v0/meta/bases/{baseId}/tables` fetched live on 2026-10-03 for both bases.
  Every field name, type, select-option list, `linkedTableId`, `inverseLinkFieldId` and formula
  expression quoted below is copied from those responses.
- **Airtable rows** — I also paged `GET /v0/{baseId}/{tableId}` for **all 21 Gratsi tables** (1081 records).
  Occupancy counts ("0/390 non-empty") come from those rows. This is what settles whether a field that
  maps to no column holds data or is dead weight; the earlier audit could not settle it because it was
  scoped to metadata and source.
- **Postgres** — read-only `SELECT`s against `DATABASE_URL`. No write of any kind.
- **The Postgres column for each field** — read from the row builders and pass-2 blocks of
  `packages/db/src/airtable-import.ts`, which is the authority.
  `packages/db/src/scripts/import-mappings.ts` is documentation and **it has drifted; three real
  contradictions are named below, and the earlier audit's claim that there are none is wrong.**
- Claims I could not establish are written **"I could not establish"**, in those words.

## Verdict on `docs/audits/gratsi-columns-2026-10-02.md`

**Every headline number in it reproduces exactly** against today's live metadata: 21 Gratsi tables /
340 fields, 15 parent tables / 203 fields, and the 126 / 29 / 177 / 8 split. I parsed all 340 of its
per-field rows and aligned them positionally with the live field order: **no row named a field that does
not exist, and no row contradicted name-presence in the paired parent table** (0 of 340). All six
table-id reuses, the Personas rename map, and the two flagged pairings are confirmed independently below.

**Where it is wrong, and it matters:**

| # | Its claim | What I found |
|---|---|---|
| 1 | "**No contradictions found**" between the engine and `import-mappings.ts`; the doc is "incomplete, not wrong" | **Three contradictions.** The two creator approval tracks are documented **swapped**, and `Concepts.Performance` is documented as a stored column that does not exist. Both would corrupt a seeder built from the doc. See *Engine vs mapping doc*. |
| 2 | **37 PARENT-ONLY** fields across the 14 paired tables | **42** under the classification law. Not a counting error on either side — reconciled exactly below. |
| 3 | 177 GRATSI-ONLY ⇒ "child-added" | **106** are genuinely stored. **69 are DERIVED** and **2 are AMBIGUOUS**. Seeding its 177 as stored columns would create **71 bogus rows**. |

It is also silent on five things that bear directly on seeding: ten of Gratsi's 21 tables are **empty**;
two Drizzle tables with a working importer path hold **zero rows in production**; `Concepts.Theme`
resolves to **nothing**; Gratsi's three themes import as rows literally named `Untitled`; and migration
0045, which creates the table this audit feeds, is **not applied**.

## The table-id trap — re-verified

The two bases reuse table ids for different tables. All six cases the brief names are confirmed from
today's metadata, and the repo encodes the same facts in
`packages/db/src/airtable-tables.ts:48-55` (`TEMPLATE_IDS_WITH_DIFFERENT_GRATSI_NAME`).

| table id | name in GRATSI | name in PARENT | same table? |
|---|---|---|---|
| `tbl4UFSFcynlS2Pkn` | `Concepts` | `Angles` | **no** |
| `tblRlcp1ibmS7U7HG` | `Angles` | `Concepts` | **no** |
| `tblZpBYPTcZcmQ1Kf` | `Meta Copywriting` | `Copywriting` | yes, renamed |
| `tblhU5yVNhVDwykUt` | `Creative Design (Internal & Interface)` | `Creative Sheet (Internal & Interface)` | yes, renamed |
| `tblzS73a9JrJGiV2J` | `(Internal) Creative Modules` | `Themes` | yes — the parent's label is wrong, see below |
| `tblGC0TxnHI7lKaNQ` | `Creative Sheet` | `DONT USE Creative Sheet` | yes, flagged |

`Personas` shares no id at all: Gratsi `tblyt7X4VjHxtMDVS`, parent `tblRXknfgKsROI961`.

**Pairing by meaning.** I did not invent one. `GRATSI_TABLES` in `packages/db/src/airtable-tables.ts:20-42`
already maps each of the 21 Gratsi table names to a canonical export key, and the fetcher resolves ids
**by name against the base being read** (`resolveTableIds`, `:67-81`), precisely so that an id match
cannot cross the bases. I used those 21 export keys as the pairing spine and supplied the parent-side
name for each. Two pairings are low confidence and I flag them rather than resolve them:

- **`(Internal) Creative Modules` ↔ parent `Themes`** (`tblzS73a9JrJGiV2J`). Evidence is the field set, not
  the name: both have primary field `Module Name` and a `Concepts` link; the parent adds
  `Reference Link` (singleLineText) where Gratsi has `Foreplay Link` (url) and a
  `(Internal) Creative Design` link. `airtable-tables.ts:4-7` states the same reading. So the parent base
  carries a **modules** table under the label `Themes`.
- **`Creative Sheet` ↔ parent `DONT USE Creative Sheet`** (`tblGC0TxnHI7lKaNQ`), 15 exact field-name
  matches, but the parent has marked its copy dead while Gratsi's holds **377 live records**. Treating a
  "DONT USE" table as the master column set for a table the child actively uses is an owner decision.

**Consequence, unchanged from the earlier audit and re-verified:** Gratsi's real themes table,
`Themes` `tbl1aFLMJXxhdVKiz` (`Name`, `Notes`, `Assignee`, `Status`, `Attachments`,
`Attachment Summary`), has **no counterpart in the parent base**. I checked all 15 parent tables; the
best field-name overlap is 3 of 6 generic names (`Name`, `Status`, `Attachments`) with
`AI Characters / Personas`, which is plainly a different table. **I could not establish** whether the
parent's `Themes` label is a leftover mislabel or deliberate — that is an owner question, and it collides
with `CLAUDE.md` non-negotiable 3 (Themes are a global library), because on this evidence the parent
template defines no themes columns at all.

**Parent-only table (1):** `AI Characters / Personas` `tblgfe8A7nmce6lzn`, 12 fields → 12 Gratsi HIDDEN
rows under `table_key` `ai_characters`. It is a *separate* table from the parent's `Personas`.

## Counts

**Gratsi 21 tables / 340 fields. Parent 15 tables / 203 fields.** Both confirmed.

Every one of the 340 Gratsi fields carries exactly one classification:

| classification | fields | seed verdict |
|---|---:|---|
| **INHERIT** | 97 | no child row — the child reads the parent's row |
| **DETACH-RELABEL** | 23 | child row, `is_detached=true`, `display_label` = the Gratsi label |
| **CHILD-ADDED** | 114 | child row, `source='custom'` |
| **DERIVED** | 104 | **no row at all** — resolves through the link plus the read-time formula layer |
| **AMBIGUOUS** | 2 | child row, `source='custom'`, `is_hidden=true`, plus a line in a decision doc |
| **total** | **340** | |

Plus **42 PARENT-ONLY** fields across the 14 paired tables and **12** on `AI Characters / Personas`
= **54 HIDDEN rows** for Gratsi.

### The headline: the 177 previously-counted GRATSI-ONLY fields

Applying the law strictly to the earlier audit's own 177:

| under the law | fields |
|---|---:|
| **CHILD-ADDED** — a genuine stored column the engine writes | **106** |
| **DERIVED** — gets no stored column and no data row | **69** |
| **AMBIGUOUS** | **2** |
| total | 177 |

The 69, by reason:

| reason | fields |
|---|---:|
| residual `singleLineText` left by a converted link, **empty in every live record** | 21 |
| Airtable lookup (`multipleLookupValues`) | 19 |
| reverse (inverse) side of a link owned by the other table | 16 |
| Airtable formula | 8 |
| Airtable system field (`createdTime` / `createdBy`) | 4 |
| residual `singleLineText` that is a **stale snapshot** of a live link | 1 |
| total | **69** |

**71 of the 340 would have become bogus stored columns** — the 69 above plus the 2 AMBIGUOUS, which the
law says must be hidden rows and a decision line, never a guessed column.

### Reconciling 37 against 42 PARENT-ONLY

Both numbers are arithmetically right; they differ because of the six renames I reject.

- Parent fields across the 14 paired tables: 203 − 12 (`AI Characters / Personas`) = **191**.
- Matched by identical name: **126**. Parent-only **by name alone: 65**.
- The earlier audit consumes 29 rename targets, but two of its rows point at the same parent field
  (`Angles.(Internal) Creative Design` counted IDENTICAL and `Angles.(Internal) Creative Design 2`
  counted RENAMED both target parent `Angles.(Internal) Creative Design`), so it consumes **28 distinct**
  parent fields: 65 − 28 = **37**. ✓
- I accept **23** of its 29 renames as `DETACH-RELABEL`; the other six are DERIVED and so claim no parent
  column. All 23 of my targets are distinct: 65 − 23 = **42**. ✓

Both rename maps are sound: **all 29 of the earlier audit's claimed parent targets exist, verbatim, in the
paired parent table** (29/29 verified against live metadata). The disagreement is about whether a reverse
link, a formula and a lookup count as "the same datum renamed". Under the classification law they do not,
because they get no column.

The six renames I reclassify as DERIVED:

| Gratsi table | field | type | its claimed parent target | why DERIVED |
|---|---|---|---|---|
| `Angles` | `(Internal) Creative Design 2` | multipleRecordLinks | `(Internal) Creative Design` | reverse link; `Creative Design (Internal & Interface)`.`Angle` owns it |
| `Concepts` | `UGC Management` | multipleRecordLinks | `Creator` | reverse link; `UGC Management`.`Concept to film` owns it |
| `Concepts` | `(Internal) Creative Design` | multipleRecordLinks | `Creative Sheet (Internal & Interface)` | reverse link; `Creative Design (Internal & Interface)`.`Concept` owns it |
| `Meta Copywriting` | `Collections` | multipleRecordLinks | `Collection` | reverse link; `(Internal) Collections`.`Ads Copywriting copy` owns it |
| `Creative Sheet` | `Name` | formula | `Name + Angle + Offer` | Airtable formula → `creativeSheetName()` |
| `Creative Sheet` | `Design File (from Creative Name)` | multipleLookupValues | `Design File` | Airtable lookup. **Note the asymmetry:** the parent *stores* `Design File`; Gratsi *derives* it. |

### How I read the law, stated so it can be checked

The law names four derived kinds — lookup, rollup, count, formula. Gratsi has **32 lookups and 11
formulas; zero rollups and zero counts**. That is only 43 of the 104 I classify DERIVED. The other 61 are
there by the law's own *mechanism* clause — "it resolves through the link plus the read-time formula
layer" — and they fall in three groups, each of which `import-mappings.ts` already marks
`handler: 'skip'` with a matching note:

- **29 reverse links.** A two-way link is one relationship. It earns **one** `column_definitions` row,
  keyed by the junction or FK, on the owning side; the inverse side is the same relationship read
  backwards. I verified the inverse for all 29 against `inverseLinkFieldId` and against the engine:
  **27 inverse sides are read by the engine, 2 are not** (flagged below).
- **23 + 2 residual `singleLineText` fields** named after a linked table — the "Residual single-line text
  left by a converted link" pattern the mapping doc already documents. 23 are empty in every live record
  of their table. **2 carry values**, and I proved they are snapshots of a live link rather than data —
  see the proof under *Angles*.
- **7 Airtable system fields** (3 `createdTime`, 2 `lastModifiedTime`, 2 `createdBy`). `baseColumns()` in
  `packages/db/src/columns.ts` already gives every table `created_at` / `updated_at` / `created_by`, so
  these need no row. One system-typed field is **not** derived and I classify it CHILD-ADDED:
  `Themes`.`Attachment Summary` (`aiText`), which the engine writes to `themes.ai_attachment_summary`
  (`airtable-import.ts:834`).

A reader who insists on the literal four-kind reading can recover it: DERIVED 43, and the remaining 61
move to "no stored column, structural".

## The level shift — still the finding that breaks a naive per-column model

Re-verified from live metadata, in both directions, and it is sharper than a rename:

- **Parent holds them on `Angles`; Gratsi holds them on `Concepts`:** `Type`, `Product`, `Personas`,
  `Collection`, `Pain Points`, `USP`, and the description (Gratsi spells it `Decription`). In the parent,
  `Concepts` reads them back as **lookups** — `Type (from Angles)`, `Product (from Angles)`,
  `Personas (from Angles)`, `Pain Points (from Angles)`, `USP (from Angles)`, `Description`, all
  `multipleLookupValues` through the `Angles` link. In Gratsi they are **stored** link/text/select fields
  on `Concepts`.
- **Parent holds it on `Concepts`; Gratsi holds it on `Angles`:** `Formats to create`. Both are
  `multipleSelects` with exactly `Static`, `Video`, `Carousel`, `Motion Graphic`.

So these eight are **CHILD-ADDED** at the Gratsi level: stored in the child, derived in the parent. They
cannot be INHERIT (the parent has no column) and they cannot be DETACH-RELABEL (there is no parent column
to relabel). The parent's six lookups become Gratsi HIDDEN rows on `concepts`.

The option lists also kill an inviting wrong pairing: Gratsi `Concepts.Type` is
`['Emotional','Functional','Identity','Critical','Exciting']`, which matches **parent `Angles.Type`**
(`['Emotional','Functional','Identity','Critical']`), not `Formats to create`.
`airtable-import.ts:1608-1611` already knows the shift and infers the angle-level junction rows so the
app's `concept → angle → persona/product` chain resolves; `angle_personas` holds 78 rows and
`angle_products` 57 for Gratsi, which is that inference working.

## Engine vs mapping doc — three real contradictions

I parsed all 314 field entries of `packages/db/src/scripts/import-mappings.ts` and compared each against
the engine, region by region (every `importRows` builder body and every pass-2 loop body, by character
range, so a read in one table's block is never credited to another's). Every one of its 314 entries names
a field that exists live. **24 live Gratsi fields are absent from the doc** — 8 on `Youtube Copywriting`,
15 on `Creative Sheet`, and `Created 2` on `Creative Design` — all of them lookups, formulas or system
fields, so nothing is lost; that part of the earlier audit holds. But its central claim does not.

**1. The two creator approval tracks are documented SWAPPED.**

- `import-mappings.ts:742-746` — `Status` → `drizzleColumn: 'internalCreatorStatus'`.
- `import-mappings.ts:804-808` — `Creator Status` → `drizzleColumn: 'clientStatus'`.
- `airtable-import.ts:1145-1160` does the opposite, and says why: *"the tracks were SWAPPED in the first
  import. UGC's 'Status' options are exactly the creator CLIENT track's keys; 'Creator Status' is the
  operational internal one."* `Status` → `clientStatus`, `Creator Status` → `internalCreatorStatus`.

The engine wins. The fix landed in the 2026-09-29 sprint and the doc was never updated. This is
`CLAUDE.md` non-negotiable 4 territory: a seeder built from the doc would label Gratsi's client-facing
creator column as the internal one and vice versa, which is the one mistake that leaks internal state to
a client.

**2. `Concepts.Performance` is documented as a stored column that does not exist.**

- `import-mappings.ts:364-368` — `Performance` → `drizzleColumn: 'performance'`, `handler: 'select'`.
- Live metadata: Gratsi `Concepts.Performance` is a **`multipleLookupValues`**, looking up
  `Creative Design (Internal & Interface)`.`Performance` through the `(Internal) Creative Design` link.
- `packages/db/src/schema/concepts.ts` has **no** `performance` column, and
  `SELECT column_name FROM information_schema.columns WHERE table_name='concepts' AND column_name LIKE '%perf%'`
  returns **zero rows** against the live database.
- The engine reads the field nowhere.

This is exactly the failure the brief warns about: a seeder trusting the doc would manufacture a stored
column out of a lookup. Correct classification: **DERIVED**.

**3. (Lesser, same family.)** The doc gives `handler: 'select'` for that lookup — a handler type that
cannot apply to `multipleLookupValues` at all.

Everything else I checked matched. In particular `PERSONA_FIELDS` (`airtable-import.ts:746-767`) is the
only alias constant in the engine and is exactly right; the other 20 tables alias inline with `??`
fallbacks, which is why the drift above went unnoticed.

## Things the earlier audit does not mention, which change the seeding plan

**1. Ten of Gratsi's 21 tables hold zero records.** I paged every table. `Meta Copywriting`,
`Youtube Copywriting`, `Campaigns & Offers`, `(Internal) Copy Type`, `Email Campaigns Management`,
`Email Flows Management`, `Creative Reporting`, `SM Campaign Management Feed`, `Competitive research`
and `Client Assets Organisation` are **empty**. That is **111 of the 340 fields** whose classification
can only ever rest on metadata; no occupancy check can resolve an AMBIGUOUS field there, and both of my
AMBIGUOUS findings sit on two of these tables.

| Gratsi table | Airtable records | Postgres rows for brand Gratsi |
|---|---:|---:|
| `Creative Design (Internal & Interface)` | 390 | `creative_briefs` **390** ✓ |
| `Creative Sheet` | 377 | `creative_sheet_items` **0** ✗ |
| `Concepts` | 102 | `concepts` **102** ✓ |
| `UGC Management` | 70 | `creators` **70** ✓ |
| `Angles` | 43 | `angles` **43** ✓ |
| `(Internal) Creative Modules` | 35 | `creative_modules` **0** ✗ |
| `Personas` | 28 | `personas` **28** ✓ |
| `(Internal) Creative Dimensions` | 22 | `creative_dimensions` **22** ✓ |
| `(Internal) Product` | 6 | `products` **6** ✓ |
| `(Internal) Collections` | 5 | `collections` **5** ✓ |
| `Themes` | 3 | `themes` (global) 9 rows, 3 of them Gratsi's |
| the other 10 tables | 0 | 0 |

**2. `creative_modules` and `creative_sheet_items` are completely empty in production** — not
"0 for Gratsi", but **0 rows for every brand**, confirmed by `GROUP BY brand_id`. Gratsi's Airtable
holds 35 modules and 377 creative-sheet rows, and both tables have a working builder
(`airtable-import.ts:1356-1404`) and a `table_key` in `PROPAGATION_TABLES`. So the Prompt-3 importer
path for these two tables **has never been run against production**, and its column map is unexercised.
Seeding those two tables' `column_definitions` from the engine is therefore the least-evidenced part of
this audit; I flag it rather than smooth it over.

**3. `Concepts.Theme` resolves to nothing for Gratsi.** It is a `multipleSelects` with 28 options, and
**24 distinct labels are in live use** across the 102 concepts. The engine (`:1569-1595`) tries record
links, then a single link, then matches the select **label** against the `Name` of the imported theme
rows. Gratsi's `Themes` table has 3 records and **all three have an empty `Name`**, so no label can ever
match. `concept_themes` holds **4 rows, and a join to `concepts` shows all 4 belong to Niagara Sleep
Solutions (`…111`) — none to Gratsi.** The earlier audit correctly recorded the column as
"— (not imported)"; what it does not say is that a real, populated Gratsi column is being dropped.

**4. Gratsi's three themes import as rows named `Untitled`.** Because `Name` is empty on all three and
the builder (`:827-836`) falls back to `'Untitled'`; and because Gratsi's `Themes` defines neither
`Category` nor `Is Active`, `matchThemeCategory(undefined)` returns `'Framework'` (`:612-618`) into a
`.notNull()` column (`schema/themes.ts:23`). The live `themes` table shows exactly three rows named
`Untitled`, category `Framework`. The earlier audit predicted the category default; I confirm it at row
level and add that the names are empty too.

**5. The table this audit feeds exists in the repo but not in the database.** Migration
`packages/db/drizzle/0045_column-inheritance.sql` (commit `46528e6`) creates `column_definitions`. The
journal has **46** entries; `drizzle.__drizzle_migrations` has **44** rows, and
`information_schema.tables` has **no** `column_definitions` (and no `brand_field_overrides`). So 0044 and
0045 are generated and **not applied**. `personas.passion` *is* present in the live database, consistent
with the schema comment that it was added to production by hand first, which is why 0045 re-adds it
inside an `IF NOT EXISTS` guard.

**6. `column_key` is the Postgres column, not the Airtable label** — `schema/column-definitions.ts:34-36`:
*"The Postgres column, or a junction table name for a link column. Never renamed."* This **defuses** the
earlier audit's warning that the duplicate field name `Email Campaigns Management copy` would collide on
the `UNIQUE (brand_id, table_key, column_key)` index: it will not, because the key is not the label. The
duplicates remain a problem of a different kind — all four of them (two on `(Internal) Product`, two on
`(Internal) Collections`, distinct field ids, confirmed live) are empty residual text with **no column at
all**, so they get no key and no row. Classified DERIVED.

**7. Gratsi's `Themes` table has no `table_key`.** `PROPAGATION_TABLES`
(`packages/db/src/propagation.ts:204-227`) has 22 keys and `themes` is not among them — correctly, since
non-negotiable 3 makes Themes global rather than per-brand. But `column_definitions.table_key` is
documented as *"The content table, as `PROPAGATION_TABLES` keys it"*, so **there is no legal `table_key`
for the six fields of Gratsi's `Themes`**. That needs an owner decision before those six CHILD-ADDED rows
can be written. I classify the fields; I cannot assign them a key.

**8. Two reverse links whose inverse side the engine never reads.** Gratsi has **two** links between
`Meta Copywriting` and `Creative Design (Internal & Interface)`:
`Meta Copywriting.Creative` ↔ `Creative Design.Meta Copywriting` (the engine reads `Creative` →
`copywriting.creative_brief_id`, `:1685`), and a duplicate pair
`Meta Copywriting.(Internal) Creative Design` ↔ `Creative Design.Ads Copywriting copy`, which the engine
reads on **neither** side. Occupancy says it carries nothing today: `Ads Copywriting copy` is 0/390 and
`Meta Copywriting` has no records. Both classified DERIVED; flagged so nobody "fixes" it into a second
FK.

**9. Verified tenancy facts** (read-only, for the record): `brands` has `Creative Hub Template`
`b993e8c3-71d5-4bb2-a4be-e20984974b9a` with `is_template = true` and `template_brand_id = null`, and
five children — `Gratsi …113`, `Niagara Sleep Solutions …111`, `Mattress Central …112`,
`Funky Painting …114`, `test` `1e8c34ea-…` — each with `template_brand_id` pointing at the template.
Exactly as the brief states.

## The read-time layer these DERIVED fields resolve into

`packages/db/src/formulas/` exports **10** functions for Gratsi's **11** formula fields. The eleventh,
`Creative Reporting.Creative Name`, is `{Creative Name (from Creative)}` — a bare passthrough of a
lookup, already recorded as such in `docs/decisions/formula-policy-2026-10-02.md:23`, so it resolves
through the link and needs no function. The two wall-clock formulas are exactly the two that take `now`
as a parameter, as the policy requires:

| Gratsi field | Airtable formula | wall-clock | function |
|---|---|---|---|
| `UGC Management`.`Notify Flag` | `IF(AND({Date of Partnership Activation}, DATETIME_DIFF(TODAY(), …) >= 25), "YES")` | **yes, `TODAY()`** | `creatorNotifyFlag` |
| `SM Campaign Management Feed`.`Reminder Trigger` | `IF(IS_AFTER(NOW(), DATEADD({Due Date}, -12, 'hours')), "Yes", "No")` | **yes, `NOW()`** | `smReminderTrigger` |
| `UGC Management`.`Creator's cost (USD)` | Fiverr ×1.055, Insense ×1.10, else ×1 | no | `creatorCostWithFee` |
| `Campaigns & Offers`.`Name` | `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})` | no | `campaignOfferName` |
| `Creative Sheet`.`Name` | `DATETIME_FORMAT({Created}, "MMMM") & "-" & {Creative Name}` | no | `creativeSheetName` |
| `Creative Reporting`.`Difference CPA` | `{CPA}-{Target CPA}` | no | `differenceCpa` |
| `Email Campaigns Management`.`Design Due Date` | `DATEADD({Send Date}, -5, 'days')` | no | `emailCampaignDesignDueDate` |
| `Email Campaigns Management`.`Copywriting Due Date` | `DATEADD({Design Due Date}, -5, 'days')` | no | `emailCampaignCopywritingDueDate` |
| `Email Flows Management`.`Design Due Date` | `DATEADD({Expected Setup Date}, -5, 'days')` | no | `emailFlowDesignDueDate` |
| `Email Flows Management`.`Copywriting Due Date` | `DATEADD({Design Due Date}, -5, 'days')` | no | `emailFlowCopywritingDueDate` |
| `Creative Reporting`.`Creative Name` | `{Creative Name (from Creative)}` | no | **none — a lookup passthrough** |

## Per-table summary

| Gratsi table | INHERIT | DETACH-RELABEL | CHILD-ADDED | DERIVED | AMBIGUOUS | fields | HIDDEN (parent-only) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `Personas` | 0 | 5 | 1 | 1 | 0 | 7 | 9 |
| `Concepts` | 4 | 6 | 8 | 5 | 0 | 23 | 11 |
| `Angles` | 2 | 0 | 9 | 10 | 0 | 21 | 7 |
| `Meta Copywriting` | 7 | 2 | 6 | 14 | 1 | 30 | 2 |
| `Creative Design (Internal & Interface)` | 25 | 3 | 4 | 10 | 0 | 42 | 4 |
| `(Internal) Creative Modules` | 2 | 1 | 1 | 0 | 0 | 4 | 0 |
| `Creative Sheet` | 3 | 0 | 10 | 16 | 0 | 29 | 2 |
| `UGC Management` | 24 | 4 | 6 | 2 | 0 | 36 | 3 |
| `(Internal) Collections` | 6 | 1 | 1 | 5 | 0 | 13 | 0 |
| `(Internal) Product` | 2 | 0 | 0 | 9 | 0 | 11 | 3 |
| `Campaigns & Offers` | 9 | 1 | 2 | 8 | 0 | 20 | 1 |
| `(Internal) Creative Dimensions` | 3 | 0 | 0 | 1 | 0 | 4 | 0 |
| `Competitive research` | 7 | 0 | 0 | 0 | 0 | 7 | 0 |
| `Client Assets Organisation` | 3 | 0 | 0 | 1 | 0 | 4 | 0 |
| `Themes` (Gratsi-only) | 0 | 0 | 6 | 0 | 0 | 6 | — |
| `Youtube Copywriting` (Gratsi-only) | 0 | 0 | 16 | 12 | 1 | 29 | — |
| `Email Campaigns Management` (Gratsi-only) | 0 | 0 | 15 | 2 | 0 | 17 | — |
| `Email Flows Management` (Gratsi-only) | 0 | 0 | 11 | 2 | 0 | 13 | — |
| `SM Campaign Management Feed` (Gratsi-only) | 0 | 0 | 5 | 1 | 0 | 6 | — |
| `(Internal) Copy Type` (Gratsi-only) | 0 | 0 | 2 | 2 | 0 | 4 | — |
| `Creative Reporting` (Gratsi-only) | 0 | 0 | 11 | 3 | 0 | 14 | — |
| **total** | **97** | **23** | **114** | **104** | **2** | **340** | **42** (+12 on `AI Characters / Personas`) |

---

# Personas — the worked example

**Gratsi** `Personas` `tblyt7X4VjHxtMDVS`, 7 fields, **28 live records** · **Parent** `Personas`
`tblRXknfgKsROI961`, 15 fields · `table_key` `personas`. The two tables that share **no** id.

## The owner's pinned map, checked character by character against live metadata

| # | Gratsi field (verbatim) | parent field (verbatim) | verdict |
|---|---|---|---|
| 1 | `Description  [Age Status Salary]` | `Demographic` | **confirmed** |
| 2 | `Personality` | `Psychographic` | **confirmed** |
| 3 | `Drivers for this persona` | `Core Desires (Cashvertising)` | **confirmed** |
| 4 | `Problem-Solution Awareness Level` | `Stage of Market Awareness (Breakthrough Advertising)` | **confirmed** |
| 5 | `Passion` | *(none in the parent)* | **confirmed CHILD-ADDED**, column `personas.passion` |
| 6 | `Name` | `Persona Name` | **confirmed — and the pinned map omits it**, so Personas has five detached rows, not four |

**The double space is real and load-bearing.** The live Gratsi field name is `Description` + **two**
spaces + `[Age Status Salary]`; Python `repr()` on the metadata gives
`'Description  [Age Status Salary]'`. Any inheritance key or label built from it must preserve it byte
for byte. The engine does (`airtable-import.ts:749`) and so does the mapping doc
(`import-mappings.ts:225-227`). Note the type differs too: Gratsi `multilineText`, parent `multilineText`
for this one, but the primary field is Gratsi `singleLineText` against parent `multilineText`.

**`Passion` confirmed on four sources.** The parent has no such field. `PERSONA_FIELDS.passion =
['Passion']` with the comment *"Gratsi's own field, and its own column since migration 0044 — never
folded into a neighbour"* (`airtable-import.ts:751-753`).
`packages/db/drizzle/0044_personas-passion.sql` is a one-line `ALTER TABLE "personas" ADD COLUMN
"passion" text;`, 0045 re-adds it under an `IF NOT EXISTS` guard, and the live `personas` table has a
`passion text` column. The displacement bug the brief names — `Passion` landing in `core_desires` and
pushing `Drivers for this persona` out — is **fixed**: `coreDesires` and `passion` are separate entries,
and `coreDesires` lists `Drivers for this persona` as its Gratsi alias.

## `PERSONA_FIELDS` already *is* the detach-with-label map

`airtable-import.ts:746-767` is one entry per Postgres column, **parent name first**, then each child's
alias — the exact shape `column_definitions` needs, with `column_key` = the Postgres column and
`display_label` = the child's alias. Its docstring records the rule and the near-miss that motivated it:
a short-name read like `f['Core Desires']` *"silently missed ELEVEN of the fifteen template fields"*. The
other 20 tables do this job with scattered inline `??` fallbacks, which is where the swap in
*Engine vs mapping doc* hid.

## A link whose label matches but whose target does not

Gratsi `Personas.Angles` and parent `Personas.Angles` are both `multipleRecordLinks` with the identical
name, so a name-only diff calls them identical. They point at different tables:

- parent `Angles` → `tbl4UFSFcynlS2Pkn`, which in the **parent** is `Angles`. Correct.
- Gratsi `Angles` → `tbl4UFSFcynlS2Pkn`, which in **Gratsi** is `Concepts`. Its inverse field there is
  named `Personas` (`fldMf8DR6ji0wVD5z`).

So Gratsi's field **labelled** `Angles` links Personas to **Concepts** — the level shift again. It is
26/28 non-empty, and the engine reads the relationship from the `Concepts` side, inferring the
angle-level junction rows (`:1612-1625`). Classified **DERIVED**: one relationship, one row, written from
the owning side. An inheritance model that called this "identical, inherit" would wire Gratsi's personas
to the wrong table.

## 1. `Personas`

**Gratsi** `Personas` `tblyt7X4VjHxtMDVS`, 7 fields, **28 live records** · **Parent** `Personas` `tblRXknfgKsROI961`, 15 fields · `table_key` `personas`

Counts: DETACH-RELABEL 5, CHILD-ADDED 1, DERIVED 1

Worked through in full above; the field table repeats it for completeness.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `personas.name` (:870) | parent `Persona Name` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 2 | `Description  [Age Status Salary]` | multilineText | `personas.demographic` (:873) | parent `Demographic` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 3 | `Personality` | richText | `personas.psychographic` (:874) | parent `Psychographic` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 4 | `Drivers for this persona` | richText | `personas.core_desires` (:875) | parent `Core Desires (Cashvertising)` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 5 | `Passion` | richText | `personas.passion` (:876) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 6 | `Angles` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 7 | `Problem-Solution Awareness Level` | singleSelect | `personas.stage_of_awareness` (:885) | parent `Stage of Market Awareness (Breakthrough Advertising)` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |

PARENT-ONLY on this pair (rename targets excluded) — **9** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `A Day in the Life` | multilineText |
| `Emotional Triggers (Cashvertising)` | multilineText |
| `Pain Points (Cashvertising)` | multilineText |
| `Success Factors (Buyer Personas)` | multilineText |
| `Perceived Barriers (Buyer Personas)` | multilineText |
| `Buying Triggers (Breakthrough Advertising)` | multilineText |
| `Problem/Challenge (StoryBrand)` | multilineText |
| `Success/Transformation (StoryBrand)` | multilineText |
| `Trigger Words (Mindstates)` | multilineText |

## 2. `Concepts`

**Gratsi** `Concepts` `tbl4UFSFcynlS2Pkn`, 23 fields, **102 live records** · **Parent** `Concepts` `tblRlcp1ibmS7U7HG`, 22 fields · `table_key` `concepts`

Counts: INHERIT 4, DETACH-RELABEL 6, CHILD-ADDED 8, DERIVED 5

Six renames rest on shared select-option keys, not on name similarity: `Style` → parent
`Concept Style` (Gratsi `['Editing','Filming']`, parent `['Filming Concept','Editing Concept','AI Concept']`)
and `Status` → parent `Approval Status` (both open with `Pending For Approval`). **Seven of the eight level
shifts are on this table** — `Type`, `Product`, `Personas`, `Collection`, `Pain Points`, `USP`, `Decription`
are stored here and derived in the parent, so they are CHILD-ADDED and the parent's six lookups become
HIDDEN rows. `Decription` is the live base's own misspelling and the engine reads it first
(`:938`). **`Theme` is the one populated column that reaches nothing:** 24 distinct labels in use, 0
`concept_themes` rows for Gratsi — see finding 3 above. One live defect, already noted by the earlier
audit and re-verified: `:931` writes `formats: multiSelectArr(f.Type ?? f.Formats)`, so the **angle-type**
vocabulary lands in `concepts.formats`, which is declared `$type<AngleFormat[]>`
(`schema/concepts.ts:54`); `jsonb` + a TypeScript `$type<>` is not a runtime constraint, and
`concepts.formats_to_create` is fed only from `'Formats to Create'`, a capital-C spelling **neither base
uses**. For seeding, `formats` and `formats_to_create` are therefore both suspect columns.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `concepts.name` (:927) | same name (parent type `formula`) | **INHERIT** | inherit — no child row |
| 2 | `Batch` | singleSelect | `concepts.batch` (:928) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 3 | `Theme` | multipleSelects | junction `concept_themes` (pass 2, :1570-1595) — **0 Gratsi rows resolve** | parent `Themes` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 4 | `Angle` | multipleRecordLinks | junction `concept_angles` (pass 2, :1558-1567) | parent `Angles` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 5 | `Category` | singleSelect | `concepts.category` (:929) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 6 | `Style` | singleSelect | `concepts.concept_style` (:930) | parent `Concept Style` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 7 | `Production Status` | singleSelect | `concepts.production_status` (:951) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 8 | `Type` | multipleSelects | `concepts.formats` (:931) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 9 | `Performance` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 10 | `Product` | multipleRecordLinks | junction `angle_products`, inferred concept×angle (pass 2, :1612-1625) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Personas` | multipleRecordLinks | junction `angle_personas`, inferred concept×angle (pass 2, :1612-1625) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 12 | `Status` | singleSelect | `concepts.approval_status` (:944) | parent `Approval Status` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 13 | `Decription` | multilineText | `concepts.description` (:936) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 14 | `Script` | richText | `concepts.script_idea` (:934) | parent `Script idea` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 15 | `Collection` | multipleRecordLinks | junction `concept_collections` (pass 2, :1597-1606) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 16 | `Pain Points` | richText | `concepts.pain_points` (:937) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 17 | `USP` | richText | `concepts.usp` (:938) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 18 | `Hooks` | richText | `concepts.hook_examples` (:933) | parent `Hook examples` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 19 | `Client's Comments` | multilineText | `concepts.client_comments` (:939) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 20 | `UGC Management` | multipleRecordLinks | — (engine writes nothing) | parent `Creator` | **DERIVED** | NO row — resolves through the link / formula layer |
| 21 | `Campaigns & Offers` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 22 | `(Internal) Creative Design` | multipleRecordLinks | — (engine writes nothing) | parent `Creative Sheet (Internal & Interface)` | **DERIVED** | NO row — resolves through the link / formula layer |
| 23 | `UGC Management copy` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **11** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `Type (from Angles)` | multipleLookupValues |
| `Description` | multipleLookupValues |
| `Creators` | multipleLookupValues |
| `Pain Points (from Angles)` | multipleLookupValues |
| `USP (from Angles)` | multipleLookupValues |
| `Product (from Angles)` | multipleLookupValues |
| `Personas (from Angles)` | multipleLookupValues |
| `Formats to create` | multipleSelects |
| `Ad Inspo` | multilineText |
| `Creator` | multipleRecordLinks |
| `Creative Sheet (Internal & Interface)` | multipleRecordLinks |

## 3. `Angles`

**Gratsi** `Angles` `tblRlcp1ibmS7U7HG`, 21 fields, **43 live records** · **Parent** `Angles` `tbl4UFSFcynlS2Pkn`, 11 fields · `table_key` `angles`

Counts: INHERIT 2, CHILD-ADDED 9, DERIVED 10

**The proof that the residual text fields are DERIVED, not AMBIGUOUS.** This table carries
the only two residual `singleLineText` fields in the whole base that hold values, and both are
comma-joined renderings of a relationship the table already carries as a live link:

- `Concepts copy` (9/43 non-empty). I split each value on commas outside quotes and resolved the live
  `Concepts` link to concept names. On **7 of the 9 rows the two sets are identical** (1↔1, 8↔8, 30↔30,
  2↔2, 9↔9, 13↔13, 9↔9); the two that differ by one element differ because concept names themselves
  contain commas (`"Oct, 2025 - Holiday Gifting Hack (For Partnership Ads)"`), which my splitter cannot
  parse — not because the data differs.
- `(Internal) Creative Design` (1/43 non-empty) holds
  `'"TS1-B1-Good Taste, No Hangover-V1", "TS2-B1-Good Taste, No Hangover-V2"'` while the live link
  `(Internal) Creative Design 2` on the same row resolves to **67** creative names including the first of
  those two. It is a frozen snapshot from before the link was converted.

Neither is data a column should hold. Both get no `column_definitions` row. `Formats to create` is the
eighth level shift (parent keeps it on `Concepts`).

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `angles.name` (:902) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 2 | `Status` | singleSelect | `angles.status` (:911) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Potential` | singleSelect | `angles.potential` (:909) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Description` | multilineText | `angles.description` (:903) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 5 | `Creators` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 6 | `Concepts` | multipleRecordLinks | junction `concept_angles`, written from the Concepts side (pass 2, :1558) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 7 | `Product (from Angles)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 8 | `Personas (from Angles)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 9 | `(Internal) Creative Modules` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 10 | `Formats to create` | multipleSelects | `angles.formats` (:907) | LEVEL SHIFT — parent holds it on another table | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Client Notes` | multilineText | `angles.client_notes` (:913) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 12 | `(Internal) Creative Design` | singleLineText | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 13 | `Brief` | url | `angles.brief_url` (:914) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 14 | `Exact Script` | url | `angles.exact_script_url` (:915) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 15 | `Ad Inspo` | multilineText | `angles.ad_inspo_links` (:908) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 16 | `Winning` | checkbox | `angles.winning` (:910) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 17 | `Internal Notes` | multilineText | `angles.internal_notes` (:912) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 18 | `Creative Sheet` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 19 | `(Internal) Creative Design 2` | multipleRecordLinks | — (engine writes nothing) | parent `(Internal) Creative Design` | **DERIVED** | NO row — resolves through the link / formula layer |
| 20 | `UGC Management copy` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 21 | `Concepts copy` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **7** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `Type` | multipleSelects |
| `Product` | multipleRecordLinks |
| `Collection` | multipleRecordLinks |
| `Personas` | multipleRecordLinks |
| `Pain Points` | multilineText |
| `USP` | multilineText |
| `Performance (from Concepts)` | multipleLookupValues |

## 4. `Meta Copywriting`

**Gratsi** `Meta Copywriting` `tblZpBYPTcZcmQ1Kf`, 30 fields, **0 live records** · **Parent** `Copywriting` `tblZpBYPTcZcmQ1Kf`, 11 fields · `table_key` `copywriting`

Counts: INHERIT 7, DETACH-RELABEL 2, CHILD-ADDED 6, DERIVED 14, AMBIGUOUS 1

**30 Gratsi fields against the parent's 11 — the widest gap in the base, and the
table is empty (0 records), so no occupancy check can help here.** It carries one of the two AMBIGUOUS
findings (`⚠️ Please Change the Status of the copy`) and the unread half of the duplicate link pair to
`Creative Design (Internal & Interface)` (finding 8). `Copy #` is `singleLineText` in Gratsi and a
`formula` in the parent; the engine parses the number out with `copyNumberFromText` (`:605`). Note the
parent's `Autonumber` (`autoNumber`) is HIDDEN for Gratsi.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Copy #` | singleLineText | `copywriting.copy_number` (:1063) | same name (parent type `formula`) | **INHERIT** | inherit — no child row |
| 2 | `Status` | singleSelect | `copywriting.status` (:1074) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 3 | `Collections` | multipleRecordLinks | — (engine writes nothing) | parent `Collection` | **DERIVED** | NO row — resolves through the link / formula layer |
| 4 | `Product` | singleLineText | `copywriting.product_id` (pass 2, :1687) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 5 | `Angle` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 6 | `Descriptions` | richText | `copywriting.primary_copy` (:1064) | parent `Primary Copy` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 7 | `Headline` | singleLineText | `copywriting.headline` (:1065) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 8 | `News Feed` | singleLineText | `copywriting.link_description` (:1066) | parent `News Feed / Link Description` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 9 | `CTA` | singleSelect | `copywriting.cta` (:1067) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 10 | `Campaign Code` | multipleRecordLinks | junction `copywriting_campaigns` (pass 2, :1706-1712) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Offer` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 12 | `Campaign (from Campaign)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 13 | `Code (from Campaign)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 14 | `Funnel` | singleSelect | `copywriting.funnel` (:1068) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 15 | `Copy Type` | multipleRecordLinks | junction `copywriting_copy_types` (pass 2, :1698-1706) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 16 | `Client's Comment` | multilineText | `copywriting.client_comment` (:1075) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 17 | `Creative` | multipleRecordLinks | `copywriting.creative_brief_id` (pass 2, :1685) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 18 | `Collection URL` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 19 | `Link (from Product)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 20 | `USED` | checkbox | `copywriting.used` (:1069) | same name (parent type `checkbox`) | **INHERIT** | inherit — no child row |
| 21 | `Winning` | checkbox | `copywriting.winning` (:1070) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 22 | `Meta Rating` | rating | `copywriting.meta_rating` (:1071) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 23 | `Products (from Collections)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 24 | `Created By` | createdBy | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 25 | `Creative Reporting` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 26 | `Creative Sheet` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 27 | `(Internal) Product` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 28 | `(Internal) Creative Design` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 29 | `⚠️ Please Change the Status of the copy` | singleLineText | — (engine writes nothing) | no counterpart | **AMBIGUOUS** | child row, `source='custom'`, `is_hidden=true` + a line in the decision doc |
| 30 | `(Internal) Creative Design 2` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **2** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `Collection` | multipleRecordLinks |
| `Autonumber` | autoNumber |

## 5. `Creative Design (Internal & Interface)`

**Gratsi** `Creative Design (Internal & Interface)` `tblhU5yVNhVDwykUt`, 42 fields, **390 live records** · **Parent** `Creative Sheet (Internal & Interface)` `tblhU5yVNhVDwykUt`, 35 fields · `table_key` `creative_briefs`

Counts: INHERIT 25, DETACH-RELABEL 3, CHILD-ADDED 4, DERIVED 10

The strongest pairing in the base: 25 fields inherit on an
identical name, and it is the only paired table where Gratsi is a near-superset of the parent rather than
a divergence. Three fields carry a **trailing space** in their live Gratsi name and the engine reads them
with the space intact, space-free only as a fallback — `'Script & brief breakdown '` (`:1029`). `Created 2`
is a second `createdTime` field, 390/390 non-empty, absent from the mapping doc, and classified DERIVED
like `Created`. `Inspiration` is `multipleAttachments` in Gratsi and `richText` in the parent, so
"inherit" here cannot mean inheriting the type.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `creative_briefs.name` (:1005) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 2 | `Type` | singleSelect | `creative_briefs.type` (:1002, via the builder's local `const type`) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 3 | `Priority` | singleSelect | `creative_briefs.priority` (:1010) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 4 | `Internal Status` | singleSelect | `creative_briefs.internal_status` (:1036) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 5 | `Client Status` | singleSelect | `creative_briefs.client_status` (:1043) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 6 | `Performance` | singleSelect | `creative_briefs.performance` (:1046) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 7 | `Assignee` | singleCollaborator | `creative_briefs.assignee` (:1011) | same name (parent type `singleCollaborator`) | **INHERIT** | inherit — no child row |
| 8 | `Batch` | singleSelect | `creative_briefs.batch` (:1006) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 9 | `QA Checklist Doc` | multipleAttachments | `creative_briefs.qa_checklist_doc` (:1027) | same name (parent type `multipleAttachments`) | **INHERIT** | inherit — no child row |
| 10 | `Video Editor QA` | checkbox | `creative_briefs.qa_video_editor` (:1020) | same name (parent type `checkbox`) | **INHERIT** | inherit — no child row |
| 11 | `Graphic Designer QA` | checkbox | `creative_briefs.qa_designer` (:1021) | same name (parent type `checkbox`) | **INHERIT** | inherit — no child row |
| 12 | `Creative Strategist QA` | checkbox | `creative_briefs.qa_strategist` (:1022) | same name (parent type `checkbox`) | **INHERIT** | inherit — no child row |
| 13 | `Angle` | multipleRecordLinks | `creative_briefs.angle_id` (pass 2, :1661) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 14 | `Concept` | multipleRecordLinks | `creative_briefs.concept_id` (pass 2, :1660) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 15 | `(Internal) Product` | multipleRecordLinks | `creative_briefs.product_id` (pass 2, :1662) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 16 | `Language` | singleSelect | `creative_briefs.language` (:1030) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 17 | `Design File` | multipleAttachments | `creative_briefs.design_file` (:1028) | same name (parent type `multipleAttachments`) | **INHERIT** | inherit — no child row |
| 18 | `Design Link URL` | singleLineText | `creative_briefs.design_file_url` (:1019) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 19 | `Inspiration` | multipleAttachments | `creative_briefs.inspiration_image` (:1026) | same name (parent type `richText`) | **INHERIT** | inherit — no child row |
| 20 | `Brief to Design/Editing` | richText | `creative_briefs.brief_to_design` (:1012) | parent `Brief` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 21 | `Script / Ad Content` | richText | `creative_briefs.script_content` (:1013) | parent `Ad Content` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 22 | `Platform` | multipleSelects | `creative_briefs.platform` (:1018) | same name (parent type `multipleSelects`) | **INHERIT** | inherit — no child row |
| 23 | `Dimensions` | multipleRecordLinks | `creative_briefs.dimensions` (:1017) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 24 | `Source` | singleSelect | `creative_briefs.source` (:1007) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 25 | `Funnel` | singleSelect | `creative_briefs.funnel` (:1008) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 26 | `Elements we are Testing` | richText | `creative_briefs.elements_tested` (:1015) | same name (parent type `richText`) | **INHERIT** | inherit — no child row |
| 27 | `Offer` | richText | `creative_briefs.offer` (:1031) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 28 | `Creative Module` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 29 | `Last Modified` | lastModifiedTime | — (engine writes nothing) | same name (parent type `lastModifiedTime`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 30 | `Created` | createdTime | — (engine writes nothing) | same name (parent type `createdTime`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 31 | `Click for AI Spell Checker Again` | checkbox | `creative_briefs.click_for_ai_spell_checker` (:1025) | same name (parent type `checkbox`) | **INHERIT** | inherit — no child row |
| 32 | `Spelling Feedback` | multilineText | `creative_briefs.spelling_feedback` (:1023) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 33 | `Spelling Feedback 2` | multilineText | `creative_briefs.spelling_feedback_2` (:1024) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 34 | `Created 2` | createdTime | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 35 | `(Internal) Collections 2` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 36 | `(Internal) Collections 3` | multipleRecordLinks | `creative_briefs.collection_id` (pass 2, :1663) | parent `Collection` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 37 | `Creative Sheet` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 38 | `Ads Copywriting copy` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 39 | `Meta Copywriting` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 40 | `Script & brief breakdown ` | multipleAttachments | `creative_briefs.script_and_brief_breakdown` (:1029) | same name (parent type `multipleAttachments`) | **INHERIT** | inherit — no child row |
| 41 | `Angles` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 42 | `Concepts (from Angles)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **4** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `Batch (from Concepts)` | multipleLookupValues |
| `Inspiration Image` | multipleAttachments |
| `Campaigns & Offers` | multipleRecordLinks |
| `Assets` | multipleRecordLinks |

## 6. `(Internal) Creative Modules`

**Gratsi** `(Internal) Creative Modules` `tblzS73a9JrJGiV2J`, 4 fields, **35 live records** · **Parent** `Themes` `tblzS73a9JrJGiV2J`, 3 fields · `table_key` `creative_modules`

Counts: INHERIT 2, DETACH-RELABEL 1, CHILD-ADDED 1

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Module Name` | singleLineText | `creative_modules.module_name` (:1362) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 2 | `Concepts` | multipleRecordLinks | junction `creative_module_angles` (pass 2, :1758-1765) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 3 | `Foreplay Link` | url | `creative_modules.foreplay_link` (:1363) | parent `Reference Link` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 4 | `(Internal) Creative Design` | multipleRecordLinks | junction `creative_module_designs` (pass 2, :1766-1775) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |

PARENT-ONLY on this pair (rename targets excluded) — **0** Gratsi HIDDEN rows: none


## 7. `Creative Sheet`

**Gratsi** `Creative Sheet` `tblGC0TxnHI7lKaNQ`, 29 fields, **377 live records** · **Parent** `DONT USE Creative Sheet` `tblGC0TxnHI7lKaNQ`, 17 fields · `table_key` `creative_sheet_items`

Counts: INHERIT 3, CHILD-ADDED 10, DERIVED 16

**16 of 29 fields are DERIVED — the highest proportion in the base** — because the
table is almost entirely lookups through `Creative Name` into `Creative Design (Internal & Interface)`,
plus the `Name` formula. Only 13 fields are stored. Two cautions: the parent's copy of this table is
named `DONT USE Creative Sheet` (pairing flagged above), and `creative_sheet_items` holds **0 rows in
production for every brand** against 377 live Airtable records (finding 2), so the engine's column map for
this table is unexercised. `Creative Name` is `multipleRecordLinks` in Gratsi and `singleLineText` in the
parent.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | formula | — (engine writes nothing) | parent `Name + Angle + Offer` | **DERIVED** | NO row — resolves through the link / formula layer |
| 2 | `Creative Name` | multipleRecordLinks | `creative_sheet_items.brief_id` (:1380) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 3 | `Performance (from Creative Name)` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 4 | `(Internal) Product (from Creative Name)` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 5 | `Angle (from Creative Name)` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 6 | `Concepts (from Angle) (from Creative Name)` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 7 | `Elements we are Testing` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 8 | `Design File (from Creative Name)` | multipleLookupValues | — (engine writes nothing) | parent `Design File` | **DERIVED** | NO row — resolves through the link / formula layer |
| 9 | `Design Link URL` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 10 | `Internal Status` | singleSelect | `creative_sheet_items.internal_status` (:1388) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Status` | singleSelect | `creative_sheet_items.status` (:1390) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 12 | `QA Checklist Doc` | multipleAttachments | `creative_sheet_items.qa_checklist_doc` (:1391) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 13 | `Video Editor QA` | checkbox | `creative_sheet_items.qa_video_editor` (:1392) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 14 | `Graphic Designer QA` | checkbox | `creative_sheet_items.qa_designer` (:1393) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 15 | `Creative Strategist QA` | checkbox | `creative_sheet_items.qa_strategist` (:1394) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 16 | `Client's Comments` | multilineText | `creative_sheet_items.client_comments` (:1395) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 17 | `Collection` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 18 | `Platform` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 19 | `Funnel` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 20 | `Type` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 21 | `Proposed Copy` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 22 | `Creative Module` | multipleLookupValues | — (engine writes nothing) | same name (parent type `multipleLookupValues`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 23 | `Used` | checkbox | `creative_sheet_items.used` (:1396) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 24 | `Denied/revisions needed` | checkbox | `creative_sheet_items.denied_revisions_needed` (:1397) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 25 | `Winning` | singleSelect | `creative_sheet_items.winning` (:1398) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 26 | `Created` | createdTime | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 27 | `Last Modified` | lastModifiedTime | — (engine writes nothing) | same name (parent type `lastModifiedTime`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 28 | `Click for AI Spell Checker Again` | checkbox | `creative_sheet_items.spell_check_requested` (:1399) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 29 | `Spelling Feedback` | multilineText | `creative_sheet_items.spelling_feedback` (:1400) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |

PARENT-ONLY on this pair (rename targets excluded) — **2** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `Name + Angle + Offer` | formula |
| `Design File` | multipleLookupValues |

## 8. `UGC Management`

**Gratsi** `UGC Management` `tblRsVqiqUaZRcQYd`, 36 fields, **70 live records** · **Parent** `UGC Management` `tblRsVqiqUaZRcQYd`, 32 fields · `table_key` `creators`

Counts: INHERIT 24, DETACH-RELABEL 4, CHILD-ADDED 6, DERIVED 2

**The table the mapping doc gets wrong.** `Status` → `creators.client_status` and
`Creator Status` → `creators.internal_creator_status`, per `airtable-import.ts:1145-1160`; the doc
documents both the other way round (`import-mappings.ts:742`, `:804`). The engine wins. `Creator's cost
(USD)` is a `formula` in Gratsi and `currency` in the parent, so it is DERIVED here and stored there —
`creatorCostWithFee` reproduces the Fiverr ×1.055 / Insense ×1.10 arithmetic. Two field names carry a
**trailing space** live (`'Tracking Number '`, `'Slack Notified '`) and the engine reads them with the
space (`:1138`, `:1188`). `Notify Flag` is one of the two wall-clock formulas — read-time only, never
stored.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Creator name (Filled by UGC Manager)` | singleLineText | `creators.name` (:1127-1128) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 2 | `Status` | singleSelect | `creators.client_status` (:1151) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 3 | `Date of Management` | date | `creators.date_of_management` (:1139) | same name (parent type `date`) | **INHERIT** | inherit — no child row |
| 4 | `Age` | singleSelect | `creators.age_bracket` (:1129) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 5 | `Gender` | singleSelect | `creators.gender` (:1130) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 6 | `Ethnicity` | singleLineText | `creators.ethnicity` (:1131) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 7 | `Concept to film` | multipleRecordLinks | junction `creator_concepts` (pass 2, :1847-1855) | parent `Concepts to film` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 8 | `Products` | multipleRecordLinks | junction `creator_products` (pass 2, :1856-1859) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 9 | `Budget per 60sec video` | currency | `creators.budget_per_60s` (:1141) | same name (parent type `currency`) | **INHERIT** | inherit — no child row |
| 10 | `Partnership Activity` | singleSelect | `creators.partnership_activity` (:1169) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 11 | `Creator's video Intro` | multipleAttachments | `creators.video_intro_url` (:1133) | parent `Creator's Video Intro` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 12 | `Creator's Profile Pic` | multipleAttachments | `creators.profile_pic_url` (:1132) | same name (parent type `multipleAttachments`) | **INHERIT** | inherit — no child row |
| 13 | `Facebook Profile for Partnership` | richText | `creators.facebook_profile_url` (:1184) | same name (parent type `richText`) | **INHERIT** | inherit — no child row |
| 14 | `Platform` | singleSelect | `creators.platform` (:1135) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 15 | `(Client's) Note or Comments` | multilineText | `creators.client_note` (:1162) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 16 | `Additional Note - TAS Team` | richText | `creators.internal_brief` (:1136) | parent `Internal Brief` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 17 | `Creator's cost (USD) - Internal` | currency | `creators.creator_cost` (:1142) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 18 | `Raw assets` | url | `creators.raw_assets_url` (:1144) | same name (parent type `url`) | **INHERIT** | inherit — no child row |
| 19 | `Shipping Location` | multilineText | `creators.shipping_location` (:1137) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 20 | `Tracking Number ` | singleLineText | `creators.tracking_number` (:1138) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 21 | `Creator Link` | url | `creators.creator_link` (:1134) | same name (parent type `url`) | **INHERIT** | inherit — no child row |
| 22 | `Creator Status` | singleSelect | `creators.internal_creator_status` (:1158) | parent `Internal Creator's Status` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 23 | `Paid by TAS` | currency | `creators.cost_usd` (:1143) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 24 | `Payment Date` | date | `creators.payment_date` (:1185) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 25 | `Concepts` | multipleRecordLinks | `conceptIds (pass 2)` (:1849) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 26 | `Creator Info Request` | richText | `creators.creator_info_request` (:1186) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 27 | `Creator's cost (USD)` | formula | — (engine writes nothing) | same name (parent type `currency`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 28 | `Date of Partnership Activation` | date | `creators.partnership_activated_at` (:1173) | same name (parent type `date`) | **INHERIT** | inherit — no child row |
| 29 | `Notify Flag` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 30 | `Slack Notified ` | checkbox | `creators.slack_notified` (:1188) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 31 | `Partnership Time Period (days)` | number | `creators.partnership_period_days` (:1176) | same name (parent type `number`) | **INHERIT** | inherit — no child row |
| 32 | `Continue Working With?` | singleSelect | `creators.continue_working_with` (:1178) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 33 | `Extension Time Period` | singleSelect | `creators.extension_days` (:1179) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 34 | `Partnership Price per 30 days` | currency | `creators.partnership_price_per_30_days` (:1181) | same name (parent type `currency`) | **INHERIT** | inherit — no child row |
| 35 | `Notes for Partnership ads` | multilineText | `creators.partnership_notes` (:1183) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 36 | `Instagram Username` | singleLineText | `creators.instagram_username` (:1163) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |

PARENT-ONLY on this pair (rename targets excluded) — **3** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `(Internal) Deadline for the request` | date |
| `For Partnership Ads?` | singleSelect |
| `Internal Assets Status` | singleSelect |

## 9. `(Internal) Collections`

**Gratsi** `(Internal) Collections` `tbl6LBNrRqa6Hh4I2`, 13 fields, **5 live records** · **Parent** `(Internal) Collections` `tbl6LBNrRqa6Hh4I2`, 8 fields · `table_key` `collections`

Counts: INHERIT 6, DETACH-RELABEL 1, CHILD-ADDED 1, DERIVED 5

Carries two of the four duplicate `Email Campaigns Management copy` fields
(distinct field ids `fldDxCx8CxKMfofxq` and `fldxqQQHpKHqhYqt6`, both `singleLineText`, both 0/5
non-empty). Three same-named fields differ in type across the bases, all of them the converted-link
pattern: `(Internal) Product`, `(Internal) Creative Design`, `(Internal) Creative Design 2`.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Main Collection` | singleLineText | `collections.name` (:964) | parent `Collection Name` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 2 | `URL` | url | `collections.url` (:965) | same name (parent type `url`) | **INHERIT** | inherit — no child row |
| 3 | `Copywriting` | multipleRecordLinks | `copywritingId (pass 2)` (:1640) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Campaigns & Offers` | multipleRecordLinks | `collections.campaign_id` (pass 2, :1634) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 5 | `Creative Sheet` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 6 | `Angles` | multipleRecordLinks | `collections.angle_id` (pass 2, :1635) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 7 | `(Internal) Product` | singleLineText | `collections.product_id` (pass 2, :1636) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 8 | `(Internal) Creative Design` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `singleLineText`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 9 | `(Internal) Creative Design 2` | singleLineText | `collections.creative_design_note` (:966) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |
| 10 | `Table 17` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 11 | `Email Campaigns Management copy` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 12 | `Email Campaigns Management copy` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 13 | `Ads Copywriting copy` | multipleRecordLinks | `collections.copywriting_id` (pass 2, :1639-1642) | same name (parent type `multipleRecordLinks`) | **INHERIT** | inherit — no child row |

PARENT-ONLY on this pair (rename targets excluded) — **0** Gratsi HIDDEN rows: none


## 10. `(Internal) Product`

**Gratsi** `(Internal) Product` `tblfvfJMYNBz2OYYw`, 11 fields, **6 live records** · **Parent** `(Internal) Product` `tblfvfJMYNBz2OYYw`, 8 fields · `table_key` `products`

Counts: INHERIT 2, DERIVED 9

**9 of 11 fields are DERIVED** — five reverse links and four residual text
fields, two of which are the other duplicate `Email Campaigns Management copy` pair (`fldOjMBRUrKizzabK`,
`fldIc0UqHEHWB9l7q`). Only `Product Name / Landing Page Name` and `Link` are stored, plus
`Collection Link`. Nothing here is renamed.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Product Name / Landing Page Name` | multilineText | `products.name` (:815) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 2 | `Link` | url | `products.link` (:816) | same name (parent type `url`) | **INHERIT** | inherit — no child row |
| 3 | `(Internal) Creative Design 2` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 4 | `Angles` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 5 | `Table 17` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 6 | `Email Campaigns Management copy` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 7 | `Email Campaigns Management copy` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 8 | `Youtube Copywriting` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 9 | `Creative Sheet` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 10 | `(Internal) Creative Design` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 11 | `UGC Management` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **3** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `(Internal) Collections` | multipleRecordLinks |
| `Campaigns & Offers` | multipleRecordLinks |
| `Meta Copywriting` | multipleRecordLinks |

## 11. `Campaigns & Offers`

**Gratsi** `Campaigns & Offers` `tblRNaWCVa1cCIwLL`, 20 fields, **0 live records** · **Parent** `Campaigns & Offers` `tblRNaWCVa1cCIwLL`, 14 fields · `table_key` `campaigns_offers`

Counts: INHERIT 9, DETACH-RELABEL 1, CHILD-ADDED 2, DERIVED 8

Empty (0 records). `Name` is a formula → `campaignOfferName`, mirroring
`CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})` separators and all. `Design attached` is the
residual-link text the mapping doc already excludes in `docs/decisions.md` (`import-mappings.ts:196-199`).
`Angles` on this table links the **Concepts** table despite its name — `schema/campaign-links.ts` and
`airtable-import.ts:1778-1779` both say so — and it is the one field here written as a junction
(`campaign_concepts`).

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | formula | `campaigns_offers.name` (:847) | same name (parent type `formula`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 2 | `Holiday` | singleLineText | `campaigns_offers.holiday` (:848) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 3 | `Official Date` | date | `campaigns_offers.official_date` (:851) | same name (parent type `date`) | **INHERIT** | inherit — no child row |
| 4 | `Country` | singleLineText | `campaigns_offers.country` (:852) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 5 | `Description` | multilineText | `campaigns_offers.description` (:853) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 6 | `Promotional Ideas` | richText | `campaigns_offers.promotional_ideas` (:854) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 7 | `Interested` | checkbox | `campaigns_offers.confirmed_by_client` (:855) | parent `Confirmed by Client` | **DETACH-RELABEL** | child row, `is_detached=true`, `display_label` = the Gratsi label |
| 8 | `Launched` | checkbox | `campaigns_offers.launched` (:856) | same name (parent type `checkbox`) | **INHERIT** | inherit — no child row |
| 9 | `Ads Launch Date` | date | `campaigns_offers.ads_launch_date` (:857) | same name (parent type `date`) | **INHERIT** | inherit — no child row |
| 10 | `Ads End Date` | date | `campaigns_offers.ads_end_date` (:858) | same name (parent type `date`) | **INHERIT** | inherit — no child row |
| 11 | `Discount Offer` | singleLineText | `campaigns_offers.discount_offer` (:849) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 12 | `Code` | singleLineText | `campaigns_offers.code` (:850) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 13 | `Collections` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 14 | `Product` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 15 | `COPY` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 16 | `Angles` | multipleRecordLinks | junction `campaign_concepts` (pass 2, :1783-1789) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 17 | `Design attached` | singleLineText | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |
| 18 | `Email Campaigns` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 19 | `Email Campaigns Management copy` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 20 | `Ads Copywriting copy` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **1** Gratsi HIDDEN rows:

| Parent field | type |
|---|---|
| `(Internal) Product` | multipleRecordLinks |

## 12. `(Internal) Creative Dimensions`

**Gratsi** `(Internal) Creative Dimensions` `tblli0Y76yJvG56zK`, 4 fields, **22 live records** · **Parent** `(Internal) Creative Dimensions` `tblli0Y76yJvG56zK`, 4 fields · `table_key` `creative_dimensions`

Counts: INHERIT 3, DERIVED 1

Field sets are identical across the two bases. Nothing renamed, nothing added. The cleanest table in the base.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name (pass 2)` (:977) · `creative_dimensions.name` (:1345) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 2 | `Dimensions` | singleLineText | `name (pass 2)` (:977) · `creative_dimensions.dimensions` (:1346) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 3 | `Link Description` | singleSelect | `creative_dimensions.link_description` (:1347) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 4 | `(Internal) Creative Design` | multipleRecordLinks | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **0** Gratsi HIDDEN rows: none


## 13. `Competitive research`

**Gratsi** `Competitive research` `tbl9W6v78tKWznN9S`, 7 fields, **0 live records** · **Parent** `Competitive research` `tbl9W6v78tKWznN9S`, 7 fields · `table_key` `competitive_research`

Counts: INHERIT 7

Field sets are identical across the two bases: 7 INHERIT, 0 of everything else.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `competitive_research.name` (:1304) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 2 | `Type` | singleSelect | `competitive_research.type` (:1305) | same name (parent type `singleSelect`) | **INHERIT** | inherit — no child row |
| 3 | `Website` | singleLineText | `competitive_research.website` (:1306) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 4 | `Insta` | singleLineText | `competitive_research.instagram` (:1307) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 5 | `FB Page` | singleLineText | `competitive_research.facebook_page` (:1308) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 6 | `Meta Ads Library` | multilineText | `competitive_research.meta_ads_library` (:1309) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 7 | `Analysis` | multilineText | `competitive_research.analysis` (:1310) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |

PARENT-ONLY on this pair (rename targets excluded) — **0** Gratsi HIDDEN rows: none


## 14. `Client Assets Organisation`

**Gratsi** `Client Assets Organisation` `tbldFmPU6AWg62Fll`, 4 fields, **0 live records** · **Parent** `Client Assets Organisation` `tbldFmPU6AWg62Fll`, 4 fields · `table_key` `client_asset_folders`

Counts: INHERIT 3, DERIVED 1

Field sets are identical by name; the one DERIVED field is the residual `(Internal) Creative Design` text, `singleLineText` in Gratsi against `multipleRecordLinks` in the parent. The table is empty (0 records).

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name [Folder]` | singleLineText | `client_asset_folders.name` (:1325) | same name (parent type `singleLineText`) | **INHERIT** | inherit — no child row |
| 2 | `Description` | multilineText | `client_asset_folders.description` (:1326) | same name (parent type `multilineText`) | **INHERIT** | inherit — no child row |
| 3 | `Location` | url | `client_asset_folders.location_url` (:1327) | same name (parent type `url`) | **INHERIT** | inherit — no child row |
| 4 | `(Internal) Creative Design` | singleLineText | — (engine writes nothing) | same name (parent type `multipleRecordLinks`) | **DERIVED** | NO row — resolves through the link / formula layer |

PARENT-ONLY on this pair (rename targets excluded) — **0** Gratsi HIDDEN rows: none


## 15. `Themes`

**Gratsi** `Themes` `tbl1aFLMJXxhdVKiz`, 6 fields, **3 live records** · **Parent** — none (Gratsi-only table) · `table_key` `(none — themes is NOT in PROPAGATION_TABLES)`

Counts: CHILD-ADDED 6

**Gratsi-only, and the hardest table to seed.** No parent counterpart exists (checked against
all 15 parent tables). `themes` is deliberately **not** in `PROPAGATION_TABLES`, because non-negotiable 3
makes Themes a global library — so there is **no legal `table_key`** for these six rows (finding 7). All
three live records have an **empty `Name`** and the table defines neither `Category` nor `Is Active`, so
they import as three rows named `Untitled` with `category='Framework'` (finding 4). `Attachment Summary`
is the one `aiText` field in the base and it *is* stored (`themes.ai_attachment_summary`), so it is
CHILD-ADDED, not DERIVED.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `themes.name` (:828) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 2 | `Notes` | multilineText | `themes.notes` (:830) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Assignee` | singleCollaborator | `themes.assignee_id` (:831) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Status` | singleSelect | `themes.status` (:832) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 5 | `Attachments` | multipleAttachments | `themes.attachments` (:833) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 6 | `Attachment Summary` | aiText | `themes.ai_attachment_summary` (:834) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |

## 16. `Youtube Copywriting`

**Gratsi** `Youtube Copywriting` `tblVR1UmkbDoDzJ7z`, 29 fields, **0 live records** · **Parent** — none (Gratsi-only table) · `table_key` `youtube_copy`

Counts: CHILD-ADDED 16, DERIVED 12, AMBIGUOUS 1

Gratsi-only; empty (0 records). Carries the second AMBIGUOUS finding. Eight of
its fields are absent from the mapping doc entirely (seven lookups and `Created By`) — the doc gap the
earlier audit reported, re-confirmed. Its four junctions are written in pass 2 (`:1716-1750`), which is
why `Collections`, `Product`, `Campaign Code` and `Copy Type` are CHILD-ADDED rather than DERIVED: on
this table they are the **owning** side.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Copy #` | singleLineText | `youtube_copy.copy_number` (:1104) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 2 | `Status` | singleSelect | `youtube_copy.status` (:1105) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Collections` | multipleRecordLinks | junction `youtube_copy_collections` (pass 2, :1720-1726) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Product` | multipleRecordLinks | junction `youtube_copy_products` (pass 2, :1727-1734) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 5 | `Angle` | singleLineText | `youtube_copy.angle` (:1106) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 6 | `Descriptions (90 caractères max)` | richText | `youtube_copy.descriptions` (:1107) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 7 | `Headline` | singleLineText | `youtube_copy.headline` (:1108) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 8 | `News Feed` | singleLineText | `youtube_copy.news_feed` (:1109) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 9 | `CTA` | singleSelect | `youtube_copy.cta` (:1110) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 10 | `Campaign Code` | multipleRecordLinks | junction `youtube_copy_campaigns` (pass 2, :1735-1741) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Offer` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 12 | `Campaign (from Campaign)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 13 | `Code (from Campaign)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 14 | `Funnel` | singleSelect | `youtube_copy.funnel` (:1111) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 15 | `Copy Type` | multipleRecordLinks | junction `youtube_copy_copy_types` (pass 2, :1742-1749) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 16 | `Client's Comment` | multilineText | `youtube_copy.client_comment` (:1112) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 17 | `Creative` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 18 | `Collection URL` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 19 | `Link (from Product)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 20 | `USED` | checkbox | `youtube_copy.used` (:1113) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 21 | `Winning` | checkbox | `youtube_copy.winning` (:1114) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 22 | `Meta Rating` | rating | `youtube_copy.meta_rating` (:1115) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 23 | `Products (from Collections)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 24 | `Created By` | createdBy | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 25 | `Creative Reporting` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 26 | `Creative Sheet` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 27 | `(Internal) Product` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 28 | `(Internal) Creative Design` | singleLineText | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 29 | `⚠️ Please Change the Status of the copy` | singleLineText | — (engine writes nothing) | no counterpart | **AMBIGUOUS** | child row, `source='custom'`, `is_hidden=true` + a line in the decision doc |

## 17. `Email Campaigns Management`

**Gratsi** `Email Campaigns Management` `tblABjVpwRpYtY7de`, 17 fields, **0 live records** · **Parent** — none (Gratsi-only table) · `table_key` `email_campaigns`

Counts: CHILD-ADDED 15, DERIVED 2

Gratsi-only; empty (0 records). Both due-date fields are formulas chained off `Send Date` and are read-time only. `Table 17` on `(Internal) Product` and `(Internal) Collections` are this table's reverse links.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `email_campaigns.name` (:1430) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 2 | `Campaign Purpose` | multilineText | `email_campaigns.campaign_purpose` (:1431) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Status` | singleSelect | `email_campaigns.status` (:1432) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Send Date` | date | `email_campaigns.send_date` (:1433) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 5 | `Copywriting Due Date` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 6 | `Copywriting` | richText | `email_campaigns.copywriting` (:1434) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 7 | `Design Due Date` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 8 | `Assignee` | singleCollaborator | `email_campaigns.assignee_id` (:1435) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 9 | `Copy Link` | url | `email_campaigns.copy_link` (:1436) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 10 | `Design` | multipleAttachments | `email_campaigns.design` (:1437) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Klaviyo Link` | url | `email_campaigns.klaviyo_link` (:1438) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 12 | `Assets` | multipleAttachments | `email_campaigns.assets` (:1439) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 13 | `Type` | singleSelect | `email_campaigns.type` (:1440) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 14 | `Channel` | singleSelect | `email_campaigns.channel` (:1441) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 15 | `Campaigns & Offers` | multipleRecordLinks | junction `email_campaign_campaigns` (pass 2, :1798-1807) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 16 | `(Internal) Product` | multipleRecordLinks | junction `email_campaign_products` (pass 2, :1808-1814) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 17 | `(Internal) Collections` | multipleRecordLinks | junction `email_campaign_collections` (pass 2, :1815-1824) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |

## 18. `Email Flows Management`

**Gratsi** `Email Flows Management` `tblubVflAQZgJSxcF`, 13 fields, **0 live records** · **Parent** — none (Gratsi-only table) · `table_key` `email_flows`

Counts: CHILD-ADDED 11, DERIVED 2

Gratsi-only; empty (0 records). Same due-date chain, off `Expected Setup Date`.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Flow Name` | singleLineText | `email_flows.flow_name` (:1454) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 2 | `Expected Setup Date` | date | `email_flows.expected_setup_date` (:1455) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Flow Purpose` | multilineText | `email_flows.flow_purpose` (:1456) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Status` | singleSelect | `email_flows.status` (:1457) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 5 | `Copywriting Due Date` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 6 | `Design Due Date` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 7 | `Copywriting` | richText | `email_flows.copywriting` (:1458) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 8 | `Design` | multipleAttachments | `email_flows.design` (:1459) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 9 | `Klaviyo Link` | url | `email_flows.klaviyo_link` (:1460) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 10 | `Type` | singleSelect | `email_flows.type` (:1461) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Campaigns & Offers` | multipleRecordLinks | junction `email_flow_campaigns` (pass 2, :1831-1840) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 12 | `Inspo` | multipleAttachments | `email_flows.inspo` (:1462) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 13 | `Assignee` | singleCollaborator | `email_flows.assignee_id` (:1463) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |

## 19. `SM Campaign Management Feed`

**Gratsi** `SM Campaign Management Feed` `tblLRajTW55XEhVhk`, 6 fields, **0 live records** · **Parent** — none (Gratsi-only table) · `table_key` `sm_campaign_feed_tasks`

Counts: CHILD-ADDED 5, DERIVED 1

Gratsi-only; empty (0 records). `Reminder Trigger` is the second wall-clock formula (`NOW()`), read-time only.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Task Name` | singleLineText | `sm_campaign_feed_tasks.task_name` (:1413) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 2 | `Platform` | singleSelect | `sm_campaign_feed_tasks.platform` (:1414) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Due Date` | dateTime | `sm_campaign_feed_tasks.due_date` (:1415) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Status` | singleSelect | `sm_campaign_feed_tasks.status` (:1416) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 5 | `Notes` | multilineText | `sm_campaign_feed_tasks.notes` (:1417) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 6 | `Reminder Trigger` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |

## 20. `(Internal) Copy Type`

**Gratsi** `(Internal) Copy Type` `tblQiBPj9ypCmYxev`, 4 fields, **0 live records** · **Parent** — none (Gratsi-only table) · `table_key` `copy_types`

Counts: CHILD-ADDED 2, DERIVED 2

Gratsi-only; empty (0 records). Only `Name` and `Description` are stored (`:1087-1091`); its two record links are the inverse sides of the two copy tables' `Copy Type` fields and are written from the copy side.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `copy_types.name` (:1089) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 2 | `Description` | multilineText | `copy_types.description` (:1090) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Copywriting` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 4 | `Ads Copywriting copy` | multipleRecordLinks | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |

## 21. `Creative Reporting`

**Gratsi** `Creative Reporting` `tblgW4bwDSSeqihlr`, 14 fields, **0 live records** · **Parent** — none (Gratsi-only table) · `table_key` `creative_reporting`

Counts: CHILD-ADDED 11, DERIVED 3

Gratsi-only; empty (0 records). `Difference CPA` → `differenceCpa`; `Creative Name` is the one formula field with no function, because it is a bare passthrough of the `Creative Name (from Creative)` lookup.

| # | Gratsi field | type | Postgres column (engine, `airtable-import.ts`) | vs parent | classification | seed verdict |
|---|---|---|---|---|---|---|
| 1 | `Creative Name` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 2 | `Name + Angle + Offer` | singleLineText | `creative_reporting.name_angle_offer` (:1478) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 3 | `Notes` | multilineText | `creative_reporting.notes` (:1479) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 4 | `Ad Design` | multipleAttachments | `creative_reporting.ad_design` (:1480) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 5 | `Ad Link` | singleLineText | `creative_reporting.ad_link` (:1481) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 6 | `CTR` | percent | `creative_reporting.ctr` (:1482) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 7 | `Thumb-Stop Rate` | number | `creative_reporting.thumb_stop_rate` (:1483) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 8 | `Results` | number | `creative_reporting.results` (:1484) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 9 | `CPA` | currency | `creative_reporting.cpa` (:1485) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 10 | `Target CPA` | currency | `creative_reporting.target_cpa` (:1486) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 11 | `Difference CPA` | formula | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
| 12 | `ROAS` | number | `creative_reporting.roas` (:1487) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 13 | `Target ROAS` | number | `creative_reporting.target_roas` (:1488) | no counterpart | **CHILD-ADDED** | child row, `source='custom'` |
| 14 | `Creative Name (from Creative)` | multipleLookupValues | — (engine writes nothing) | no counterpart | **DERIVED** | NO row — resolves through the link / formula layer |
---

# AMBIGUOUS — 2 fields

Per the law these get a HIDDEN child-added row and a line in a decision doc. Neither is guessed into an
existing column.

| Gratsi table | field (verbatim) | type | why AMBIGUOUS |
|---|---|---|---|
| `Meta Copywriting` | `⚠️ Please Change the Status of the copy` | singleLineText | A stored Airtable type with **no Postgres column**, no link that resolves it, and no formula. It is not the converted-link residue the other 25 `singleLineText` fields are: its name is not a table name, and `import-mappings.ts:717-721` calls it *"UI instruction, not data"*. **I could not establish** its occupancy, because `Meta Copywriting` holds **0 records**. |
| `Youtube Copywriting` | `⚠️ Please Change the Status of the copy` | singleLineText | Same field, same reasoning; `import-mappings.ts:938-942` calls it *"UI instruction banner, not data; excluded in `docs/decisions.md`"*. `Youtube Copywriting` also holds **0 records**, so again **I could not establish** occupancy. |

Recommended decision line, for whoever writes the decision doc: *a banner is a UI affordance of the
Airtable interface, not a column; seed it as `is_hidden = true`, `source = 'custom'`, `field_type =
'singleLineText'`, and never as a stored column.* I am not making that call here — the law says it becomes
a decision-doc line, and this is the line.

**Why there are only two.** Every other field that maps to no Postgres column is explained by a mechanism
I could verify: 29 are the inverse side of a link (checked against `inverseLinkFieldId` and against which
side the engine reads), 25 are residual text named after a linked table (23 empty in every live record, 2
proved to be link snapshots under *Angles*), 32 are lookups, 11 are formulas and 7 are Airtable system
fields. I looked for stored fields with real values and no home and found none outside the two above.
The brief's example failure — guessing `Passion` into `core_desires` — is already fixed in the engine, and
nothing in this pass required a guess of that kind.

---

# DERIVED — 104 fields

None of these gets a stored column or a `column_definitions` data row. They resolve through the link plus
the read-time formula layer. Grouped by mechanism; the last column records what the earlier audit called
each one, so every reclassification is visible.

### A. Airtable lookup — 32 fields

| Gratsi table | field | type | resolves through | prior audit called it |
|---|---|---|---|---|
| `Angles` | `Personas (from Angles)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Angles` | `Product (from Angles)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Campaigns & Offers` | `Product` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Concepts` | `Performance` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Design (Internal & Interface)` | `Concepts (from Angles)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Creative Reporting` | `Creative Name (from Creative)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Creative Sheet` | `(Internal) Product (from Creative Name)` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Angle (from Creative Name)` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Collection` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Concepts (from Angle) (from Creative Name)` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Creative Module` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Design File (from Creative Name)` | multipleLookupValues | the link it looks up through | RENAMED |
| `Creative Sheet` | `Design Link URL` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Elements we are Testing` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Funnel` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Performance (from Creative Name)` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Platform` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Creative Sheet` | `Proposed Copy` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Creative Sheet` | `Type` | multipleLookupValues | the link it looks up through | IDENTICAL |
| `Meta Copywriting` | `Campaign (from Campaign)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Meta Copywriting` | `Code (from Campaign)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Meta Copywriting` | `Collection URL` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Meta Copywriting` | `Link (from Product)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Meta Copywriting` | `Offer` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Meta Copywriting` | `Products (from Collections)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Youtube Copywriting` | `Campaign (from Campaign)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Youtube Copywriting` | `Code (from Campaign)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Youtube Copywriting` | `Collection URL` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Youtube Copywriting` | `Creative` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Youtube Copywriting` | `Link (from Product)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Youtube Copywriting` | `Offer` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |
| `Youtube Copywriting` | `Products (from Collections)` | multipleLookupValues | the link it looks up through | GRATSI-ONLY |

### B. Airtable formula — 11 fields

| Gratsi table | field | type | resolves through | prior audit called it |
|---|---|---|---|---|
| `Campaigns & Offers` | `Name` | formula | the formula layer `packages/db/src/formulas/` | IDENTICAL |
| `Creative Reporting` | `Creative Name` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |
| `Creative Reporting` | `Difference CPA` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |
| `Creative Sheet` | `Name` | formula | the formula layer `packages/db/src/formulas/` | RENAMED |
| `Email Campaigns Management` | `Copywriting Due Date` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |
| `Email Campaigns Management` | `Design Due Date` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |
| `Email Flows Management` | `Copywriting Due Date` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |
| `Email Flows Management` | `Design Due Date` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |
| `SM Campaign Management Feed` | `Reminder Trigger` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |
| `UGC Management` | `Creator's cost (USD)` | formula | the formula layer `packages/db/src/formulas/` | IDENTICAL |
| `UGC Management` | `Notify Flag` | formula | the formula layer `packages/db/src/formulas/` | GRATSI-ONLY |

### C. Airtable system field — 7 fields

| Gratsi table | field | type | resolves through | prior audit called it |
|---|---|---|---|---|
| `Creative Design (Internal & Interface)` | `Created` | createdTime | `baseColumns()` in `packages/db/src/columns.ts` | IDENTICAL |
| `Creative Design (Internal & Interface)` | `Created 2` | createdTime | `baseColumns()` in `packages/db/src/columns.ts` | GRATSI-ONLY |
| `Creative Design (Internal & Interface)` | `Last Modified` | lastModifiedTime | `baseColumns()` in `packages/db/src/columns.ts` | IDENTICAL |
| `Creative Sheet` | `Created` | createdTime | `baseColumns()` in `packages/db/src/columns.ts` | GRATSI-ONLY |
| `Creative Sheet` | `Last Modified` | lastModifiedTime | `baseColumns()` in `packages/db/src/columns.ts` | IDENTICAL |
| `Meta Copywriting` | `Created By` | createdBy | `baseColumns()` in `packages/db/src/columns.ts` | GRATSI-ONLY |
| `Youtube Copywriting` | `Created By` | createdBy | `baseColumns()` in `packages/db/src/columns.ts` | GRATSI-ONLY |

### D. Reverse (inverse) link — 29 fields

| Gratsi table | field | type | resolves through | prior audit called it |
|---|---|---|---|---|
| `(Internal) Collections` | `(Internal) Creative Design` | multipleRecordLinks | link `Creative Design (Internal & Interface)`.`(Internal) Collections 3` | IDENTICAL |
| `(Internal) Collections` | `Table 17` | multipleRecordLinks | link `Email Campaigns Management`.`(Internal) Collections` | GRATSI-ONLY |
| `(Internal) Copy Type` | `Ads Copywriting copy` | multipleRecordLinks | link `Meta Copywriting`.`Copy Type` | GRATSI-ONLY |
| `(Internal) Copy Type` | `Copywriting` | multipleRecordLinks | link `Youtube Copywriting`.`Copy Type` | GRATSI-ONLY |
| `(Internal) Creative Dimensions` | `(Internal) Creative Design` | multipleRecordLinks | link `Creative Design (Internal & Interface)`.`Dimensions` | IDENTICAL |
| `(Internal) Product` | `(Internal) Creative Design` | multipleRecordLinks | link `Creative Design (Internal & Interface)`.`(Internal) Product` | IDENTICAL |
| `(Internal) Product` | `Angles` | multipleRecordLinks | link `Concepts`.`Product` | IDENTICAL |
| `(Internal) Product` | `Table 17` | multipleRecordLinks | link `Email Campaigns Management`.`(Internal) Product` | GRATSI-ONLY |
| `(Internal) Product` | `UGC Management` | multipleRecordLinks | link `UGC Management`.`Products` | IDENTICAL |
| `(Internal) Product` | `Youtube Copywriting` | multipleRecordLinks | link `Youtube Copywriting`.`Product` | GRATSI-ONLY |
| `Angles` | `(Internal) Creative Design 2` | multipleRecordLinks | link `Creative Design (Internal & Interface)`.`Angle` | RENAMED |
| `Angles` | `(Internal) Creative Modules` | multipleRecordLinks | link `(Internal) Creative Modules`.`Concepts` | GRATSI-ONLY |
| `Angles` | `Concepts` | multipleRecordLinks | link `Concepts`.`Angle` | IDENTICAL |
| `Angles` | `Creators` | multipleRecordLinks | link `UGC Management`.`Concepts` | GRATSI-ONLY |
| `Campaigns & Offers` | `Ads Copywriting copy` | multipleRecordLinks | link `Meta Copywriting`.`Campaign Code` | GRATSI-ONLY |
| `Campaigns & Offers` | `COPY` | multipleRecordLinks | link `Youtube Copywriting`.`Campaign Code` | GRATSI-ONLY |
| `Campaigns & Offers` | `Collections` | multipleRecordLinks | link `(Internal) Collections`.`Campaigns & Offers` | IDENTICAL |
| `Campaigns & Offers` | `Email Campaigns` | multipleRecordLinks | link `Email Campaigns Management`.`Campaigns & Offers` | GRATSI-ONLY |
| `Campaigns & Offers` | `Email Campaigns Management copy` | multipleRecordLinks | link `Email Flows Management`.`Campaigns & Offers` | GRATSI-ONLY |
| `Concepts` | `(Internal) Creative Design` | multipleRecordLinks | link `Creative Design (Internal & Interface)`.`Concept` | RENAMED |
| `Concepts` | `Campaigns & Offers` | multipleRecordLinks | link `Campaigns & Offers`.`Angles` | GRATSI-ONLY |
| `Concepts` | `UGC Management` | multipleRecordLinks | link `UGC Management`.`Concept to film` | RENAMED |
| `Creative Design (Internal & Interface)` | `Ads Copywriting copy` | multipleRecordLinks | link `Meta Copywriting`.`(Internal) Creative Design` | GRATSI-ONLY |
| `Creative Design (Internal & Interface)` | `Creative Module` | multipleRecordLinks | link `(Internal) Creative Modules`.`(Internal) Creative Design` | GRATSI-ONLY |
| `Creative Design (Internal & Interface)` | `Creative Sheet` | multipleRecordLinks | link `Creative Sheet`.`Creative Name` | GRATSI-ONLY |
| `Creative Design (Internal & Interface)` | `Meta Copywriting` | multipleRecordLinks | link `Meta Copywriting`.`Creative` | IDENTICAL |
| `Meta Copywriting` | `(Internal) Creative Design` | multipleRecordLinks | link `Creative Design (Internal & Interface)`.`Ads Copywriting copy` | GRATSI-ONLY |
| `Meta Copywriting` | `Collections` | multipleRecordLinks | link `(Internal) Collections`.`Ads Copywriting copy` | RENAMED |
| `Personas` | `Angles` | multipleRecordLinks | link `Concepts`.`Personas` | IDENTICAL |

### E. Residual text left by a converted link — EMPTY in every live record — 23 fields

| Gratsi table | field | type | resolves through | prior audit called it |
|---|---|---|---|---|
| `(Internal) Collections` | `Creative Sheet` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `(Internal) Collections` | `Email Campaigns Management copy` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `(Internal) Collections` | `Email Campaigns Management copy` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `(Internal) Product` | `(Internal) Creative Design 2` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `(Internal) Product` | `Creative Sheet` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `(Internal) Product` | `Email Campaigns Management copy` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `(Internal) Product` | `Email Campaigns Management copy` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Angles` | `Creative Sheet` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Angles` | `UGC Management copy` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Campaigns & Offers` | `Design attached` | singleLineText | the live link on the same table | IDENTICAL |
| `Client Assets Organisation` | `(Internal) Creative Design` | singleLineText | the live link on the same table | IDENTICAL |
| `Concepts` | `UGC Management copy` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Creative Design (Internal & Interface)` | `(Internal) Collections 2` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Creative Design (Internal & Interface)` | `Angles` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Meta Copywriting` | `(Internal) Creative Design 2` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Meta Copywriting` | `(Internal) Product` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Meta Copywriting` | `Angle` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Meta Copywriting` | `Creative Reporting` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Meta Copywriting` | `Creative Sheet` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Youtube Copywriting` | `(Internal) Creative Design` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Youtube Copywriting` | `(Internal) Product` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Youtube Copywriting` | `Creative Reporting` | singleLineText | the live link on the same table | GRATSI-ONLY |
| `Youtube Copywriting` | `Creative Sheet` | singleLineText | the live link on the same table | GRATSI-ONLY |

### F. Residual text — a STALE SNAPSHOT of a live link, carries values — 2 fields

| Gratsi table | field | type | resolves through | prior audit called it |
|---|---|---|---|---|
| `Angles` | `(Internal) Creative Design` | singleLineText | the live link on the same table | IDENTICAL |
| `Angles` | `Concepts copy` | singleLineText | the live link on the same table | GRATSI-ONLY |
---

# DETACH-RELABEL — 23 fields

`column_key` is the Postgres column (or the junction), taken from the parent's definition;
`display_label` is the Gratsi label. `is_detached = true`, `source = 'parent'`.

| Gratsi table | `display_label` (the Gratsi label) | parent label | `column_key` |
|---|---|---|---|
| `Personas` | `Name` | `Persona Name` | `name` |
| `Personas` | `Description  [Age Status Salary]` | `Demographic` | `demographic` |
| `Personas` | `Personality` | `Psychographic` | `psychographic` |
| `Personas` | `Drivers for this persona` | `Core Desires (Cashvertising)` | `core_desires` |
| `Personas` | `Problem-Solution Awareness Level` | `Stage of Market Awareness (Breakthrough Advertising)` | `stage_of_awareness` |
| `Concepts` | `Theme` | `Themes` | `concept_themes` (junction) — **resolves to 0 rows for Gratsi** |
| `Concepts` | `Angle` | `Angles` | `concept_angles` (junction) |
| `Concepts` | `Style` | `Concept Style` | `concept_style` |
| `Concepts` | `Status` | `Approval Status` | `approval_status` |
| `Concepts` | `Script` | `Script idea` | `script_idea` |
| `Concepts` | `Hooks` | `Hook examples` | `hook_examples` |
| `Meta Copywriting` | `Descriptions` | `Primary Copy` | `primary_copy` |
| `Meta Copywriting` | `News Feed` | `News Feed / Link Description` | `link_description` |
| `Creative Design (Internal & Interface)` | `Brief to Design/Editing` | `Brief` | `brief_to_design` |
| `Creative Design (Internal & Interface)` | `Script / Ad Content` | `Ad Content` | `script_content` |
| `Creative Design (Internal & Interface)` | `(Internal) Collections 3` | `Collection` | `collection_id` |
| `(Internal) Creative Modules` | `Foreplay Link` | `Reference Link` | `foreplay_link` |
| `Creative Sheet` | — | — | *(none; its two prior renames are DERIVED)* |
| `UGC Management` | `Concept to film` | `Concepts to film` | `creator_concepts` (junction) |
| `UGC Management` | `Creator's video Intro` | `Creator's Video Intro` | `video_intro_url` |
| `UGC Management` | `Additional Note - TAS Team` | `Internal Brief` | `internal_brief` |
| `UGC Management` | `Creator Status` | `Internal Creator's Status` | `internal_creator_status` — **the doc says `clientStatus`; the engine says this** |
| `(Internal) Collections` | `Main Collection` | `Collection Name` | `name` |
| `Campaigns & Offers` | `Interested` | `Confirmed by Client` | `confirmed_by_client` |

(The `Creative Sheet` row is listed to make the absence explicit: the earlier audit had two renames there
and both are DERIVED under the law.)

---

# What a seeder still needs before it can run

Stated as open items, not as decisions:

1. **Apply migrations 0044 and 0045.** `column_definitions` does not exist in the live database
   (44 of 46 journal entries applied). Nothing below can be written until it does.
2. **A `table_key` for Gratsi's `Themes`** — `PROPAGATION_TABLES` has none, by design (finding 7).
3. **Owner ruling on the two flagged pairings** — `(Internal) Creative Modules` ↔ parent `Themes`, and
   `Creative Sheet` ↔ parent `DONT USE Creative Sheet`.
4. **Fix `import-mappings.ts`, or seed only from the engine.** The two creator approval tracks and
   `Concepts.Performance` are wrong in the doc. Seeding from the engine is correct either way; the doc
   should be corrected so the next audit does not inherit the error.
5. **Decide the two `⚠️` banner fields** (the AMBIGUOUS section above).
6. **Re-run the importer for `Creative Sheet` and `(Internal) Creative Modules`** before trusting their
   column map: 412 Airtable records, 0 Postgres rows (finding 2).
7. **`Concepts.Theme`** carries 24 live labels that currently reach nothing (finding 3). Whether the
   global `themes` library gains those 24 rows is a Themes-library decision, not a column decision, but
   the column's seed verdict depends on it.
