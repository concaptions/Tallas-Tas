# Gratsi child column set vs the parent template — audit

**Date** 2026-10-02 · **Author** Subagent C (discovery for Airtable-style column inheritance)
**Repo** `/Users/macbook/tallas-tas` @ `d7842e7` · read-only pass, no source file changed.

## What this is, and what it is not

This audits the **Gratsi** Airtable base `appllDG4OmkK2Hdnn` as a *child column set*, and diffs it against
the **parent template** base `appnaSGAgOUbJ0f9m` treated purely as a **column definition**. No Gratsi row
data is derived from the parent anywhere below.

**Method.** Both bases' `GET /v0/meta/bases/{baseId}/tables` responses were fetched live on 2026-10-02 with
the PAT from `/Users/macbook/Tallas Tas/.env.local` and saved to the session scratchpad
(`gratsi-raw.json`, `parent-raw.json`). Every field name, type and select-option list quoted below is copied
from those responses, not retyped from memory. Postgres columns come from reading
`packages/db/src/airtable-import.ts` (the engine) and `packages/db/src/scripts/import-mappings.ts` (the
mapping doc); where they disagree the engine wins and the disagreement is called out.

Counts in this document were computed by script over the saved JSON and cross-foot against both bases
(see *Summary counts*). Claims I could not establish are written as **"cannot establish"** rather than
smoothed over.

## The table-id trap (verified, and it bit this audit once)

**The two bases reuse table ids for different tables.** Pairing by id produces garbage. Verified from the
live metadata:

| table id | name in GRATSI | name in PARENT | same table? |
|---|---|---|---|
| `tbl4UFSFcynlS2Pkn` | `Concepts` | `Angles` | **no** |
| `tblRlcp1ibmS7U7HG` | `Angles` | `Concepts` | **no** |
| `tblZpBYPTcZcmQ1Kf` | `Meta Copywriting` | `Copywriting` | yes, renamed |
| `tblhU5yVNhVDwykUt` | `Creative Design (Internal & Interface)` | `Creative Sheet (Internal & Interface)` | yes, renamed |
| `tblzS73a9JrJGiV2J` | `(Internal) Creative Modules` | `Themes` | **see below** |
| `tblGC0TxnHI7lKaNQ` | `Creative Sheet` | `DONT USE Creative Sheet` | **flagged, see below** |

All six reuse cases named in the task brief are confirmed. `Personas` does *not* share an id at all:
Gratsi `tblyt7X4VjHxtMDVS`, parent `tblRXknfgKsROI961`.

### Pairing used below (by meaning, both ids stated)

| # | Gratsi table | Gratsi id | Parent table | Parent id | confidence |
|---|---|---|---|---|---|
| 1 | `Personas` | `tblyt7X4VjHxtMDVS` | `Personas` | `tblRXknfgKsROI961` | high |
| 2 | `Concepts` | `tbl4UFSFcynlS2Pkn` | `Concepts` | `tblRlcp1ibmS7U7HG` | high |
| 3 | `Angles` | `tblRlcp1ibmS7U7HG` | `Angles` | `tbl4UFSFcynlS2Pkn` | high |
| 4 | `Meta Copywriting` | `tblZpBYPTcZcmQ1Kf` | `Copywriting` | `tblZpBYPTcZcmQ1Kf` | high |
| 5 | `Creative Design (Internal & Interface)` | `tblhU5yVNhVDwykUt` | `Creative Sheet (Internal & Interface)` | `tblhU5yVNhVDwykUt` | high (28 exact field-name matches) |
| 6 | `(Internal) Creative Modules` | `tblzS73a9JrJGiV2J` | `Themes` | `tblzS73a9JrJGiV2J` | **medium — flagged** |
| 7 | `Creative Sheet` | `tblGC0TxnHI7lKaNQ` | `DONT USE Creative Sheet` | `tblGC0TxnHI7lKaNQ` | **medium — flagged** |
| 8 | `UGC Management` | `tblRsVqiqUaZRcQYd` | `UGC Management` | `tblRsVqiqUaZRcQYd` | high |
| 9 | `(Internal) Collections` | `tbl6LBNrRqa6Hh4I2` | `(Internal) Collections` | `tbl6LBNrRqa6Hh4I2` | high |
| 10 | `(Internal) Product` | `tblfvfJMYNBz2OYYw` | `(Internal) Product` | `tblfvfJMYNBz2OYYw` | high |
| 11 | `Campaigns & Offers` | `tblRNaWCVa1cCIwLL` | `Campaigns & Offers` | `tblRNaWCVa1cCIwLL` | high |
| 12 | `(Internal) Creative Dimensions` | `tblli0Y76yJvG56zK` | `(Internal) Creative Dimensions` | `tblli0Y76yJvG56zK` | high (field sets are identical) |
| 13 | `Competitive research` | `tbl9W6v78tKWznN9S` | `Competitive research` | `tbl9W6v78tKWznN9S` | high (field sets are identical) |
| 14 | `Client Assets Organisation` | `tbldFmPU6AWg62Fll` | `Client Assets Organisation` | `tbldFmPU6AWg62Fll` | high |

**Gratsi-only tables (7)** — no parent counterpart, so every field is child-added:
`Themes` `tbl1aFLMJXxhdVKiz` · `Youtube Copywriting` `tblVR1UmkbDoDzJ7z` ·
`Email Campaigns Management` `tblABjVpwRpYtY7de` · `Email Flows Management` `tblubVflAQZgJSxcF` ·
`SM Campaign Management Feed` `tblLRajTW55XEhVhk` · `(Internal) Copy Type` `tblQiBPj9ypCmYxev` ·
`Creative Reporting` `tblgW4bwDSSeqihlr`.

**Parent-only table (1)** — `AI Characters / Personas` `tblgfe8A7nmce6lzn`, 12 fields. Gratsi has no such
table, so the whole table is a **hide** for Gratsi. Note it is a *separate* table from the parent's
`Personas` and must not be confused with it.

### Flagged pairing 1 — `tblzS73a9JrJGiV2J`, and where Gratsi's Themes went

I pair Gratsi `(Internal) Creative Modules` with the parent table **named** `Themes`. The evidence is the
field set, not the name:

- parent `Themes` `tblzS73a9JrJGiV2J` fields are `Module Name` (singleLineText), `Reference Link`
  (singleLineText), `Concepts` (link → parent `Concepts`).
- Gratsi `(Internal) Creative Modules` `tblzS73a9JrJGiV2J` fields are `Module Name` (singleLineText),
  `Concepts` (link → Gratsi `Concepts`), `Foreplay Link` (url), `(Internal) Creative Design` (link).

Same id, same primary field name `Module Name`, same `Concepts` link. The parent's table is therefore a
**modules** table carrying the label `Themes`.

Consequently Gratsi's real themes table, `Themes` `tbl1aFLMJXxhdVKiz` (`Name`, `Notes`, `Assignee`,
`Status`, `Attachments`, `Attachment Summary`), has **no counterpart in the parent base at all**. I checked
all 15 parent tables; none carries that field shape.

**What I cannot establish:** whether the parent's `Themes` label is a leftover mislabel or deliberate. That
is an owner question. It matters because `CLAUDE.md` non-negotiable 3 makes Themes a *global* library while
every other table is per-brand seeded from the parent — and on this evidence the parent template defines no
themes columns to seed from. Flagging, not deciding.

### Flagged pairing 2 — `Creative Sheet` vs `DONT USE Creative Sheet`

Same id `tblGC0TxnHI7lKaNQ` and 15 exact field-name matches, so the pairing is mechanically well supported.
But the parent has renamed its copy `DONT USE Creative Sheet` while Gratsi still has 29 live fields on
`Creative Sheet`, and the parent's `Creative Sheet (Internal & Interface)` is a *different* table
(`tblhU5yVNhVDwykUt`) that pairs with Gratsi's `Creative Design (Internal & Interface)`. Treating a
"DONT USE" table as the parent definition for a table the child actively uses is a decision for the owner.
I report the diff and withhold an inherit verdict.

## Summary counts

Totals from the live metadata: **Gratsi 21 tables / 340 fields**, **parent 15 tables / 203 fields**.

Every one of Gratsi's 340 fields is classified exactly once:

| classification | fields | seed verdict | meaning |
|---|---:|---|---|
| IDENTICAL | 126 | inherit | same field name in the paired parent table |
| RENAMED | 29 | detach-with-label | same datum, different name — these are Gratsi's detached rows |
| GRATSI-ONLY | 177 | child-added | the paired parent table has no such field (89 of these are on the 7 Gratsi-only tables) |
| LEVEL-SHIFT | 8 | child-added (see note) | the datum exists in the parent but on a **different table** — see *The level shift* |
| **total** | **340** | | |

Against the parent: **37 PARENT-ONLY fields** across the 14 paired tables (seed verdict **hide**), plus the
whole 12-field `AI Characters / Personas` table.

Cross-foot on the parent's 203 fields: 126 matched by name + 29 rename targets + 37 parent-only + 12 on the
parent-only table = 204, i.e. **one more than 203**, because exactly one pairing is many-to-one: Gratsi
`Angles` has *two* fields for the parent's single `(Internal) Creative Design` — the residual
`singleLineText` of that same name (counted IDENTICAL) and the live `multipleRecordLinks` field
`(Internal) Creative Design 2` (counted RENAMED). Netting that duplicate out gives **203**. ✓

A caveat on the counts: IDENTICAL means **same name**, not same shape. 13 same-named pairs have a
*different Airtable type* across the two bases (listed in *Same name, different type*), and several more
share a name while differing in select options. Those are "inherit" only if inheritance is label-level.

## The level shift — the finding that breaks a naive per-column model

The two bases hang the same relationships off **different tables**, in **both directions**. This is not a
rename and must not be modelled as one:

- **Parent puts them on `Angles`; Gratsi puts them on `Concepts`:** `Product`, `Personas`, `Collection`,
  `Pain Points`, `USP`, `Type`, and the description. In the parent, `Concepts` reads them back as lookups
  (`Product (from Angles)`, `Personas (from Angles)`, `Pain Points (from Angles)`, `USP (from Angles)`,
  `Type (from Angles)`, `Description` — all `multipleLookupValues` through link field `fldiPSy2ot59FLsQf`).
  In Gratsi they are stored link/text fields **on `Concepts`**.
- **Parent puts it on `Concepts`; Gratsi puts it on `Angles`:** `Formats to create`. Option lists confirm
  it — both are `multipleSelects` with exactly `Static`, `Video`, `Carousel`, `Motion Graphic`.

The option lists also disprove an inviting but wrong pairing: Gratsi `Concepts.Type` is
`['Emotional','Functional','Identity','Critical','Exciting']`, which matches **parent `Angles.Type`**
(`['Emotional','Functional','Identity','Critical']`), *not* `Formats to create`. Pairing Gratsi
`Concepts.Type` with `Formats to create` on name-shape alone would have been an error.

The repo already knows this: `packages/db/src/airtable-import.ts:1608-1611` comments that "Gratsi models the
persona/product pairing ON THE CONCEPT" and infers the angle-level junction rows so the app's
`concept → angle → persona/product` chain still resolves.

**Implication for the goal:** an attach/detach flag per *column* cannot express "this datum moved up or down
a table". These 8 fields need an explicit decision, not a default.

## Same name, different type (13 pairs)

These share a field name across the two bases but not an Airtable type, so "inherit" cannot mean inheriting
the type:

| pair (table) | field | Gratsi type | parent type |
|---|---|---|---|
| Concepts | `Name` | singleLineText | formula |
| Angles | `(Internal) Creative Design` | singleLineText | multipleRecordLinks |
| Meta Copywriting / Copywriting | `Copy #` | singleLineText | formula |
| Meta Copywriting / Copywriting | `Product` | singleLineText | multipleRecordLinks |
| Meta Copywriting / Copywriting | `Headline` | singleLineText | multilineText |
| Creative Design / Creative Sheet (I&I) | `Inspiration` | multipleAttachments | richText |
| Creative Sheet / DONT USE | `Creative Name` | multipleRecordLinks | singleLineText |
| UGC Management | `Creator's cost (USD)` | formula | currency |
| (Internal) Collections | `(Internal) Product` | singleLineText | multipleRecordLinks |
| (Internal) Collections | `(Internal) Creative Design` | multipleRecordLinks | singleLineText |
| (Internal) Collections | `(Internal) Creative Design 2` | singleLineText | multipleRecordLinks |
| Campaigns & Offers | `Design attached` | singleLineText | multipleRecordLinks |
| Client Assets Organisation | `(Internal) Creative Design` | singleLineText | multipleRecordLinks |

The recurring `singleLineText` ↔ `multipleRecordLinks` pattern is a converted or broken link leaving a
residual text field on one side; `packages/db/src/scripts/import-mappings.ts:294-299` (Angles `(Internal) Creative Design`) already documents one
such case as "Residual single-line text left by a converted link".

## Engine vs mapping doc

The brief warned the mapping file has drifted from the engine. Checked field by field over all 340 live
Gratsi fields:

- **No contradictions found.** There is no live Gratsi field where the mapping doc claims a Postgres column
  and the engine never reads that field name. My first automated pass suggested ~51 disagreements; every one
  was a false positive from my own extraction (the engine reads many fields across line breaks, and reads
  all seven Personas fields through the `PERSONA_FIELDS` constant rather than inline). Discarded.
- **The doc is incomplete, not wrong.** 24 live Gratsi fields are absent from
  `import-mappings.ts` entirely: 8 on `Youtube Copywriting`, 15 on `Creative Sheet`, and `Created 2` on
  `Creative Design`. The engine does not read any of them either, and they are all lookups, formulas or
  system timestamps — so no data is lost; the doc simply omits them. Flagged as a doc gap.
- `packages/db/src/airtable-import.ts:746-767` — `PERSONA_FIELDS` is the **only** alias constant in the
  engine. Every other table's aliasing is inline `??` fallbacks. For the inheritance goal this constant is
  the most load-bearing artifact in the repo: it already *is* a per-brand rename map (see next section).
- One real engine-side quirk: the Themes row builder
  (`packages/db/src/airtable-import.ts:823-838`) reads `f.Category` and `f['Is Active']`, and Gratsi's
  `Themes` table defines **neither**. They resolve to defaults — `matchThemeCategory(undefined)` returns
  `'Framework'` (`airtable-import.ts:612-618`) and `f['Is Active'] !== false` yields `true` — so every
  imported Gratsi theme gets `category = 'Framework'`. Not a crash, but `themes.category` is
  `.notNull()` (`packages/db/src/schema/themes.ts:23`) and carries no Gratsi-sourced information.
- Not a bug, checked because it looked like one: Gratsi has three field names with trailing whitespace —
  `'Tracking Number '`, `'Slack Notified '` (UGC Management) and `'Script & brief breakdown '`
  (Creative Design). The engine reads all three with the space intact
  (`airtable-import.ts:1138`, `:1188`, `:1029`), with the space-free spelling only as a fallback.

**A genuine obstacle for the inheritance model:** field names are **not unique within a Gratsi table**.
`(Internal) Product` and `(Internal) Collections` each carry **two distinct fields both named**
`Email Campaigns Management copy`. A column-inheritance key of (table, field name) will collide on these.


## Making the Template base selectable — fields the importer cannot currently read

The stated goal includes "the Template base must become selectable in the brand switcher", which means the
importer will have to read `appnaSGAgOUbJ0f9m` as a brand. It cannot read all of it today. I checked every
**stored** parent field (lookups, formulas and system fields excluded, since those are joins not columns)
for whether its exact name appears anywhere in `packages/db/src/airtable-import.ts`. **25 do not.**

**Five** of those are near-miss spellings of a name the engine *does* read, so they look mapped and are not:

| parent field (live) | engine reads | line | consequence for a parent import |
|---|---|---|---|
| `Hook examples` | `'Hook Examples'` | `:933` | falls through to `f.Hooks`, which the parent lacks → `hook_examples` empty |
| `Script idea` | `'Script Idea'` | `:934` | falls through to `f.Script`, which the parent lacks → `script_idea` empty |
| `For Partnership Ads?` | `'For Partnership Ads'` | `:1164` | `for_partnership_ads` never set |
| `Internal Creator's Status` | `'Internal Creator Status'` | `:1158` | fallback never fires |
| `Creator's Video Intro` | `"Creator's video Intro"` (Gratsi's casing) | `:1133` | fallback is `'Video Intro URL'`, in neither base → empty |

A sixth case is adjacent but different in kind: parent `Concepts.Formats to create`. That exact spelling
*is* in the source — but only at `:907`, inside the **Angles** builder, where it reads Gratsi's
`Angles.Formats to create`. The **Concepts** builder instead reads `'Formats to Create'` at `:946`, a capital
`C` that neither base uses, so `concepts.formats_to_create` is populated from no base at all.

Gratsi is **unaffected** by all of these: in each case the engine reads Gratsi's own spelling first, or Gratsi has
no such field. These are parent-side only. I am reporting them because the goal requires the parent to be
importable, not because they break the Gratsi import today.

The remaining 20 unreadable stored parent fields are mostly genuine structure the engine has no column for
(the 9 prose fields of `AI Characters / Personas`, parent `Concepts.Themes`, parent
`Concepts.Creative Sheet (Internal & Interface)`, `Collection Name`, `Inspiration Image`,
`News Feed / Link Description`, `Reference Link`, `(Internal) Deadline for the request`, `Concepts to film`,
`Creator's cost (USD)`, `Design attached`, `(Internal) Product.UGC Management`).

### One substantive mapping defect, affecting Gratsi

Separate from the spellings above, and the only item here I would call a bug in the live Gratsi path:

`packages/db/src/airtable-import.ts:931` writes the concept's formats as
`formats: multiSelectArr(f.Type ?? f.Formats)`. For Gratsi that reads `Concepts.Type`, whose live options are
`['Emotional', 'Functional', 'Identity', 'Critical', 'Exciting']` — the **angle-type** taxonomy, matching
parent `Angles.Type`. The destination column is
`formats: jsonb('formats').$type<AngleFormat[]>().notNull().default([])`
(`packages/db/src/schema/concepts.ts:54`), and `AngleFormat` is
`['Static', 'Video', 'Carousel', 'Motion Graphic']` (`packages/db/src/schema/enums.ts:57-58`).

`multiSelectArr` does no vocabulary filtering — it returns the strings as given
(`airtable-import.ts:228-232`) — and `jsonb` + a TypeScript `$type<>` is not a runtime constraint. So Gratsi
concept rows carry angle-type values in a column declared to hold creative formats, with no error raised.
Meanwhile `concepts.formats_to_create` (`concepts.ts:65`), the column that *would* hold the real formats, is
fed only from `'Formats to Create'` (`:946`) — a spelling neither base uses.

I have not run a query to count affected rows: that would be a database read beyond this audit's read-only
remit on the repo, and the brief scoped me to metadata and source. **The row-level impact is therefore
unverified**; the mapping defect itself is verified from the four cited files.
---

# 1. Personas — the worked example

**Gratsi** `Personas` `tblyt7X4VjHxtMDVS`, 7 fields · **Parent** `Personas` `tblRXknfgKsROI961`, 15 fields.
Note these are the two tables that share **no** id.

## The pinned rename map, verified against live metadata

Every row below was checked character by character against the saved `GET .../tables` responses. The
owner's pinned map is **correct as pinned**, with one addition the pinned list omits.

| # | Gratsi field (verbatim) | parent field (verbatim) | verdict |
|---|---|---|---|
| 1 | `Description  [Age Status Salary]` | `Demographic` | **confirmed** |
| 2 | `Personality` | `Psychographic` | **confirmed** |
| 3 | `Drivers for this persona` | `Core Desires (Cashvertising)` | **confirmed** |
| 4 | `Problem-Solution Awareness Level` | `Stage of Market Awareness (Breakthrough Advertising)` | **confirmed** |
| 5 | `Passion` | *(none)* | **confirmed GRATSI-ONLY** |
| 6 | `Name` | `Persona Name` | **confirmed — not in the pinned list** |

**The double space is real.** The Gratsi field name is `Description` + two spaces + `[Age Status Salary]`.
Python `repr()` on the live metadata gives `'Description  [Age Status Salary]'` and the name contains 4
space characters in total (two in the gap, two inside the brackets). Any inheritance key built from this
name must preserve it byte for byte. The engine already does
(`packages/db/src/airtable-import.ts:749`), as does the mapping doc
(`packages/db/src/scripts/import-mappings.ts:225-227`).

**Addition to the pinned map.** The primary field is also renamed: Gratsi `Name` (`singleLineText`) against
parent `Persona Name` (`multilineText`). Same datum — the engine treats them as one column via
`PERSONA_FIELDS.name = ['Persona Name', 'Name']` (`airtable-import.ts:747`). So Personas has **five**
detached-with-label rows, not four. Note the type differs too (`singleLineText` vs `multilineText`).

**`Passion` is Gratsi-only, confirmed on all three sources.** The parent has no such field. It has its own
Postgres column `passion` added in migration 0044, and the schema comment at
`packages/db/src/schema/personas.ts:35-40` records that it was added to production by hand first, so 0044 is
written idempotent. The engine keeps it in its own alias entry with the comment "Gratsi's own field, and its
own column since migration 0044 — never folded into a neighbour" (`airtable-import.ts:752-753`).

## `PERSONA_FIELDS` already is the inheritance rename map

`packages/db/src/airtable-import.ts:746-767` is the only alias constant in the engine, and its shape is
exactly what the detach-with-label feature needs: one entry per Postgres column, **parent name first**, then
each child's alias. Its own docstring (`:731-745`) states the rule — "`appnaSGAgOUbJ0f9m` is the source of
truth (Talal, 2026-10-02), so a template import needs no alias; a client base that renamed a field is read
through its alias into the same column, which is what makes one importer serve every brand" — and records
that a short-name read "silently missed ELEVEN of the fifteen template fields".

For the inheritance work this is the reference implementation to generalise: the other 13 paired tables do
the same job with scattered inline `??` fallbacks and would each need the same treatment.

## A link field whose label matches but whose target does not

Gratsi `Personas.Angles` and parent `Personas.Angles` are both `multipleRecordLinks` with the identical
name, so they classify IDENTICAL. But they point at different things, because of the id reuse:

- parent `Angles` → `tbl4UFSFcynlS2Pkn`, which in the **parent** is `Angles`. Correct.
- Gratsi `Angles` → `tbl4UFSFcynlS2Pkn`, which in **Gratsi** is `Concepts`. Its inverse field on that table
  is named `Personas` (`fldMf8DR6ji0wVD5z`).

So Gratsi's field **labelled** `Angles` actually links Personas to **Concepts**. This is consistent with the
level shift described above and with the engine's own comment at `airtable-import.ts:1608-1611`. An
inheritance model that treats a link column as "identical, inherit" on name alone would wire Gratsi's
personas to the wrong table.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | RENAMED — parent `Persona Name` | detach-with-label |
| 2 | `Description  [Age Status Salary]` | multilineText | `demographic` | RENAMED — parent `Demographic` | detach-with-label |
| 3 | `Personality` | richText | `psychographic` | RENAMED — parent `Psychographic` | detach-with-label |
| 4 | `Drivers for this persona` | richText | `coreDesires` | RENAMED — parent `Core Desires (Cashvertising)` | detach-with-label |
| 5 | `Passion` | richText | `passion` | GRATSI-ONLY | child-added |
| 6 | `Angles` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 7 | `Problem-Solution Awareness Level` | singleSelect | `stageOfAwareness` | RENAMED — parent `Stage of Market Awareness (Breakthrough Advertising)` | detach-with-label |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (9):

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
---

# 2. Concepts

**Gratsi** `Concepts` `tbl4UFSFcynlS2Pkn`, 23 fields · **Parent** `Concepts` `tblRlcp1ibmS7U7HG`, 22 fields.

Confident renames rest on shared select-option keys, not on name similarity:
`Style` -> `Concept Style` (Gratsi `['Editing','Filming']` against parent
`['Filming Concept','Editing Concept','AI Concept']`) and `Status` -> `Approval Status` (both open with
`Pending For Approval`, `Approved`). `Category` is IDENTICAL in name *and* options (`['New','Iteration']`).
`Production Status` shares the name but no option list (`Done`/`Filming in Progress`/... against
`To Do (approved by client)`/`In Progress...`/`Launched`), so it inherits as a label only.

**Seven fields here are LEVEL-SHIFT, not renames** — `Product`, `Personas`, `Collection`, `Pain Points`,
`USP`, `Type` and the misspelled `Decription` are stored on `Concepts` in Gratsi but live on **parent
`Angles`**, which the parent's `Concepts` reads back as lookups through link field `fldiPSy2ot59FLsQf`. See
*The level shift*.

Pairing Gratsi `Type` with parent `Formats to create` would be wrong: Gratsi `Concepts.Type`'s options match
parent **`Angles.Type`**. The engine nonetheless writes this field into `concepts.formats` — see
*One substantive mapping defect*.

`Decription` is misspelled in the live Gratsi base; the mapping doc records it under that exact spelling and
maps it to `description`.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | IDENTICAL — same name, parent type `formula` | inherit |
| 2 | `Batch` | singleSelect | `batch` | IDENTICAL | inherit |
| 3 | `Theme` | multipleSelects | — (not imported) | RENAMED — parent `Themes` | detach-with-label |
| 4 | `Angle` | multipleRecordLinks | — (not imported) | RENAMED — parent `Angles` | detach-with-label |
| 5 | `Category` | singleSelect | `category` | IDENTICAL | inherit |
| 6 | `Style` | singleSelect | `conceptStyle` | RENAMED — parent `Concept Style` | detach-with-label |
| 7 | `Production Status` | singleSelect | `productionStatus` | IDENTICAL | inherit |
| 8 | `Type` | multipleSelects | `formats` | LEVEL-SHIFT — lives on parent `Angles.Type` | child-added (see note) |
| 9 | `Performance` | multipleLookupValues | `performance` | IDENTICAL | inherit |
| 10 | `Product` | multipleRecordLinks | — (not imported) | LEVEL-SHIFT — lives on parent `Angles.Product` | child-added (see note) |
| 11 | `Personas` | multipleRecordLinks | — (not imported) | LEVEL-SHIFT — lives on parent `Angles.Personas` | child-added (see note) |
| 12 | `Status` | singleSelect | `approvalStatus` | RENAMED — parent `Approval Status` | detach-with-label |
| 13 | `Decription` | multilineText | `description` | LEVEL-SHIFT — lives on parent `Angles.Description` | child-added (see note) |
| 14 | `Script` | richText | `scriptIdea` | RENAMED — parent `Script idea` | detach-with-label |
| 15 | `Collection` | multipleRecordLinks | — (not imported) | LEVEL-SHIFT — lives on parent `Angles.Collection` | child-added (see note) |
| 16 | `Pain Points` | richText | `painPoints` | LEVEL-SHIFT — lives on parent `Angles.Pain Points` | child-added (see note) |
| 17 | `USP` | richText | `usp` | LEVEL-SHIFT — lives on parent `Angles.USP` | child-added (see note) |
| 18 | `Hooks` | richText | `hookExamples` | RENAMED — parent `Hook examples` | detach-with-label |
| 19 | `Client's Comments` | multilineText | `clientComments` | GRATSI-ONLY | child-added |
| 20 | `UGC Management` | multipleRecordLinks | — (not imported) | RENAMED — parent `Creator` | detach-with-label |
| 21 | `Campaigns & Offers` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 22 | `(Internal) Creative Design` | multipleRecordLinks | — (not imported) | RENAMED — parent `Creative Sheet (Internal & Interface)` | detach-with-label |
| 23 | `UGC Management copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (9):

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

---

# 3. Angles

**Gratsi** `Angles` `tblRlcp1ibmS7U7HG`, 21 fields · **Parent** `Angles` `tbl4UFSFcynlS2Pkn`, 11 fields.

The one asserted rename is `(Internal) Creative Design 2` -> parent `(Internal) Creative Design`: Gratsi's
field of that exact name is a residual `singleLineText`, while `... 2` is the live `multipleRecordLinks` to
`tblhU5yVNhVDwykUt`. The mapping doc records the residual-text case at `import-mappings.ts:294-299`.

**This is the one many-to-one pairing in the base** — two Gratsi fields for one parent field — and it is why
the parent cross-foot in *Summary counts* needs a correction of one.

`Formats to create` is **LEVEL-SHIFT**: identical `multipleSelects` options
(`Static`, `Video`, `Carousel`, `Motion Graphic`) to parent **`Concepts.Formats to create`**.

The parent-only block below is the other half of the level shift — `Product`, `Collection`, `Personas`,
`Pain Points`, `USP`, `Type` sit on parent `Angles` and on Gratsi `Concepts`. Reading them as plain "hide"
would be wrong: they are not missing from Gratsi, they moved.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | IDENTICAL | inherit |
| 2 | `Status` | singleSelect | `status` | GRATSI-ONLY | child-added |
| 3 | `Potential` | singleSelect | `potential` | GRATSI-ONLY | child-added |
| 4 | `Description` | multilineText | `description` | IDENTICAL | inherit |
| 5 | `Creators` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 6 | `Concepts` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 7 | `Product (from Angles)` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 8 | `Personas (from Angles)` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 9 | `(Internal) Creative Modules` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 10 | `Formats to create` | multipleSelects | `formats` | LEVEL-SHIFT — lives on parent `Concepts.Formats to create` | child-added (see note) |
| 11 | `Client Notes` | multilineText | `clientNotes` | GRATSI-ONLY | child-added |
| 12 | `(Internal) Creative Design` | singleLineText | — (not imported) | IDENTICAL — same name, parent type `multipleRecordLinks` | inherit |
| 13 | `Brief` | url | `briefUrl` | GRATSI-ONLY | child-added |
| 14 | `Exact Script` | url | `exactScriptUrl` | GRATSI-ONLY | child-added |
| 15 | `Ad Inspo` | multilineText | `adInspoLinks` | GRATSI-ONLY | child-added |
| 16 | `Winning` | checkbox | `winning` | GRATSI-ONLY | child-added |
| 17 | `Internal Notes` | multilineText | `internalNotes` | GRATSI-ONLY | child-added |
| 18 | `Creative Sheet` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 19 | `(Internal) Creative Design 2` | multipleRecordLinks | — (not imported) | RENAMED — parent `(Internal) Creative Design` | detach-with-label |
| 20 | `UGC Management copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 21 | `Concepts copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (7):

| Parent field | type |
|---|---|
| `Type` | multipleSelects |
| `Product` | multipleRecordLinks |
| `Collection` | multipleRecordLinks |
| `Personas` | multipleRecordLinks |
| `Pain Points` | multilineText |
| `USP` | multilineText |
| `Performance (from Concepts)` | multipleLookupValues |

---

# 4. Meta Copywriting

**Gratsi** `Meta Copywriting` `tblZpBYPTcZcmQ1Kf`, 30 fields · **Parent** `Copywriting` `tblZpBYPTcZcmQ1Kf`, 11 fields.

Renames taken from the engine's own fallbacks: Gratsi `Descriptions` -> parent `Primary Copy` (both the
body-copy field; the engine writes either into `primaryCopy`), `News Feed` -> parent
`News Feed / Link Description` (-> `linkDescription`), and `Collections` -> parent `Collection`.

Gratsi carries 13 lookup/rollup fields the parent does not, four residual text fields
(`Creative Reporting`, `Creative Sheet`, `(Internal) Product`, `(Internal) Creative Design 2`) and the
operator-nag field `⚠️ Please Change the Status of the copy`. That last one is a UI prompt, not data; it is
GRATSI-ONLY and should not be promoted into any parent definition.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Copy #` | singleLineText | `copyNumber` | IDENTICAL — same name, parent type `formula` | inherit |
| 2 | `Status` | singleSelect | `status` | IDENTICAL | inherit |
| 3 | `Collections` | multipleRecordLinks | — (not imported) | RENAMED — parent `Collection` | detach-with-label |
| 4 | `Product` | singleLineText | — (not imported) | IDENTICAL — same name, parent type `multipleRecordLinks` | inherit |
| 5 | `Angle` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 6 | `Descriptions` | richText | `primaryCopy` | RENAMED — parent `Primary Copy` | detach-with-label |
| 7 | `Headline` | singleLineText | `headline` | IDENTICAL — same name, parent type `multilineText` | inherit |
| 8 | `News Feed` | singleLineText | `linkDescription` | RENAMED — parent `News Feed / Link Description` | detach-with-label |
| 9 | `CTA` | singleSelect | `cta` | IDENTICAL | inherit |
| 10 | `Campaign Code` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 11 | `Offer` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 12 | `Campaign (from Campaign)` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 13 | `Code (from Campaign)` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 14 | `Funnel` | singleSelect | `funnel` | GRATSI-ONLY | child-added |
| 15 | `Copy Type` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 16 | `Client's Comment` | multilineText | `clientComment` | GRATSI-ONLY | child-added |
| 17 | `Creative` | multipleRecordLinks | `creativeBriefId` | IDENTICAL | inherit |
| 18 | `Collection URL` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 19 | `Link (from Product)` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 20 | `USED` | checkbox | `used` | IDENTICAL | inherit |
| 21 | `Winning` | checkbox | `winning` | GRATSI-ONLY | child-added |
| 22 | `Meta Rating` | rating | `metaRating` | GRATSI-ONLY | child-added |
| 23 | `Products (from Collections)` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 24 | `Created By` | createdBy | — (not imported) | GRATSI-ONLY | child-added |
| 25 | `Creative Reporting` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 26 | `Creative Sheet` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 27 | `(Internal) Product` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 28 | `(Internal) Creative Design` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 29 | `⚠️ Please Change the Status of the copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 30 | `(Internal) Creative Design 2` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (1):

| Parent field | type |
|---|---|
| `Autonumber` | autoNumber |

---

# 5. Creative Design (Internal & Interface)

**Gratsi** `Creative Design (Internal & Interface)` `tblhU5yVNhVDwykUt`, 42 fields · **Parent** `Creative Sheet (Internal & Interface)` `tblhU5yVNhVDwykUt`, 35 fields.

The strongest pairing in the base: **28 exact field-name matches**. Renames: `Brief to Design/Editing` ->
parent `Brief` and `Script / Ad Content` -> parent `Ad Content` (both `richText` pairs, written to
`briefToDesign` / `scriptContent`), and `(Internal) Collections 3` -> parent `Collection` (the live link;
`(Internal) Collections 2` is the residual text).

Three cautions:

1. `Inspiration` is IDENTICAL by name but `multipleAttachments` in Gratsi against `richText` in the parent,
   and the parent *also* has a separate `Inspiration Image` (`multipleAttachments`). Gratsi's single field
   may well correspond to the parent's `Inspiration Image`, which would make `Inspiration` a crossed pair.
   **I cannot establish which of the two parent fields Gratsi's `Inspiration` descends from** from metadata
   alone — it needs an owner answer.
2. `Batch` is a stored `singleSelect` in Gratsi (`B1`..`B20`); the parent has only `Batch (from Concepts)`,
   a lookup. Another level shift — Gratsi stores the batch on the creative, the parent derives it from the
   concept.
3. Several same-named `singleSelect` fields carry polluted Gratsi option lists: `Type` includes `'s'` and
   `'High (24 hours)'` (a priority value leaked into the type field), `Source` includes
   `'Facebook Reels, Facebook Feed Square'`, `Funnel` includes `'TAS'`, and `Platform` includes
   `'Use different relevant visuals from the girls gathering folder that I shared in the previous batch'`.
   That is data-entry damage in the child, not column structure, and must not propagate upward.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | IDENTICAL | inherit |
| 2 | `Type` | singleSelect | `type` | IDENTICAL | inherit |
| 3 | `Priority` | singleSelect | `priority` | IDENTICAL | inherit |
| 4 | `Internal Status` | singleSelect | `internalStatus` | IDENTICAL | inherit |
| 5 | `Client Status` | singleSelect | `clientStatus` | IDENTICAL | inherit |
| 6 | `Performance` | singleSelect | `performance` | IDENTICAL | inherit |
| 7 | `Assignee` | singleCollaborator | `assignee` | IDENTICAL | inherit |
| 8 | `Batch` | singleSelect | `batch` | GRATSI-ONLY | child-added |
| 9 | `QA Checklist Doc` | multipleAttachments | `qaChecklistDoc` | IDENTICAL | inherit |
| 10 | `Video Editor QA` | checkbox | `qaVideoEditor` | IDENTICAL | inherit |
| 11 | `Graphic Designer QA` | checkbox | `qaDesigner` | IDENTICAL | inherit |
| 12 | `Creative Strategist QA` | checkbox | `qaStrategist` | IDENTICAL | inherit |
| 13 | `Angle` | multipleRecordLinks | `angleId` | IDENTICAL | inherit |
| 14 | `Concept` | multipleRecordLinks | `conceptId` | IDENTICAL | inherit |
| 15 | `(Internal) Product` | multipleRecordLinks | `productId` | IDENTICAL | inherit |
| 16 | `Language` | singleSelect | `language` | GRATSI-ONLY | child-added |
| 17 | `Design File` | multipleAttachments | `designFile` | IDENTICAL | inherit |
| 18 | `Design Link URL` | singleLineText | `designFileUrl` | IDENTICAL | inherit |
| 19 | `Inspiration` | multipleAttachments | `inspirationImage` | IDENTICAL — same name, parent type `richText` | inherit |
| 20 | `Brief to Design/Editing` | richText | `briefToDesign` | RENAMED — parent `Brief` | detach-with-label |
| 21 | `Script / Ad Content` | richText | `scriptContent` | RENAMED — parent `Ad Content` | detach-with-label |
| 22 | `Platform` | multipleSelects | `platform` | IDENTICAL | inherit |
| 23 | `Dimensions` | multipleRecordLinks | `dimensions` | IDENTICAL | inherit |
| 24 | `Source` | singleSelect | `source` | IDENTICAL | inherit |
| 25 | `Funnel` | singleSelect | `funnel` | IDENTICAL | inherit |
| 26 | `Elements we are Testing` | richText | `elementsTested` | IDENTICAL | inherit |
| 27 | `Offer` | richText | `offer` | GRATSI-ONLY | child-added |
| 28 | `Creative Module` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 29 | `Last Modified` | lastModifiedTime | — (not imported) | IDENTICAL | inherit |
| 30 | `Created` | createdTime | — (not imported) | IDENTICAL | inherit |
| 31 | `Click for AI Spell Checker Again` | checkbox | `clickForAiSpellChecker` | IDENTICAL | inherit |
| 32 | `Spelling Feedback` | multilineText | `spellingFeedback` | IDENTICAL | inherit |
| 33 | `Spelling Feedback 2` | multilineText | `spellingFeedback2` | GRATSI-ONLY | child-added |
| 34 | `Created 2` | createdTime | — (absent from mapping doc) | GRATSI-ONLY | child-added |
| 35 | `(Internal) Collections 2` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 36 | `(Internal) Collections 3` | multipleRecordLinks | `collectionId` | RENAMED — parent `Collection` | detach-with-label |
| 37 | `Creative Sheet` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 38 | `Ads Copywriting copy` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 39 | `Meta Copywriting` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 40 | `Script & brief breakdown ` | multipleAttachments | `scriptAndBriefBreakdown` | IDENTICAL | inherit |
| 41 | `Angles` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 42 | `Concepts (from Angles)` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (4):

| Parent field | type |
|---|---|
| `Batch (from Concepts)` | multipleLookupValues |
| `Inspiration Image` | multipleAttachments |
| `Campaigns & Offers` | multipleRecordLinks |
| `Assets` | multipleRecordLinks |

---

# 6. (Internal) Creative Modules

**Gratsi** `(Internal) Creative Modules` `tblzS73a9JrJGiV2J`, 4 fields · **Parent** `Themes` `tblzS73a9JrJGiV2J`, 3 fields.

**Flagged pairing.** Gratsi `(Internal) Creative Modules` against the parent table *labelled* `Themes`,
same id `tblzS73a9JrJGiV2J`. See *Flagged pairing 1* for the evidence and the open question.

`Foreplay Link` (url) -> parent `Reference Link` (singleLineText) is the one rename: same role, each the
module's single outbound reference.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Module Name` | singleLineText | `moduleName` | IDENTICAL | inherit |
| 2 | `Concepts` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 3 | `Foreplay Link` | url | `foreplayLink` | RENAMED — parent `Reference Link` | detach-with-label |
| 4 | `(Internal) Creative Design` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |

---

# 7. Creative Sheet

**Gratsi** `Creative Sheet` `tblGC0TxnHI7lKaNQ`, 29 fields · **Parent** `DONT USE Creative Sheet` `tblGC0TxnHI7lKaNQ`, 17 fields.

**Flagged pairing** — the parent's copy is named `DONT USE Creative Sheet`. See *Flagged pairing 2*. I give
the diff but withhold an inherit verdict for the table as a whole.

Renames: the formula primary field `Name` -> parent `Name + Angle + Offer`, and
`Design File (from Creative Name)` -> parent `Design File` (both lookups of the same attachment).

Of the 29 Gratsi fields, **15 are absent from the mapping doc** and the engine reads none of them. That is
by design rather than loss: 13 are `multipleLookupValues` reached through the `Creative Name` link and 2 are
system timestamps (`Created`, `Last Modified`). The engine states the rule at
`packages/db/src/airtable-import.ts:1369-1372` — the lookups "are joins, never columns, so they surface in
the unmapped-field report on purpose." The doc gap is still worth closing so the two files agree.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | formula | — (not imported) | RENAMED — parent `Name + Angle + Offer` | detach-with-label |
| 2 | `Creative Name` | multipleRecordLinks | `briefId` | IDENTICAL — same name, parent type `singleLineText` | inherit |
| 3 | `Performance (from Creative Name)` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 4 | `(Internal) Product (from Creative Name)` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 5 | `Angle (from Creative Name)` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 6 | `Concepts (from Angle) (from Creative Name)` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 7 | `Elements we are Testing` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 8 | `Design File (from Creative Name)` | multipleLookupValues | — (absent from mapping doc) | RENAMED — parent `Design File` | detach-with-label |
| 9 | `Design Link URL` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 10 | `Internal Status` | singleSelect | `internalStatus` | GRATSI-ONLY | child-added |
| 11 | `Status` | singleSelect | `status` | IDENTICAL | inherit |
| 12 | `QA Checklist Doc` | multipleAttachments | `qaChecklistDoc` | GRATSI-ONLY | child-added |
| 13 | `Video Editor QA` | checkbox | `qaVideoEditor` | GRATSI-ONLY | child-added |
| 14 | `Graphic Designer QA` | checkbox | `qaDesigner` | GRATSI-ONLY | child-added |
| 15 | `Creative Strategist QA` | checkbox | `qaStrategist` | GRATSI-ONLY | child-added |
| 16 | `Client's Comments` | multilineText | `clientComments` | IDENTICAL | inherit |
| 17 | `Collection` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 18 | `Platform` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 19 | `Funnel` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 20 | `Type` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 21 | `Proposed Copy` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY | child-added |
| 22 | `Creative Module` | multipleLookupValues | — (absent from mapping doc) | IDENTICAL | inherit |
| 23 | `Used` | checkbox | `used` | GRATSI-ONLY | child-added |
| 24 | `Denied/revisions needed` | checkbox | `deniedRevisionsNeeded` | GRATSI-ONLY | child-added |
| 25 | `Winning` | singleSelect | `winning` | GRATSI-ONLY | child-added |
| 26 | `Created` | createdTime | — (absent from mapping doc) | GRATSI-ONLY | child-added |
| 27 | `Last Modified` | lastModifiedTime | — (absent from mapping doc) | IDENTICAL | inherit |
| 28 | `Click for AI Spell Checker Again` | checkbox | `spellCheckRequested` | GRATSI-ONLY | child-added |
| 29 | `Spelling Feedback` | multilineText | `spellingFeedback` | GRATSI-ONLY | child-added |

---

# 8. UGC Management

**Gratsi** `UGC Management` `tblRsVqiqUaZRcQYd`, 36 fields · **Parent** `UGC Management` `tblRsVqiqUaZRcQYd`, 32 fields.

25 exact name matches. Renames asserted from the engine's inline fallbacks, which pair the two bases'
spellings directly: `Additional Note - TAS Team` -> parent `Internal Brief`
(`packages/db/src/airtable-import.ts:1136`), `Concept to film` -> parent `Concepts to film` (both
`multipleRecordLinks`, each to its own base's Concepts table — a clean by-meaning resolution of the id
reuse), `Creator's video Intro` -> parent `Creator's Video Intro` (casing only), and `Creator Status` ->
parent `Internal Creator's Status` (both feed `internalCreatorStatus`, `:1158`). The last pair shares a role
but **not** a vocabulary — Gratsi's options are brief/assets workflow states
(`Waiting for creator's response on the brief`, `Declined the brief`, ...) while the parent's are approval
states (`(Internal) Request`, `(Internal) Pending for CS Approval`, ...). Detaching the label is not enough
here; the option set differs too.

A correction worth recording, because the obvious guess is wrong: `Partnership Activity` is **IDENTICAL**,
not a rename. It exists in both bases with the same name *and* the same options
`['Yes','Not Active','Active','Ended']`. The parent's `For Partnership Ads?` (`['Yes','No']`) is a separate,
**PARENT-ONLY** field. I had initially paired them and the live option lists disproved it.

`Creator's cost (USD)` is IDENTICAL by name but a `formula` in Gratsi against `currency` in the parent.
Gratsi's real stored cost is the GRATSI-ONLY `Creator's cost (USD) - Internal`, which is what the engine
reads into `creatorCost` (`:1142`). An inheritance model attaching the child's `Creator's cost (USD)` to the
parent's would bind a formula to a stored column.

Two field names here carry a trailing space in the live base: `Tracking Number ` and `Slack Notified `. The
engine handles both (`:1138`, `:1188`).

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Creator name (Filled by UGC Manager)` | singleLineText | `name` | IDENTICAL | inherit |
| 2 | `Status` | singleSelect | `internalCreatorStatus` | IDENTICAL | inherit |
| 3 | `Date of Management` | date | `dateOfManagement` | IDENTICAL | inherit |
| 4 | `Age` | singleSelect | `ageBracket` | IDENTICAL | inherit |
| 5 | `Gender` | singleSelect | `gender` | IDENTICAL | inherit |
| 6 | `Ethnicity` | singleLineText | `ethnicity` | IDENTICAL | inherit |
| 7 | `Concept to film` | multipleRecordLinks | — (not imported) | RENAMED — parent `Concepts to film` | detach-with-label |
| 8 | `Products` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 9 | `Budget per 60sec video` | currency | `budgetPer60s` | IDENTICAL | inherit |
| 10 | `Partnership Activity` | singleSelect | `partnershipActivity` | IDENTICAL | inherit |
| 11 | `Creator's video Intro` | multipleAttachments | `videoIntroUrl` | RENAMED — parent `Creator's Video Intro` | detach-with-label |
| 12 | `Creator's Profile Pic` | multipleAttachments | `profilePicUrl` | IDENTICAL | inherit |
| 13 | `Facebook Profile for Partnership` | richText | `facebookProfileUrl` | IDENTICAL | inherit |
| 14 | `Platform` | singleSelect | `platform` | IDENTICAL | inherit |
| 15 | `(Client's) Note or Comments` | multilineText | `clientNote` | IDENTICAL | inherit |
| 16 | `Additional Note - TAS Team` | richText | `internalBrief` | RENAMED — parent `Internal Brief` | detach-with-label |
| 17 | `Creator's cost (USD) - Internal` | currency | `creatorCost` | GRATSI-ONLY | child-added |
| 18 | `Raw assets` | url | `rawAssetsUrl` | IDENTICAL | inherit |
| 19 | `Shipping Location` | multilineText | `shippingLocation` | IDENTICAL | inherit |
| 20 | `Tracking Number ` | singleLineText | `trackingNumber` | IDENTICAL | inherit |
| 21 | `Creator Link` | url | `creatorLink` | IDENTICAL | inherit |
| 22 | `Creator Status` | singleSelect | `clientStatus` | RENAMED — parent `Internal Creator's Status` | detach-with-label |
| 23 | `Paid by TAS` | currency | `costUsd` | GRATSI-ONLY | child-added |
| 24 | `Payment Date` | date | `paymentDate` | GRATSI-ONLY | child-added |
| 25 | `Concepts` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 26 | `Creator Info Request` | richText | `creatorInfoRequest` | GRATSI-ONLY | child-added |
| 27 | `Creator's cost (USD)` | formula | — (not imported) | IDENTICAL — same name, parent type `currency` | inherit |
| 28 | `Date of Partnership Activation` | date | `partnershipActivatedAt` | IDENTICAL | inherit |
| 29 | `Notify Flag` | formula | — (not imported) | GRATSI-ONLY | child-added |
| 30 | `Slack Notified ` | checkbox | `slackNotified` | GRATSI-ONLY | child-added |
| 31 | `Partnership Time Period (days)` | number | `partnershipPeriodDays` | IDENTICAL | inherit |
| 32 | `Continue Working With?` | singleSelect | `continueWorkingWith` | IDENTICAL | inherit |
| 33 | `Extension Time Period` | singleSelect | `extensionDays` | IDENTICAL | inherit |
| 34 | `Partnership Price per 30 days` | currency | `partnershipPricePer30Days` | IDENTICAL | inherit |
| 35 | `Notes for Partnership ads` | multilineText | `partnershipNotes` | IDENTICAL | inherit |
| 36 | `Instagram Username` | singleLineText | `instagramUsername` | IDENTICAL | inherit |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (3):

| Parent field | type |
|---|---|
| `(Internal) Deadline for the request` | date |
| `For Partnership Ads?` | singleSelect |
| `Internal Assets Status` | singleSelect |

---

# 9. (Internal) Collections

**Gratsi** `(Internal) Collections` `tbl6LBNrRqa6Hh4I2`, 13 fields · **Parent** `(Internal) Collections` `tbl6LBNrRqa6Hh4I2`, 8 fields.

`Main Collection` -> parent `Collection Name` is the primary-field rename.

**One of the two tables that break name-uniqueness**: it has **two distinct fields both named**
`Email Campaigns Management copy` (rows 11 and 12 below are different fields with the same name). Three
same-named fields also differ in type across the bases (`(Internal) Product`,
`(Internal) Creative Design`, `(Internal) Creative Design 2`) — the converted-link residue pattern.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Main Collection` | singleLineText | `name` | RENAMED — parent `Collection Name` | detach-with-label |
| 2 | `URL` | url | `url` | IDENTICAL | inherit |
| 3 | `Copywriting` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 4 | `Campaigns & Offers` | multipleRecordLinks | `campaignId` | IDENTICAL | inherit |
| 5 | `Creative Sheet` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 6 | `Angles` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 7 | `(Internal) Product` | singleLineText | — (not imported) | IDENTICAL — same name, parent type `multipleRecordLinks` | inherit |
| 8 | `(Internal) Creative Design` | multipleRecordLinks | — (not imported) | IDENTICAL — same name, parent type `singleLineText` | inherit |
| 9 | `(Internal) Creative Design 2` | singleLineText | `creativeDesignNote` | IDENTICAL — same name, parent type `multipleRecordLinks` | inherit |
| 10 | `Table 17` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 11 | `Email Campaigns Management copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 12 | `Email Campaigns Management copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 13 | `Ads Copywriting copy` | multipleRecordLinks | `copywritingId` | IDENTICAL | inherit |

---

# 10. (Internal) Product

**Gratsi** `(Internal) Product` `tblfvfJMYNBz2OYYw`, 11 fields · **Parent** `(Internal) Product` `tblfvfJMYNBz2OYYw`, 8 fields.

No renames asserted. **The second name-uniqueness break**: two distinct fields both named
`Email Campaigns Management copy` (rows 6 and 7 below).

The parent-only fields are reverse links (`(Internal) Collections`, `Campaigns & Offers`,
`Meta Copywriting`), so "hide" here concerns link wiring rather than user-visible columns.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Product Name / Landing Page Name` | multilineText | `name` | IDENTICAL | inherit |
| 2 | `Link` | url | `link` | IDENTICAL | inherit |
| 3 | `(Internal) Creative Design 2` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 4 | `Angles` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 5 | `Table 17` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 6 | `Email Campaigns Management copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 7 | `Email Campaigns Management copy` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 8 | `Youtube Copywriting` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 9 | `Creative Sheet` | singleLineText | — (not imported) | GRATSI-ONLY | child-added |
| 10 | `(Internal) Creative Design` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 11 | `UGC Management` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (3):

| Parent field | type |
|---|---|
| `(Internal) Collections` | multipleRecordLinks |
| `Campaigns & Offers` | multipleRecordLinks |
| `Meta Copywriting` | multipleRecordLinks |

---

# 11. Campaigns & Offers

**Gratsi** `Campaigns & Offers` `tblRNaWCVa1cCIwLL`, 20 fields · **Parent** `Campaigns & Offers` `tblRNaWCVa1cCIwLL`, 14 fields.

`Interested` (checkbox) -> parent `Confirmed by Client` (checkbox) is the one rename, and the engine states
it outright: `confirmedByClient: bool(f.Interested ?? f['Confirmed by Client'])`
(`packages/db/src/airtable-import.ts:855`).

`Design attached` is IDENTICAL by name but `singleLineText` in Gratsi against `multipleRecordLinks` in the
parent — converted-link residue again.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | formula | `name` | IDENTICAL | inherit |
| 2 | `Holiday` | singleLineText | `holiday` | IDENTICAL | inherit |
| 3 | `Official Date` | date | `officialDate` | IDENTICAL | inherit |
| 4 | `Country` | singleLineText | `country` | IDENTICAL | inherit |
| 5 | `Description` | multilineText | `description` | IDENTICAL | inherit |
| 6 | `Promotional Ideas` | richText | `promotionalIdeas` | GRATSI-ONLY | child-added |
| 7 | `Interested` | checkbox | `confirmedByClient` | RENAMED — parent `Confirmed by Client` | detach-with-label |
| 8 | `Launched` | checkbox | `launched` | IDENTICAL | inherit |
| 9 | `Ads Launch Date` | date | `adsLaunchDate` | IDENTICAL | inherit |
| 10 | `Ads End Date` | date | `adsEndDate` | IDENTICAL | inherit |
| 11 | `Discount Offer` | singleLineText | `discountOffer` | IDENTICAL | inherit |
| 12 | `Code` | singleLineText | `code` | IDENTICAL | inherit |
| 13 | `Collections` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |
| 14 | `Product` | multipleLookupValues | — (not imported) | GRATSI-ONLY | child-added |
| 15 | `COPY` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 16 | `Angles` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 17 | `Design attached` | singleLineText | — (not imported) | IDENTICAL — same name, parent type `multipleRecordLinks` | inherit |
| 18 | `Email Campaigns` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 19 | `Email Campaigns Management copy` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |
| 20 | `Ads Copywriting copy` | multipleRecordLinks | — (not imported) | GRATSI-ONLY | child-added |

Parent-only fields on this pair — **PARENT-ONLY**, seed verdict **hide** (1):

| Parent field | type |
|---|---|
| `(Internal) Product` | multipleRecordLinks |

---

# 12. (Internal) Creative Dimensions

**Gratsi** `(Internal) Creative Dimensions` `tblli0Y76yJvG56zK`, 4 fields · **Parent** `(Internal) Creative Dimensions` `tblli0Y76yJvG56zK`, 4 fields.

**The only table whose column set is byte-identical across the two bases**: 4 fields, same names, same
types, nothing added and nothing hidden. This is what a fully attached child table looks like, and it is the
natural smoke test for the inheritance feature.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | IDENTICAL | inherit |
| 2 | `Dimensions` | singleLineText | `dimensions` | IDENTICAL | inherit |
| 3 | `Link Description` | singleSelect | `linkDescription` | IDENTICAL | inherit |
| 4 | `(Internal) Creative Design` | multipleRecordLinks | — (not imported) | IDENTICAL | inherit |

---

# 13. Competitive research

**Gratsi** `Competitive research` `tbl9W6v78tKWznN9S`, 7 fields · **Parent** `Competitive research` `tbl9W6v78tKWznN9S`, 7 fields.

Field names identical 7 for 7, nothing added or hidden, and no type divergence on this pair.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | IDENTICAL | inherit |
| 2 | `Type` | singleSelect | `type` | IDENTICAL | inherit |
| 3 | `Website` | singleLineText | `website` | IDENTICAL | inherit |
| 4 | `Insta` | singleLineText | `instagram` | IDENTICAL | inherit |
| 5 | `FB Page` | singleLineText | `facebookPage` | IDENTICAL | inherit |
| 6 | `Meta Ads Library` | multilineText | `metaAdsLibrary` | IDENTICAL | inherit |
| 7 | `Analysis` | multilineText | `analysis` | IDENTICAL | inherit |

---

# 14. Client Assets Organisation

**Gratsi** `Client Assets Organisation` `tbldFmPU6AWg62Fll`, 4 fields · **Parent** `Client Assets Organisation` `tbldFmPU6AWg62Fll`, 4 fields.

Names identical 4 for 4. The only difference is type: `(Internal) Creative Design` is `singleLineText` in
Gratsi against `multipleRecordLinks` in the parent — converted-link residue, so Gratsi's copy holds text
where the parent holds a link.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name [Folder]` | singleLineText | `name` | IDENTICAL | inherit |
| 2 | `Description` | multilineText | `description` | IDENTICAL | inherit |
| 3 | `Location` | url | `locationUrl` | IDENTICAL | inherit |
| 4 | `(Internal) Creative Design` | singleLineText | — (not imported) | IDENTICAL — same name, parent type `multipleRecordLinks` | inherit |

---

# 15. Themes — Gratsi-only table

**Gratsi** `Themes` `tbl1aFLMJXxhdVKiz`, 6 fields · **Parent** no counterpart.

**Gratsi-only table.** The parent base has no themes table: the parent table *named* `Themes` is a modules
table (section 6, *Flagged pairing 1*). So all 6 fields are child-added and there is nothing to inherit.

This collides with `CLAUDE.md` non-negotiable 3, which makes Themes a **global** library across all brands
while every other table is per-brand and seeded from the parent. On this metadata the parent template
defines no themes columns to seed from. Owner decision, not mine.

Related: the themes row builder reads `Category` and `Is Active`, which this table does not define, so every
imported Gratsi theme lands with `category = 'Framework'`. See *Engine vs mapping doc*.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | GRATSI-ONLY — parent base has no such table | child-added |
| 2 | `Notes` | multilineText | `notes` | GRATSI-ONLY — parent base has no such table | child-added |
| 3 | `Assignee` | singleCollaborator | `assigneeId` | GRATSI-ONLY — parent base has no such table | child-added |
| 4 | `Status` | singleSelect | `status` | GRATSI-ONLY — parent base has no such table | child-added |
| 5 | `Attachments` | multipleAttachments | `attachments` | GRATSI-ONLY — parent base has no such table | child-added |
| 6 | `Attachment Summary` | aiText | `aiAttachmentSummary` | GRATSI-ONLY — parent base has no such table | child-added |

---

# 16. Youtube Copywriting — Gratsi-only table

**Gratsi** `Youtube Copywriting` `tblVR1UmkbDoDzJ7z`, 29 fields · **Parent** no counterpart.

**Gratsi-only table.** The parent's single `Copywriting` table pairs with Gratsi's `Meta Copywriting`
(section 4), leaving the YouTube variant with no parent counterpart — all 29 fields are child-added.

8 are absent from the mapping doc (`Offer`, `Campaign (from Campaign)`, `Code (from Campaign)`, `Creative`,
`Collection URL`, `Link (from Product)`, `Products (from Collections)`, `Created By`). The engine's
`youtubeCopy` builder (`packages/db/src/airtable-import.ts:1102-1118`) reads 12 fields and none of those 8,
all of which are lookups or `createdBy`. Doc gap, not data loss.

Note `Descriptions (90 caractères max)`: the live field name is part-French and the engine reads that exact
spelling (`:1107`).

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Copy #` | singleLineText | `copyNumber` | GRATSI-ONLY — parent base has no such table | child-added |
| 2 | `Status` | singleSelect | `status` | GRATSI-ONLY — parent base has no such table | child-added |
| 3 | `Collections` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 4 | `Product` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 5 | `Angle` | singleLineText | `angle` | GRATSI-ONLY — parent base has no such table | child-added |
| 6 | `Descriptions (90 caractères max)` | richText | `descriptions` | GRATSI-ONLY — parent base has no such table | child-added |
| 7 | `Headline` | singleLineText | `headline` | GRATSI-ONLY — parent base has no such table | child-added |
| 8 | `News Feed` | singleLineText | `newsFeed` | GRATSI-ONLY — parent base has no such table | child-added |
| 9 | `CTA` | singleSelect | `cta` | GRATSI-ONLY — parent base has no such table | child-added |
| 10 | `Campaign Code` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 11 | `Offer` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 12 | `Campaign (from Campaign)` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 13 | `Code (from Campaign)` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 14 | `Funnel` | singleSelect | `funnel` | GRATSI-ONLY — parent base has no such table | child-added |
| 15 | `Copy Type` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 16 | `Client's Comment` | multilineText | `clientComment` | GRATSI-ONLY — parent base has no such table | child-added |
| 17 | `Creative` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 18 | `Collection URL` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 19 | `Link (from Product)` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 20 | `USED` | checkbox | `used` | GRATSI-ONLY — parent base has no such table | child-added |
| 21 | `Winning` | checkbox | `winning` | GRATSI-ONLY — parent base has no such table | child-added |
| 22 | `Meta Rating` | rating | `metaRating` | GRATSI-ONLY — parent base has no such table | child-added |
| 23 | `Products (from Collections)` | multipleLookupValues | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 24 | `Created By` | createdBy | — (absent from mapping doc) | GRATSI-ONLY — parent base has no such table | child-added |
| 25 | `Creative Reporting` | singleLineText | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 26 | `Creative Sheet` | singleLineText | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 27 | `(Internal) Product` | singleLineText | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 28 | `(Internal) Creative Design` | singleLineText | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 29 | `⚠️ Please Change the Status of the copy` | singleLineText | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |

---

# 17. Email Campaigns Management — Gratsi-only table

**Gratsi** `Email Campaigns Management` `tblABjVpwRpYtY7de`, 17 fields · **Parent** no counterpart.

**Gratsi-only table**, 17 fields, all child-added. The mapping doc covers all 17.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | GRATSI-ONLY — parent base has no such table | child-added |
| 2 | `Campaign Purpose` | multilineText | `campaignPurpose` | GRATSI-ONLY — parent base has no such table | child-added |
| 3 | `Status` | singleSelect | `status` | GRATSI-ONLY — parent base has no such table | child-added |
| 4 | `Send Date` | date | `sendDate` | GRATSI-ONLY — parent base has no such table | child-added |
| 5 | `Copywriting Due Date` | formula | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 6 | `Copywriting` | richText | `copywriting` | GRATSI-ONLY — parent base has no such table | child-added |
| 7 | `Design Due Date` | formula | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 8 | `Assignee` | singleCollaborator | `assigneeId` | GRATSI-ONLY — parent base has no such table | child-added |
| 9 | `Copy Link` | url | `copyLink` | GRATSI-ONLY — parent base has no such table | child-added |
| 10 | `Design` | multipleAttachments | `design` | GRATSI-ONLY — parent base has no such table | child-added |
| 11 | `Klaviyo Link` | url | `klaviyoLink` | GRATSI-ONLY — parent base has no such table | child-added |
| 12 | `Assets` | multipleAttachments | `assets` | GRATSI-ONLY — parent base has no such table | child-added |
| 13 | `Type` | singleSelect | `type` | GRATSI-ONLY — parent base has no such table | child-added |
| 14 | `Channel` | singleSelect | `channel` | GRATSI-ONLY — parent base has no such table | child-added |
| 15 | `Campaigns & Offers` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 16 | `(Internal) Product` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 17 | `(Internal) Collections` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |

---

# 18. Email Flows Management — Gratsi-only table

**Gratsi** `Email Flows Management` `tblubVflAQZgJSxcF`, 13 fields · **Parent** no counterpart.

**Gratsi-only table**, 13 fields, all child-added. The mapping doc covers all 13.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Flow Name` | singleLineText | `flowName` | GRATSI-ONLY — parent base has no such table | child-added |
| 2 | `Expected Setup Date` | date | `expectedSetupDate` | GRATSI-ONLY — parent base has no such table | child-added |
| 3 | `Flow Purpose` | multilineText | `flowPurpose` | GRATSI-ONLY — parent base has no such table | child-added |
| 4 | `Status` | singleSelect | `status` | GRATSI-ONLY — parent base has no such table | child-added |
| 5 | `Copywriting Due Date` | formula | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 6 | `Design Due Date` | formula | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 7 | `Copywriting` | richText | `copywriting` | GRATSI-ONLY — parent base has no such table | child-added |
| 8 | `Design` | multipleAttachments | `design` | GRATSI-ONLY — parent base has no such table | child-added |
| 9 | `Klaviyo Link` | url | `klaviyoLink` | GRATSI-ONLY — parent base has no such table | child-added |
| 10 | `Type` | singleSelect | `type` | GRATSI-ONLY — parent base has no such table | child-added |
| 11 | `Campaigns & Offers` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 12 | `Inspo` | multipleAttachments | `inspo` | GRATSI-ONLY — parent base has no such table | child-added |
| 13 | `Assignee` | singleCollaborator | `assigneeId` | GRATSI-ONLY — parent base has no such table | child-added |

---

# 19. SM Campaign Management Feed — Gratsi-only table

**Gratsi** `SM Campaign Management Feed` `tblLRajTW55XEhVhk`, 6 fields · **Parent** no counterpart.

**Gratsi-only table**, 6 fields, all child-added. `Reminder Trigger` is a clock formula, not storable
structure.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Task Name` | singleLineText | `taskName` | GRATSI-ONLY — parent base has no such table | child-added |
| 2 | `Platform` | singleSelect | `platform` | GRATSI-ONLY — parent base has no such table | child-added |
| 3 | `Due Date` | dateTime | `dueDate` | GRATSI-ONLY — parent base has no such table | child-added |
| 4 | `Status` | singleSelect | `status` | GRATSI-ONLY — parent base has no such table | child-added |
| 5 | `Notes` | multilineText | `notes` | GRATSI-ONLY — parent base has no such table | child-added |
| 6 | `Reminder Trigger` | formula | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |

---

# 20. (Internal) Copy Type — Gratsi-only table

**Gratsi** `(Internal) Copy Type` `tblQiBPj9ypCmYxev`, 4 fields · **Parent** no counterpart.

**Gratsi-only table**, 4 fields, all child-added. Its `Copywriting` link points at `tblVR1UmkbDoDzJ7z`
(`Youtube Copywriting`) while `Ads Copywriting copy` points at `tblZpBYPTcZcmQ1Kf` (`Meta Copywriting`) — so
the label `Copywriting` does not mean the Meta table here.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Name` | singleLineText | `name` | GRATSI-ONLY — parent base has no such table | child-added |
| 2 | `Description` | multilineText | `description` | GRATSI-ONLY — parent base has no such table | child-added |
| 3 | `Copywriting` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 4 | `Ads Copywriting copy` | multipleRecordLinks | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |

---

# 21. Creative Reporting — Gratsi-only table

**Gratsi** `Creative Reporting` `tblgW4bwDSSeqihlr`, 14 fields · **Parent** no counterpart.

**Gratsi-only table**, 14 fields, all child-added: the whole performance-reporting surface is a Gratsi
addition with no parent definition.

## Field table

| # | Gratsi field | type | Postgres column | vs parent | seed verdict |
|---|---|---|---|---|---|
| 1 | `Creative Name` | formula | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 2 | `Name + Angle + Offer` | singleLineText | `nameAngleOffer` | GRATSI-ONLY — parent base has no such table | child-added |
| 3 | `Notes` | multilineText | `notes` | GRATSI-ONLY — parent base has no such table | child-added |
| 4 | `Ad Design` | multipleAttachments | `adDesign` | GRATSI-ONLY — parent base has no such table | child-added |
| 5 | `Ad Link` | singleLineText | `adLink` | GRATSI-ONLY — parent base has no such table | child-added |
| 6 | `CTR` | percent | `ctr` | GRATSI-ONLY — parent base has no such table | child-added |
| 7 | `Thumb-Stop Rate` | number | `thumbStopRate` | GRATSI-ONLY — parent base has no such table | child-added |
| 8 | `Results` | number | `results` | GRATSI-ONLY — parent base has no such table | child-added |
| 9 | `CPA` | currency | `cpa` | GRATSI-ONLY — parent base has no such table | child-added |
| 10 | `Target CPA` | currency | `targetCpa` | GRATSI-ONLY — parent base has no such table | child-added |
| 11 | `Difference CPA` | formula | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
| 12 | `ROAS` | number | `roas` | GRATSI-ONLY — parent base has no such table | child-added |
| 13 | `Target ROAS` | number | `targetRoas` | GRATSI-ONLY — parent base has no such table | child-added |
| 14 | `Creative Name (from Creative)` | multipleLookupValues | — (not imported) | GRATSI-ONLY — parent base has no such table | child-added |
