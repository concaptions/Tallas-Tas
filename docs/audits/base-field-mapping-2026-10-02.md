# Airtable base field mapping — TEMPLATE vs GRATSI (2026-10-02)

Field-by-field comparison of the two live Airtable bases, read from the Metadata API on 2026-10-02.

- **TEMPLATE base** `appnaSGAgOUbJ0f9m` — the source of truth as of 2026-10-02.
- **CLIENT base** `appllDG4OmkK2Hdnn` — Gratsi.

Every field name in this document is quoted **verbatim** as `GET /v0/meta/bases/{baseId}/tables`
returns it, including double spaces, trailing spaces, typos and emoji. Where a claim could not be
established from the metadata, the row says so in those words rather than guessing.

## How to reproduce

```
PAT=$(grep -E '^AIRTABLE_PAT=' "/Users/macbook/Tallas Tas/.env.local" | cut -d= -f2- | tr -d '"'"'")
curl -s -H "Authorization: Bearer $PAT" https://api.airtable.com/v0/meta/bases/appnaSGAgOUbJ0f9m/tables
curl -s -H "Authorization: Bearer $PAT" https://api.airtable.com/v0/meta/bases/appllDG4OmkK2Hdnn/tables
```

Both calls returned HTTP 200 (51 259 and 73 832 bytes). The raw payloads and the scripts that
produced every number below are in the session scratchpad, **outside the repo**:

```
<scratchpad>/sub-a-template-raw.json     raw template payload
<scratchpad>/sub-a-gratsi-raw.json       raw Gratsi payload
<scratchpad>/sub-a-dump.py               flattens a payload to one line per field
<scratchpad>/sub-a-pairs.py              name-level diff per paired table
<scratchpad>/sub-a-opts.py               select option-set comparison
<scratchpad>/sub-a-classify.py           produces the relationship counts below
```

## Summary counts

| | TEMPLATE `appnaSGAgOUbJ0f9m` | GRATSI `appllDG4OmkK2Hdnn` |
|---|---|---|
| Tables | 15 | 21 |
| Fields (all tables) | 203 | 340 |
| Tables paired in this audit | 14 | 14 |
| Fields inside paired tables | 191 | 251 |
| Tables with no counterpart | 1 | 7 |

Relationship totals across the 14 paired tables — **291 mapping rows**, each row consuming one
template field, one Gratsi field, or one of each:

| Relationship | Rows |
|---|---|
| IDENTICAL (same name both sides) | 110 |
| RENAMED (different name, same meaning) | 23 |
| GRATSI-ONLY (no template equivalent — **lost on import unless mapped**) | 85 |
| TEMPLATE-ONLY (no Gratsi source — **renders empty for Gratsi**) | 30 |
| COMPUTED (formula / lookup / rollup / created / modified / autonumber / AI text) | 43 |

Of the 43 COMPUTED rows, 18 are computed on **both** sides, 10 only on the template side and 15 only
on the Gratsi side. Rows are counted **per field, not per name**: two Gratsi tables each contain two
distinct fields both named `Email Campaigns Management copy` (`(Internal) Product`
fld`OjMBRUrKizzabK` + fld`Ic0UqHEHWB9l7q`; `(Internal) Collections` fld`DxCx8CxKMfofxq` +
fld`xqQQHpKHqhYqt6`), so any name-keyed import will silently collapse one of each pair.

Per-table breakdown:

| Paired table | template id | gratsi id | IDENT | RENAMED | G-ONLY | T-ONLY | COMPUTED |
|---|---|---|---|---|---|---|---|
| Personas | tblRXknfgKsROI961 | tblyt7X4VjHxtMDVS | 1 | 5 | 1 | 9 | 0 |
| Angles | tbl4UFSFcynlS2Pkn | tblRlcp1ibmS7U7HG | 4 | 0 | 15 | 6 | 3 |
| Concepts | tblRlcp1ibmS7U7HG | tbl4UFSFcynlS2Pkn | 4 | 8 | 10 | 2 | 8 |
| Creative Sheet / Creative Design | tblhU5yVNhVDwykUt | tblhU5yVNhVDwykUt | 26 | 3 | 9 | 3 | 5 |
| Copywriting / Meta Copywriting | tblZpBYPTcZcmQ1Kf | tblZpBYPTcZcmQ1Kf | 7 | 3 | 13 | 0 | 8 |
| Themes / (Internal) Creative Modules | tblzS73a9JrJGiV2J | tblzS73a9JrJGiV2J | 2 | 1 | 1 | 0 | 0 |
| DONT USE Creative Sheet / Creative Sheet | tblGC0TxnHI7lKaNQ | tblGC0TxnHI7lKaNQ | 3 | 0 | 10 | 0 | 16 |
| UGC Management | tblRsVqiqUaZRcQYd | tblRsVqiqUaZRcQYd | 25 | 2 | 8 | 5 | 1 |
| (Internal) Collections | tbl6LBNrRqa6Hh4I2 | tbl6LBNrRqa6Hh4I2 | 7 | 1 | 5 | 0 | 0 |
| (Internal) Product | tblfvfJMYNBz2OYYw | tblfvfJMYNBz2OYYw | 5 | 0 | 6 | 3 | 0 |
| Campaigns & Offers | tblRNaWCVa1cCIwLL | tblRNaWCVa1cCIwLL | 11 | 0 | 7 | 2 | 2 |
| (Internal) Creative Dimensions | tblli0Y76yJvG56zK | tblli0Y76yJvG56zK | 4 | 0 | 0 | 0 | 0 |
| Competitive research | tbl9W6v78tKWznN9S | tbl9W6v78tKWznN9S | 7 | 0 | 0 | 0 | 0 |
| Client Assets Organisation | tbldFmPU6AWg62Fll | tbldFmPU6AWg62Fll | 4 | 0 | 0 | 0 | 0 |

### Tables with no counterpart

TEMPLATE-only (1): `AI Characters / Personas` tblgfe8A7nmce6lzn, 12 fields. No Gratsi table holds
AI-character data; a Gratsi import leaves that table empty.

GRATSI-only (7): `Email Campaigns Management` tblABjVpwRpYtY7de (17), `Email Flows Management`
tblubVflAQZgJSxcF (13), `Youtube Copywriting` tblVR1UmkbDoDzJ7z (29), `Themes` tbl1aFLMJXxhdVKiz (6),
`Creative Reporting` tblgW4bwDSSeqihlr (14), `SM Campaign Management Feed` tblLRajTW55XEhVhk (6),
`(Internal) Copy Type` tblQiBPj9ypCmYxev (4).

Gratsi's `Themes` tbl1aFLMJXxhdVKiz is **not** the template's `Themes` table — see the
Themes section. It holds `Name`, `Notes`, `Assignee`, `Status` (`Todo` / `In progress` / `Done`),
`Attachments` and `Attachment Summary` (an `aiText` field), i.e. a task list, and it has no link
field to any other table.

---

## Read this first: the two bases swap Angles and Concepts

The two bases are the same base lineage, so **field ids follow the physical table, not the meaning**.
Three physical tables carry different names in each base:

| physical table id | TEMPLATE name | GRATSI name |
|---|---|---|
| tbl4UFSFcynlS2Pkn | `Angles` | `Concepts` |
| tblRlcp1ibmS7U7HG | `Concepts` | `Angles` |
| tblZpBYPTcZcmQ1Kf | `Copywriting` | `Meta Copywriting` |
| tblhU5yVNhVDwykUt | `Creative Sheet (Internal & Interface)` | `Creative Design (Internal & Interface)` |
| tblzS73a9JrJGiV2J | `Themes` | `(Internal) Creative Modules` |
| tblGC0TxnHI7lKaNQ | `DONT USE Creative Sheet` | `Creative Sheet` |

Both bases agree on the *relationship* direction — an angle is the parent, concepts are its children —
but they disagree about **which table carries the research fields**. In the template, `Personas`,
`Product`, `Collection`, `Pain Points`, `USP` and `Type` are stored on the **Angle**. In Gratsi those
same six columns (same field ids) are stored on the **Concept**, and the Gratsi Angle sees them only
through the lookups `Product (from Angles)` and `Personas (from Angles)`.

A second consequence: **six Gratsi link fields have a name that contradicts the table they point at.**
In the template, zero fields do.

| Gratsi table | field (verbatim) | points at | which Gratsi calls |
|---|---|---|---|
| `Personas` tblyt7X4VjHxtMDVS | `Angles` (fldBxULTtO0QqdfTD) | tbl4UFSFcynlS2Pkn | **Concepts** |
| `UGC Management` tblRsVqiqUaZRcQYd | `Concepts` (fldbBD8qh1oQqq0w9) | tblRlcp1ibmS7U7HG | **Angles** |
| `(Internal) Creative Modules` tblzS73a9JrJGiV2J | `Concepts` (fldunlpoQGY11lZSM) | tblRlcp1ibmS7U7HG | **Angles** |
| `Campaigns & Offers` tblRNaWCVa1cCIwLL | `Angles` (fldU85dnImDTIJrJI) | tbl4UFSFcynlS2Pkn | **Concepts** |
| `(Internal) Product` tblfvfJMYNBz2OYYw | `Angles` (fldRKjhI4kqVGPPm0) | tbl4UFSFcynlS2Pkn | **Concepts** |
| `(Internal) Collections` tbl6LBNrRqa6Hh4I2 | `Angles` (fldyhctoyBzoilkJM) | tbl4UFSFcynlS2Pkn | **Concepts** |

Any importer that resolves a Gratsi link by the field's *name* will attach these records to the wrong
entity. The one place Gratsi is self-consistent is `Creative Design (Internal & Interface)`: its
`Angle` (fldoMDi4vVNuc99LM) points at tblRlcp1ibmS7U7HG = Gratsi `Angles`, and its `Concept`
(fldQJWp0qyjnMc1Gh) points at tbl4UFSFcynlS2Pkn = Gratsi `Concepts`. Those two field ids carry the
*opposite* names in the template, and each still points at the table its name claims — so name-based
matching happens to be correct for this one table on both sides.

Every table pairing below is by **meaning**. Where the pairing is uncertain the section says so.

---

## 1. Personas — the worked example

- TEMPLATE `Personas` **tblRXknfgKsROI961**, 15 fields, primary field `Persona Name`.
- GRATSI `Personas` **tblyt7X4VjHxtMDVS**, 7 fields, primary field `Name`.

Different table ids **and** different field ids on both sides: no field id is shared between the two
Personas tables. Nothing here can be matched by id; every pairing below is a judgement about meaning.

| template field (verbatim) | type | Gratsi field (verbatim) | type | relationship |
|---|---|---|---|---|
| `Persona Name` | multilineText | `Name` | singleLineText | **RENAMED** — each is its table's `primaryFieldId`, so both hold the persona's label |
| `A Day in the Life` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Demographic` | multilineText | `Description  [Age Status Salary]` | multilineText | **RENAMED** — owner-confirmed; the Gratsi label enumerates age/status/salary, which is what demographic means here. **Two spaces** after `Description` (name length 32) |
| `Psychographic` | multilineText | `Personality` | richText | **RENAMED** — owner-confirmed; psychographic profile = personality |
| `Core Desires (Cashvertising)` | multilineText | `Drivers for this persona` | richText | **RENAMED** — owner-confirmed; a persona's "drivers" are what it wants, i.e. its core desires |
| `Emotional Triggers (Cashvertising)` | multilineText | — | — | **TEMPLATE-ONLY** (but see the contradiction note below) |
| `Pain Points (Cashvertising)` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Success Factors (Buyer Personas)` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Perceived Barriers (Buyer Personas)` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Stage of Market Awareness (Breakthrough Advertising)` | singleSelect | `Problem-Solution Awareness Level` | singleSelect | **RENAMED** — owner-confirmed; both are the Breakthrough Advertising awareness ladder. **OPTION SETS DO NOT MATCH**, see below |
| `Buying Triggers (Breakthrough Advertising)` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Problem/Challenge (StoryBrand)` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Success/Transformation (StoryBrand)` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Trigger Words (Mindstates)` | multilineText | — | — | **TEMPLATE-ONLY** |
| `Angles` | multipleRecordLinks → tbl4UFSFcynlS2Pkn (template `Angles`) | `Angles` | multipleRecordLinks → tbl4UFSFcynlS2Pkn (Gratsi `Concepts`) | **IDENTICAL** name — but the two links do not mean the same thing: the Gratsi field named `Angles` points at the table Gratsi calls `Concepts` |
| — | — | `Passion` | richText | **GRATSI-ONLY** |

Totals: 1 IDENTICAL, 5 RENAMED, 9 TEMPLATE-ONLY, 1 GRATSI-ONLY, 0 COMPUTED. The template has no
computed persona fields and Gratsi has none either; every persona field on both sides is stored.

### The awareness option-set clash

| | options, verbatim, in base order |
|---|---|
| TEMPLATE `Stage of Market Awareness (Breakthrough Advertising)` (3) | `Problem-aware`, `Problem-aware → solution-aware`, `Unaware → Problem-aware` |
| GRATSI `Problem-Solution Awareness Level` (5) | `Completely Unaware`, `Problem Aware`, `Solution Aware`, `Product Aware`, `Most Aware` |

Only `Problem-aware` / `Problem Aware` overlap in meaning, and even there the spelling differs. The
template carries two *transition* options with an arrow that Gratsi does not have at all; Gratsi
carries `Solution Aware`, `Product Aware` and `Most Aware` that the template does not have. The
rename is correct and the values still need a mapping table.

Checked against the repo: `MAPS.awareness` in `/Users/macbook/Tallas Tas/packages/db/src/airtable-import.ts`
(line 419) has keys for all five Gratsi options, so a **Gratsi** import fills
`personas.stage_of_awareness` for every option the base offers. It has no key for either template
arrow option; `normalizeStatusKey` (line 305) turns `Problem-aware → solution-aware` into
`problem_aware_solution_aware`, while the pg enum value is `problem_aware_to_solution_aware`, so a
**template-sourced** import of that option would warn and pass a value the enum does not contain.

### `Passion` — the hard case, not forced

`Passion` (fldjGFr7vZ4DaXfvU, richText) is the one Gratsi persona field with no template counterpart.
What can be established from the metadata: it is free rich text, it is not required, and it sits
between `Drivers for this persona` and the `Angles` link in field order. What the content is cannot
be established from metadata — the Metadata API returns no records, and no field description is set.

Most plausible reading: `Passion` is what the persona cares about *for its own sake* (interests,
enthusiasms), as distinct from `Drivers for this persona`, which is what moves it to buy. If that
reading is right, the nearest template fields are `Psychographic` (already taken by `Personality`) and
`Trigger Words (Mindstates)` — neither is a good fit, and `Core Desires (Cashvertising)` is already
claimed by `Drivers for this persona` on the owner's own map. **No template field can hold `Passion`
without displacing a confirmed pair, so this audit does not map it.** It needs a human decision; see
the final section.

### Which Drizzle `personas` columns a Gratsi import fills

Drizzle table: `/Users/macbook/Tallas Tas/packages/db/src/schema/personas.ts`. Importer:
`/Users/macbook/Tallas Tas/packages/db/src/airtable-import.ts` lines 815-843.

**TODAY, with the importer as written, a Gratsi Personas import populates 6 of the 14 content columns:**

| Drizzle column | filled today from | |
|---|---|---|
| `name` | `Name` | yes |
| `demographic` | `Description  [Age Status Salary]` | yes |
| `psychographic` | `Personality` | yes |
| `stage_of_awareness` | `Problem-Solution Awareness Level` | yes |
| `core_desires` | **`Passion`** | yes — but see the contradiction |
| `emotional_triggers` | **`Drivers for this persona`** | yes — but see the contradiction |
| `day_in_the_life` | — | **NULL — the importer does not read any key for it** |
| `pain_points` | — | NULL (no Gratsi source) |
| `success_factors` | — | NULL (no Gratsi source) |
| `perceived_barriers` | — | NULL (no Gratsi source) |
| `buying_triggers` | — | NULL (no Gratsi source) |
| `problem_challenge` | — | NULL (no Gratsi source) |
| `success_transformation` | — | NULL (no Gratsi source) |
| `trigger_words` | — | NULL (no Gratsi source) |
| `product_id` | — | NULL — Gratsi `Personas` has **no** product field of any kind |

**The contradiction, stated plainly.** The importer today reads
`coreDesires: str(f['Core Desires'] ?? f.Passion)` and
`emotionalTriggers: str(f['Emotional Triggers'] ?? f['Drivers for this persona'])`. That routes
`Passion` → `core_desires` and `Drivers for this persona` → `emotional_triggers`. The owner's stated
equivalence is `Core Desires` ↔ `Drivers for this persona`. **The code and the owner's map disagree
about both fields.** Under the owner's map, `core_desires` would take `Drivers for this persona`,
`emotional_triggers` would have no Gratsi source and go NULL, and `Passion` would have no target at
all — so adopting the owner's map *reduces* the number of filled columns from 6 to 5 until `Passion`
is given a home.

**AFTER a corrected rename map** (owner's five pairs, nothing invented), a Gratsi import fills
`name`, `demographic`, `psychographic`, `core_desires`, `stage_of_awareness` — **5 of 14** — plus
`emotional_triggers` only if `Passion` is deliberately routed there, which this audit does not
recommend without a human decision. The other 8 columns and `product_id` stay NULL for the Gratsi
brand no matter what the rename map says, because the data does not exist in `appllDG4OmkK2Hdnn`.

One more importer-level fact, since it changes what "after a rename map" means: the template-side keys
in that persona mapper (`'Core Desires'`, `'Emotional Triggers'`, `'Pain Points'`, `'Success Factors'`,
`'Perceived Barriers'`, `'Buying Triggers'`, `'Problem Challenge'`, `'Success Transformation'`,
`'Trigger Words'`, `'Stage of Awareness'`, `'Demographic'`, `'Psychographic'`) do **not** match the
live template base, whose names all carry a parenthetical suffix (`Core Desires (Cashvertising)`,
`Problem/Challenge (StoryBrand)`, `Stage of Market Awareness (Breakthrough Advertising)`, …) and
whose primary field is `Persona Name`, not `Name`. A template-sourced persona import would therefore
fall back to `'Untitled'` for the name and leave those nine columns NULL. I have verified the live
names; I have not established whether any other payload shape (a CSV, an export) supplies the short
names the code expects.

---

## 2. Angles

- TEMPLATE `Angles` **tbl4UFSFcynlS2Pkn**, 11 fields, primary `Name`.
- GRATSI `Angles` **tblRlcp1ibmS7U7HG**, 21 fields, primary `Name`.

Paired by meaning (both are the parent of concepts, both are linked from Creative Design's `Angle`).
Field ids are **not** comparable across this pair — the two bases swapped these physical tables.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Name` | singleLineText | `Name` | singleLineText | IDENTICAL |
| `Description` | multilineText | `Description` | multilineText | IDENTICAL |
| `Concepts` | multipleRecordLinks → tblRlcp1ibmS7U7HG (template `Concepts`) | `Concepts` | multipleRecordLinks → tbl4UFSFcynlS2Pkn (Gratsi `Concepts`) | IDENTICAL — and both correctly resolve to their own base's Concepts table |
| `(Internal) Creative Design` | multipleRecordLinks → tblhU5yVNhVDwykUt | `(Internal) Creative Design` | **singleLineText** | IDENTICAL name, **type mismatch** — the Gratsi side is plain text, not a record link |
| `Type` | multipleSelects `Emotional`/`Functional`/`Identity`/`Critical` | — | — | TEMPLATE-ONLY — the same field id (fldCilpEMS9C1T9FF) exists in Gratsi on `Concepts`, with a fifth option `Exciting` |
| `Product` | multipleRecordLinks → tblfvfJMYNBz2OYYw | — | — | TEMPLATE-ONLY — Gratsi stores `Product` (fldOXPFwutyVlz19O) on `Concepts`; the Gratsi angle only has the lookup `Product (from Angles)` |
| `Collection` | multipleRecordLinks → tbl6LBNrRqa6Hh4I2 | — | — | TEMPLATE-ONLY — Gratsi stores `Collection` (fldNoiIB7Wt2899R5) on `Concepts` |
| `Personas` | multipleRecordLinks → tblRXknfgKsROI961 | — | — | TEMPLATE-ONLY — Gratsi stores `Personas` (fldMf8DR6ji0wVD5z) on `Concepts`; the Gratsi angle only has the lookup `Personas (from Angles)` |
| `Pain Points` | multilineText | — | — | TEMPLATE-ONLY — Gratsi stores `Pain Points` (fldr2jlFs24TpISwT, richText) on `Concepts` |
| `USP` | multilineText | — | — | TEMPLATE-ONLY — Gratsi stores `USP` (fldgAN0Y77HDYJgzy, richText) on `Concepts` |
| `Performance (from Concepts)` | multipleLookupValues | — | — | COMPUTED |
| — | — | `Product (from Angles)` | multipleLookupValues | COMPUTED |
| — | — | `Personas (from Angles)` | multipleLookupValues | COMPUTED |
| — | — | `Status` | singleSelect `Pending For Approval`/`Revised`/`Approved`/`Needs Revisions`/`Revisions Submitted` | GRATSI-ONLY — the template has no angle status; its `Concepts.Approval Status` is the nearest thing and sits on the other table |
| — | — | `Potential` | singleSelect `High Potential for Iteration`/`Winning`/`Losing` | GRATSI-ONLY — the nearest template analogue, `Performance (from Concepts)`, is a lookup, not a stored grade |
| — | — | `Creators` | multipleRecordLinks → tblRsVqiqUaZRcQYd | GRATSI-ONLY — the template links creators from `Concepts.Creator` |
| — | — | `(Internal) Creative Modules` | multipleRecordLinks → tblzS73a9JrJGiV2J | GRATSI-ONLY — the template links that table from `Concepts.Themes` |
| — | — | `Formats to create` | multipleSelects `Static`/`Video`/`Carousel`/`Motion Graphic` | GRATSI-ONLY on this pair — the template has the identical field, with the identical options, on `Concepts` |
| — | — | `Client Notes` | multilineText | GRATSI-ONLY |
| — | — | `Internal Notes` | multilineText | GRATSI-ONLY |
| — | — | `Brief` | **url** | GRATSI-ONLY |
| — | — | `Exact Script` | **url** | GRATSI-ONLY |
| — | — | `Ad Inspo` | multilineText | GRATSI-ONLY on this pair — the template has `Ad Inspo` on `Concepts` |
| — | — | `Winning` | checkbox | GRATSI-ONLY |
| — | — | `Creative Sheet` | singleLineText | GRATSI-ONLY — a text field named after a table; whether it holds data or is a severed link cannot be established from metadata |
| — | — | `(Internal) Creative Design 2` | multipleRecordLinks → tblhU5yVNhVDwykUt | GRATSI-ONLY — the second, working link to the creative table |
| — | — | `UGC Management copy` | singleLineText | GRATSI-ONLY — same caveat as `Creative Sheet` |
| — | — | `Concepts copy` | singleLineText | GRATSI-ONLY — same caveat |

No renames asserted. Nothing on the Gratsi angle could be matched to a differently-named template
angle field without claiming an equivalence the metadata does not support.

---

## 3. Concepts

- TEMPLATE `Concepts` **tblRlcp1ibmS7U7HG**, 22 fields, primary `Name` (a formula).
- GRATSI `Concepts` **tbl4UFSFcynlS2Pkn**, 23 fields, primary `Name` (stored text).

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Name` | **formula** `{Batch} & "-" & {Angles} & "-" & {Themes}` | `Name` | **singleLineText** | IDENTICAL name, **type mismatch** — the template derives the Batch-Angle-Theme name; Gratsi stores a hand-typed string |
| `Batch` | singleSelect, 20 options `B1`…`B20` | `Batch` | singleSelect, **2 options** `B1`,`B2` | IDENTICAL, **option-set clash** |
| `Category` | singleSelect `New`/`Iteration` | `Category` | singleSelect `New`/`Iteration` | IDENTICAL, options match exactly |
| `Production Status` | singleSelect | `Production Status` | singleSelect | IDENTICAL, **option-set clash** (below) |
| `Themes` | multipleRecordLinks → tblzS73a9JrJGiV2J | `Theme` | **multipleSelects, 28 options** | **RENAMED** — both carry the concept's theme; singular vs plural. **Structurally different**: the template links the theme library, Gratsi stores free select values (below) |
| `Angles` | multipleRecordLinks → tbl4UFSFcynlS2Pkn (template `Angles`) | `Angle` | multipleRecordLinks → tblRlcp1ibmS7U7HG (Gratsi `Angles`) | **RENAMED** — singular vs plural; each is the inverse of its base's Angle→Concept link and resolves to the correct table |
| `Concept Style` | singleSelect `Filming Concept`/`Editing Concept`/`AI Concept` | `Style` | singleSelect `Editing`/`Filming` | **RENAMED** — both say how the concept is produced. **Option-set clash**: Gratsi drops the word "Concept" and has no AI option |
| `Approval Status` | singleSelect `Pending For Approval`/`Approved`/`Needs Revisions` | `Status` | singleSelect `Pending For Approval`/`Approved`/`Denied` | **RENAMED** — same physical column (both fldErDlDg89TeYrUF on their own base's copy of the table), so this one is id-confirmed, not inferred. **Option-set clash**: `Needs Revisions` vs `Denied` |
| `Hook examples` | multilineText | `Hooks` | richText | **RENAMED** — both hold the concept's hook copy |
| `Script idea` | multilineText | `Script` | richText | **RENAMED** — both hold the concept's script body. (Id-level note: the template's fld4kB6IXYxD68VaI is named `Exact Script` and typed `url` in Gratsi, on the *Angles* table — so by id the column moved; by meaning `Script` is the match) |
| `Creator` | multipleRecordLinks → tblRsVqiqUaZRcQYd | `UGC Management` | multipleRecordLinks → tblRsVqiqUaZRcQYd | **RENAMED** — both are the record link to the same UGC table; the template names it after the entity, Gratsi after the table |
| `Creative Sheet (Internal & Interface)` | multipleRecordLinks → tblhU5yVNhVDwykUt | `(Internal) Creative Design` | multipleRecordLinks → tblhU5yVNhVDwykUt | **RENAMED** — both link the same physical creative table, which each base names differently |
| `Formats to create` | multipleSelects | — | — | TEMPLATE-ONLY on this pair — Gratsi has the identical field on `Angles` |
| `Ad Inspo` | multilineText | — | — | TEMPLATE-ONLY on this pair — Gratsi has it on `Angles` |
| `Type (from Angles)` | multipleLookupValues | — | — | COMPUTED |
| `Description` | multipleLookupValues (through `Angles`) | — | — | COMPUTED — the Gratsi stored equivalent is `Decription` (misspelt), listed below |
| `Performance` | multipleLookupValues | `Performance` | multipleLookupValues | COMPUTED both sides |
| `Creators` | multipleLookupValues | — | — | COMPUTED |
| `Pain Points (from Angles)` | multipleLookupValues | — | — | COMPUTED |
| `USP (from Angles)` | multipleLookupValues | — | — | COMPUTED |
| `Product (from Angles)` | multipleLookupValues | — | — | COMPUTED |
| `Personas (from Angles)` | multipleLookupValues | — | — | COMPUTED |
| — | — | `Type` | multipleSelects `Emotional`/`Functional`/`Identity`/`Critical`/`Exciting` | GRATSI-ONLY on this pair — the template holds this on `Angles` and lacks `Exciting` |
| — | — | `Product` | multipleRecordLinks → tblfvfJMYNBz2OYYw | GRATSI-ONLY on this pair — the template holds the product link on `Angles` |
| — | — | `Personas` | multipleRecordLinks → tblyt7X4VjHxtMDVS | GRATSI-ONLY on this pair — the template holds the persona link on `Angles` |
| — | — | `Collection` | multipleRecordLinks → tbl6LBNrRqa6Hh4I2 | GRATSI-ONLY on this pair — template holds it on `Angles` |
| — | — | `Pain Points` | richText | GRATSI-ONLY on this pair — template holds it on `Angles` |
| — | — | `USP` | richText | GRATSI-ONLY on this pair — template holds it on `Angles` |
| — | — | `Decription` | multilineText | GRATSI-ONLY — the stored description; the template's same-meaning field is a lookup, so there is no stored template target. **The typo is in the live base** |
| — | — | `Client's Comments` | multilineText | GRATSI-ONLY |
| — | — | `Campaigns & Offers` | multipleRecordLinks → tblRNaWCVa1cCIwLL | GRATSI-ONLY |
| — | — | `UGC Management copy` | singleLineText | GRATSI-ONLY — text named after a table; cannot be established as data vs a severed link |

### `Production Status` option clash

| | options |
|---|---|
| TEMPLATE (6) | `To Do (approved by client)`, `In Progress...`, `Filming in Progress`, `Sent to Design`, `Done`, `Launched` |
| GRATSI (6) | `Done`, `Filming in Progress`, `Sent to Design`, `Editing Concept`, `Declined By Client`, `Filming Concept` |

Three shared (`Done`, `Filming in Progress`, `Sent to Design`). Template-only:
`To Do (approved by client)`, `In Progress...`, `Launched`. Gratsi-only: `Editing Concept`,
`Declined By Client`, `Filming Concept` — note the last two are a *style* and a *client verdict*
pushed into the production-status select.

### `Themes` → `Theme`: a link against a multi-select

The template links tblzS73a9JrJGiV2J, i.e. the theme library, from the concept. Gratsi stores the
theme as 28 inline select options on the concept itself:

`Aspirational Lifestyle`, `Green Screen`, `Podcast`, `Street Interview`, `Expert POV`,
`Product Discovery`, `Contextual Endorsement`, `Yapper Review`, `Casual Interview`, `Price Reveal`,
`Social Proof`, `Product Demo`, `This vs. That`, `Problem Solution Skit`, `Day in the Life`,
`Pattern Interrupt`, `Comparison`, `GRWM`, `Food Pairing`, `POV Style`, `Explainer`, `Listicle`,
`Recommendation`, `Interactive Quiz`, `Taste Test`, `Group Reaction`, `Problem Solution`,
`Experience Sharing`.

These 28 strings are the real Gratsi theme vocabulary. The Gratsi theme *library* table
(tblzS73a9JrJGiV2J, named `(Internal) Creative Modules`) is a separate, independently-populated list —
nothing in the metadata guarantees its rows match these 28 names, and the Metadata API cannot tell us
whether they do.

---

## 4. Creative Sheet (Internal & Interface) / Creative Design (Internal & Interface)

Same physical table **tblhU5yVNhVDwykUt** on both sides. TEMPLATE 35 fields, GRATSI 42. Primary
`Name` on both. The strongest-matching pair in the two bases: 26 fields share a name and a type.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Name` | singleLineText | `Name` | singleLineText | IDENTICAL |
| `Concept` | link → tblRlcp1ibmS7U7HG (template `Concepts`) | `Concept` | link → tbl4UFSFcynlS2Pkn (Gratsi `Concepts`) | IDENTICAL — both resolve to their base's Concepts table (different field ids) |
| `Angle` | link → tbl4UFSFcynlS2Pkn (template `Angles`) | `Angle` | link → tblRlcp1ibmS7U7HG (Gratsi `Angles`) | IDENTICAL — both resolve correctly |
| `Source` | singleSelect | `Source` | singleSelect | IDENTICAL, **option clash**: Gratsi adds `Facebook Reels, Facebook Feed Square` |
| `Funnel` | singleSelect | `Funnel` | singleSelect | IDENTICAL, **option clash**: Gratsi adds `TAS` |
| `Type` | singleSelect `Static`/`Motion Image`/`Carousel`/`Video` | `Type` | singleSelect `Image`/`Motion Image`/`Carousel`/`Video`/`s`/`High (24 hours)` | IDENTICAL, **option clash**: `Static` vs `Image`, plus the junk options `s` and `High (24 hours)` |
| `Priority` | singleSelect `Static Average (24 hours)`/`Static High (12 hours)`/`Video Average (48 hours)`/`Video High (24 hours)` | `Priority` | singleSelect `Average (3 days)`/`High (24 hours)` | IDENTICAL, **fully disjoint option sets** |
| `Client Status` | singleSelect | `Client Status` | singleSelect | IDENTICAL — same four values both sides (`Pending for Approval`, `Approved`, `Revisions Needed`, `Launched`), only the display order differs |
| `Internal Status` | singleSelect, 10 options | `Internal Status` | singleSelect, 13 options | IDENTICAL name, **option clash** (below) |
| `Performance` | singleSelect | `Performance` | singleSelect | IDENTICAL, identical options |
| `Elements we are Testing` | richText | `Elements we are Testing` | richText | IDENTICAL |
| `QA Checklist Doc` | multipleAttachments | `QA Checklist Doc` | multipleAttachments | IDENTICAL |
| `Video Editor QA` | checkbox | `Video Editor QA` | checkbox | IDENTICAL |
| `Graphic Designer QA` | checkbox | `Graphic Designer QA` | checkbox | IDENTICAL |
| `Creative Strategist QA` | checkbox | `Creative Strategist QA` | checkbox | IDENTICAL |
| `Design File` | multipleAttachments | `Design File` | multipleAttachments | IDENTICAL |
| `Design Link URL` | singleLineText | `Design Link URL` | singleLineText | IDENTICAL |
| `Inspiration` | **richText** | `Inspiration` | **multipleAttachments** | IDENTICAL — same field id (fldcJNWbskAZmkRnG), so it is the same physical column **retyped** from rich text to attachments in Gratsi |
| `(Internal) Product` | link → tblfvfJMYNBz2OYYw | `(Internal) Product` | link → tblfvfJMYNBz2OYYw | IDENTICAL |
| `Platform` | multipleSelects | `Platform` | multipleSelects | IDENTICAL, **option clash**: Gratsi adds two free-text options (below) |
| `Dimensions` | link → tblli0Y76yJvG56zK | `Dimensions` | link → tblli0Y76yJvG56zK | IDENTICAL |
| `Click for AI Spell Checker Again` | checkbox | `Click for AI Spell Checker Again` | checkbox | IDENTICAL |
| `Spelling Feedback` | multilineText | `Spelling Feedback` | multilineText | IDENTICAL |
| `Assignee` | singleCollaborator | `Assignee` | singleCollaborator | IDENTICAL |
| `Meta Copywriting` | link → tblZpBYPTcZcmQ1Kf | `Meta Copywriting` | link → tblZpBYPTcZcmQ1Kf | IDENTICAL (the target table is `Copywriting` in the template, `Meta Copywriting` in Gratsi — same physical table) |
| `Script & brief breakdown ` (trailing space) | multipleAttachments | `Script & brief breakdown ` (trailing space) | multipleAttachments | IDENTICAL, trailing space on both sides |
| `Brief` | richText | `Brief to Design/Editing` | richText | **RENAMED** — same field id (fldqdgNID4twsDS1D) on the same physical table; id-confirmed |
| `Ad Content` | richText | `Script / Ad Content` | richText | **RENAMED** — same field id (fldbQTFF7p4IrxviW); id-confirmed |
| `Collection` | link → tbl6LBNrRqa6Hh4I2 | `(Internal) Collections 3` | link → tbl6LBNrRqa6Hh4I2 | **RENAMED** — the only Gratsi field on this table that is a record link to the collections table. **This pairing is less certain than the two above**: the field ids differ (fldSJbL3XitVVSFVX vs fld1Y0hkYsxAukiQa) and the template's id does not exist in the Gratsi base, so this is a judgement from the link target, not an id match. The `2`/`3` suffixes suggest Gratsi has rebuilt the column at least twice |
| `Inspiration Image` | multipleAttachments | — | — | **TEMPLATE-ONLY** — its field id (fldAWHkjfywYrCRXz) does not exist in the Gratsi base at all. Note the consequence: the template splits inspiration into text (`Inspiration`) + images (`Inspiration Image`), while Gratsi has retyped the single `Inspiration` column to attachments, so Gratsi's inspiration **images** arrive in the field our model treats as inspiration **text** |
| `Campaigns & Offers` | link → tblRNaWCVa1cCIwLL | — | — | TEMPLATE-ONLY — field id fldMrzxkCWBXGiUcq is absent from the Gratsi base, and Gratsi's creative table has no link to tblRNaWCVa1cCIwLL by any name. Its `Offer` richText may carry the same intent as free text; that cannot be established from metadata |
| `Assets` | link → tbldFmPU6AWg62Fll | — | — | TEMPLATE-ONLY (field id fldVkRy4ZNhr2Aywl absent from Gratsi) — and the reverse link is broken too: Gratsi `Client Assets Organisation`.`(Internal) Creative Design` is `singleLineText`, not a link |
| `Batch (from Concepts)` | multipleLookupValues | — | — | COMPUTED |
| `Created` | createdTime | `Created` | createdTime | COMPUTED both |
| `Last Modified` | lastModifiedTime | `Last Modified` | lastModifiedTime | COMPUTED both (template result `date`, Gratsi `dateTime`) |
| — | — | `Created 2` | createdTime | COMPUTED |
| — | — | `Concepts (from Angles)` | multipleLookupValues | COMPUTED |
| — | — | `Batch` | singleSelect `B1`…`B20` | GRATSI-ONLY — **stored on the creative**, where the template derives it from the concept via `Batch (from Concepts)`. Directly relevant to the creative naming formula |
| — | — | `Language` | singleSelect `English(USA)` | GRATSI-ONLY |
| — | — | `Offer` | richText | GRATSI-ONLY |
| — | — | `Creative Module` | link → tblzS73a9JrJGiV2J | GRATSI-ONLY — the template reaches the module/theme table through the concept, not the creative |
| — | — | `Spelling Feedback 2` | multilineText | GRATSI-ONLY |
| — | — | `(Internal) Collections 2` | singleLineText | GRATSI-ONLY — text named after a table |
| — | — | `Creative Sheet` | link → tblGC0TxnHI7lKaNQ | GRATSI-ONLY — the live link to the table the template calls `DONT USE Creative Sheet` |
| — | — | `Ads Copywriting copy` | link → tblZpBYPTcZcmQ1Kf | GRATSI-ONLY — a second link to the copy table alongside `Meta Copywriting` |
| — | — | `Angles` | singleLineText | GRATSI-ONLY — text, distinct from the working `Angle` link on the same table |

### `Internal Status` option clash (the two-track approval rule)

| | options |
|---|---|
| TEMPLATE (10) | `Sent to Designer`, `Static Design in Progress...`, `Sent to Video Editor`, `Video Editing in Progress...`, `Video Editing On Hold...`, `Ad Submitted`, `Approved`, `Images Revisions`, `Videos Revisions`, `Revisions Submitted` |
| GRATSI (13) | `Sent to Designer`, `Sent to Feriel`, `Sent to Nadish`, `Video editing in progress Feriel`, `Video editing in progress Nadish`, `Video editing on hold`, `Video Revision Feriel`, `Video revision Nadish`, `Ad Submitted`, `Approved`, `Images Revisions`, `Revisions Submitted`, `Design Submitted` |

Four values are shared. Gratsi has **named individuals** (`Feriel`, `Nadish`) baked into eight of its
options, which the template has generalised to role-based stages. Template-only:
`Static Design in Progress...`, `Sent to Video Editor`, `Video Editing in Progress...`,
`Video Editing On Hold...`, `Videos Revisions`. Gratsi-only: the eight person-named options plus
`Design Submitted`.

### `Platform` option clash

Gratsi adds two options that are clearly pasted briefing text, not platforms:
`Use different relevant visuals from the girls gathering folder that I shared in the previous batch`
and `Sticky Banner:-`.

---

## 5. Copywriting / Meta Copywriting

Same physical table **tblZpBYPTcZcmQ1Kf**. TEMPLATE `Copywriting` 11 fields, GRATSI
`Meta Copywriting` 30. Primary `Copy #` on both.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Copy #` | **formula** `" Copy " & {Autonumber} & " - " & {Creative}` | `Copy #` | **singleLineText** | IDENTICAL name, **type mismatch** — the template generates it, Gratsi stores it |
| `Creative` | link → tblhU5yVNhVDwykUt | `Creative` | link → tblhU5yVNhVDwykUt | IDENTICAL |
| `Status` | singleSelect | `Status` | singleSelect | IDENTICAL — identical five options on both sides |
| `Product` | link → tblfvfJMYNBz2OYYw | `Product` | **singleLineText** | IDENTICAL name, **type mismatch**. The Gratsi lookup `Link (from Product)` is configured through this text field and reports no `fieldIdInLinkedTable`, which is consistent with a link converted to text — but when or why that happened cannot be established from metadata |
| `Headline` | multilineText | `Headline` | singleLineText | IDENTICAL, minor type mismatch (multi-line vs single-line) |
| `CTA` | singleSelect | `CTA` | singleSelect | IDENTICAL, identical six options |
| `USED` | checkbox | `USED` | checkbox | IDENTICAL |
| `Primary Copy` | richText | `Descriptions` | richText | **RENAMED** — same field id (fldjaMgc9pmSJ6yOB); id-confirmed |
| `News Feed / Link Description` | multilineText | `News Feed` | singleLineText | **RENAMED** — same field id (fldcpZkoydiXct3NZ); id-confirmed |
| `Collection` | link → tbl6LBNrRqa6Hh4I2 | `Collections` | link → tbl6LBNrRqa6Hh4I2 | **RENAMED** — same field id (fldcBR6KPyWH78h4r); id-confirmed, plural |
| `Autonumber` | autoNumber | — | — | COMPUTED |
| — | — | `Offer` / `Campaign (from Campaign)` / `Code (from Campaign)` / `Collection URL` / `Link (from Product)` / `Products (from Collections)` | multipleLookupValues | COMPUTED (6 fields) |
| — | — | `Created By` | createdBy | COMPUTED |
| — | — | `Angle` | singleLineText | GRATSI-ONLY — free text, not a link to any angle table |
| — | — | `Campaign Code` | link → tblRNaWCVa1cCIwLL | GRATSI-ONLY |
| — | — | `Funnel` | singleSelect `TOF`/`MOF`/`BOF`/`MOF & BOF`/`POST PURCHASE`/`ALL FUNNELS` | GRATSI-ONLY — note this is a **different funnel vocabulary** from the creative table's `TOF`/`RETARGETTING`/`ALL FUNNELS` |
| — | — | `Copy Type` | link → tblQiBPj9ypCmYxev | GRATSI-ONLY — points at a table that does not exist in the template |
| — | — | `Client's Comment` | multilineText | GRATSI-ONLY (singular; the creative tables use `Client's Comments`) |
| — | — | `Winning` | checkbox | GRATSI-ONLY |
| — | — | `Meta Rating` | rating | GRATSI-ONLY |
| — | — | `Creative Reporting` | singleLineText | GRATSI-ONLY — text named after a Gratsi-only table |
| — | — | `Creative Sheet` | singleLineText | GRATSI-ONLY |
| — | — | `(Internal) Product` | singleLineText | GRATSI-ONLY — a second product field, alongside `Product` |
| — | — | `(Internal) Creative Design` | link → tblhU5yVNhVDwykUt | GRATSI-ONLY — a second link to the creative table, alongside `Creative` |
| — | — | `(Internal) Creative Design 2` | singleLineText | GRATSI-ONLY |
| — | — | `⚠️ Please Change the Status of the copy` | singleLineText | GRATSI-ONLY — the field name is an instruction to the user; emoji is in the live base |

---

## 6. Themes / (Internal) Creative Modules — **pairing is uncertain**

Same physical table **tblzS73a9JrJGiV2J**: TEMPLATE `Themes` (3 fields), GRATSI
`(Internal) Creative Modules` (4 fields). Both have primary `Module Name` and share the field ids
fld2r3Lk543QCAO9v and fldyTMESU7ThfnFH7, so they are the same column lineage.

**Why the pairing is uncertain.** The template calls this table `Themes`, and the project treats
themes as the global library. Gratsi calls the same table `(Internal) Creative Modules` **and
separately has a table literally named `Themes` (tbl1aFLMJXxhdVKiz)** that is not this table and is
not linked to anything. Meanwhile the actual theme values Gratsi uses live as 28 select options on
`Concepts.Theme`. So there are three candidates for "Gratsi's themes" and the metadata alone does not
say which the owner means. This audit pairs by physical lineage and flags the rest.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Module Name` | singleLineText | `Module Name` | singleLineText | IDENTICAL (same field id) |
| `Concepts` | link → tblRlcp1ibmS7U7HG (template `Concepts`) | `Concepts` | link → tblRlcp1ibmS7U7HG (**Gratsi `Angles`**) | IDENTICAL name, **different meaning** — the Gratsi field named `Concepts` points at the table Gratsi calls `Angles` |
| `Reference Link` | singleLineText | `Foreplay Link` | **url** | **RENAMED** — same field id (fldyTMESU7ThfnFH7); id-confirmed. Gratsi names it after the tool (Foreplay) and types it as a URL |
| — | — | `(Internal) Creative Design` | link → tblhU5yVNhVDwykUt | GRATSI-ONLY |

---

## 7. DONT USE Creative Sheet / Creative Sheet — **low value, template side is deprecated**

Same physical table **tblGC0TxnHI7lKaNQ**. The template side is named `DONT USE Creative Sheet`, so
TEMPLATE-ONLY / GRATSI-ONLY judgements here say little about what the product needs. In Gratsi this
table is live: it is the per-month creative roll-up, linked from `Creative Design`.`Creative Sheet`.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Creative Name` | **singleLineText** | `Creative Name` | **multipleRecordLinks** → tblhU5yVNhVDwykUt | IDENTICAL name, **type mismatch** — the template's link has been flattened to text, which also leaves all 11 of its lookups on this table with a null source |
| `Status` | singleSelect | `Status` | singleSelect | IDENTICAL, **option clash**: template `Revision Submitted` vs Gratsi `Revisions Submitted` (singular/plural), rest identical |
| `Client's Comments` | multilineText | `Client's Comments` | multilineText | IDENTICAL |
| `Name + Angle + Offer` | formula | `Name` | formula | COMPUTED both (same field id fldkavcvPyLDyyG6R; the template formula is `CONCATENATE({Creative Name})`, Gratsi's prefixes the created month) |
| `Design File` | multipleLookupValues | `Design File (from Creative Name)` | multipleLookupValues | COMPUTED both |
| 11 further lookups (`Performance (from Creative Name)`, `(Internal) Product (from Creative Name)`, `Angle (from Creative Name)`, `Concepts (from Angle) (from Creative Name)`, `Elements we are Testing`, `Design Link URL`, `Collection`, `Platform`, `Funnel`, `Type`, `Creative Module`) | multipleLookupValues | same names | multipleLookupValues | COMPUTED both |
| `Last Modified` | lastModifiedTime | `Last Modified` | lastModifiedTime | COMPUTED both |
| — | — | `Proposed Copy` | multipleLookupValues | COMPUTED |
| — | — | `Created` | createdTime | COMPUTED |
| — | — | `Internal Status` | singleSelect, 11 options | GRATSI-ONLY — a **second** internal-status select, distinct from the one on `Creative Design`, with its own option list |
| — | — | `QA Checklist Doc` | multipleAttachments | GRATSI-ONLY |
| — | — | `Video Editor QA` / `Graphic Designer QA` / `Creative Strategist QA` | checkbox | GRATSI-ONLY (3 fields) — duplicated from `Creative Design` |
| — | — | `Used` | checkbox | GRATSI-ONLY |
| — | — | `Denied/revisions needed` | checkbox | GRATSI-ONLY |
| — | — | `Winning` | singleSelect `Best Performing`/`Average` | GRATSI-ONLY |
| — | — | `Click for AI Spell Checker Again` | checkbox | GRATSI-ONLY |
| — | — | `Spelling Feedback` | multilineText | GRATSI-ONLY |

---

## 8. UGC Management

Same physical table **tblRsVqiqUaZRcQYd**. TEMPLATE 32 fields, GRATSI 36. Primary
`Creator name (Filled by UGC Manager)` on both.

**IDENTICAL (25)** — name and, unless noted, type:
`Creator name (Filled by UGC Manager)`, `Date of Management`, `Age`, `Gender`, `Ethnicity`,
`Products`, `Budget per 60sec video`, `Status`, `Creator's Profile Pic`, `Platform`,
`(Client's) Note or Comments`, `Creator's cost (USD)` *(template `currency`, Gratsi **`formula`** —
see below)*, `Raw assets`, `Shipping Location`, `Tracking Number ` (trailing space both sides),
`Partnership Activity`, `Creator Link`, `Instagram Username`, `Date of Partnership Activation`,
`Partnership Time Period (days)`, `Continue Working With?`, `Extension Time Period`,
`Partnership Price per 30 days`, `Notes for Partnership ads`, `Facebook Profile for Partnership`.

Two option clashes inside that set:
- `Status`: template `Filming In Progress...` vs Gratsi `Filming In Progress` (no ellipsis); the other eight values match.
- `Platform`: template `Backstage` vs Gratsi `Back stage` (a space); the other four match.

**RENAMED (2):**

| template field | type | Gratsi field | type | justification |
|---|---|---|---|---|
| `Creator's Video Intro` | multipleAttachments | `Creator's video Intro` | multipleAttachments | same field id (fldKIiYIz57e2CoJl); differs only in the case of "video" |
| `Concepts to film` | link → tblRlcp1ibmS7U7HG (template `Concepts`) | `Concept to film` | link → tbl4UFSFcynlS2Pkn (Gratsi `Concepts`) | singular vs plural; each points at its own base's Concepts table |

**TEMPLATE-ONLY (5):** `(Internal) Deadline for the request` (date), `Internal Brief` (multilineText),
`For Partnership Ads?` (singleSelect `Yes`/`No`), `Internal Creator's Status` (singleSelect
`(Internal) Request`/`(Internal) Pending for CS Approval`/`(Internal) Revisions Needed`/
`(Internal) Approved`), `Internal Assets Status` (singleSelect `(Internal Video) Pending for CS Approval`/
`(Internal Video) Revisions Needed`/`(Internal Video) Approved`). All five render empty for Gratsi.

**GRATSI-ONLY (8):**

| Gratsi field | type | note |
|---|---|---|
| `Creator's cost (USD) - Internal` | currency | the stored cost input (fldwtKHaTS0pcMILF) |
| `Paid by TAS` | currency | **same field id (fld5bSunM8WtFJB7L) as the template's stored `Creator's cost (USD)`** — so by id this is the template's cost column renamed, while by name the template's `Creator's cost (USD)` matches a Gratsi *formula*. Which of the two Gratsi currency fields is "the" cost needs a human decision |
| `Creator Status` | singleSelect `Waiting for creator's response on the brief`/`Declined the brief`/`Waiting for assets`/`Waiting for revision`/`Assets delivered ` (trailing space) | the nearest template field is `Internal Creator's Status`, whose four options are **entirely disjoint** from these five |
| `Additional Note - TAS Team` | richText | closest in spirit to the template's `Internal Brief`; equivalence cannot be established from metadata |
| `Creator Info Request` | richText | |
| `Payment Date` | date | |
| `Concepts` | link → tblRlcp1ibmS7U7HG (**Gratsi `Angles`**) | a second link whose name contradicts its target |
| `Slack Notified ` (trailing space) | checkbox | |

**COMPUTED (1 Gratsi-only):** `Notify Flag` (formula, fires `"YES"` 25 days after
`Date of Partnership Activation`). Also note Gratsi's `Creator's cost (USD)` is a formula that marks
the internal cost up by platform (×1.055 for `Fiverr`, ×1.10 for `Insense`), i.e. a *different
quantity* from the template's stored field of the same name.

---

## 9. (Internal) Collections

Same physical table **tbl6LBNrRqa6Hh4I2**. TEMPLATE 8 fields, GRATSI 13.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Collection Name` | singleLineText | `Main Collection` | singleLineText | **RENAMED** — same field id (fldKXsVgN9TcKRfIL) and the `primaryFieldId` on both sides; id-confirmed |
| `URL` | url | `URL` | url | IDENTICAL |
| `Campaigns & Offers` | link → tblRNaWCVa1cCIwLL | `Campaigns & Offers` | link → tblRNaWCVa1cCIwLL | IDENTICAL |
| `Angles` | link → tbl4UFSFcynlS2Pkn (template `Angles`) | `Angles` | link → tbl4UFSFcynlS2Pkn (**Gratsi `Concepts`**) | IDENTICAL name, **different meaning** |
| `Ads Copywriting copy` | link → tblZpBYPTcZcmQ1Kf | `Ads Copywriting copy` | link → tblZpBYPTcZcmQ1Kf | IDENTICAL |
| `(Internal) Product` | **link** → tblfvfJMYNBz2OYYw | `(Internal) Product` | **singleLineText** | IDENTICAL name, **type mismatch**; same field id (fldlnSYjSH4CAe3Wv). Gratsi's `Campaigns & Offers`.`Product` lookup resolves through this text field |
| `(Internal) Creative Design` | **singleLineText** | `(Internal) Creative Design` | **link** → tblhU5yVNhVDwykUt | IDENTICAL name, **type mismatch — reversed**: here the *template* side is the flattened one (same field id fldLuag4qd3FKRlJE) |
| `(Internal) Creative Design 2` | **link** → tblhU5yVNhVDwykUt | `(Internal) Creative Design 2` | **singleLineText** | IDENTICAL name, **type mismatch**; different field ids (fldholZqZlwllMboU vs fldw4hmXudmlK2M1O) |
| — | — | `Copywriting` | link → tblVR1UmkbDoDzJ7z | GRATSI-ONLY — points at `Youtube Copywriting`, a Gratsi-only table |
| — | — | `Creative Sheet` | singleLineText | GRATSI-ONLY |
| — | — | `Table 17` | link → tblABjVpwRpYtY7de | GRATSI-ONLY — an unnamed link to `Email Campaigns Management` |
| — | — | `Email Campaigns Management copy` | singleLineText | GRATSI-ONLY (fldDxCx8CxKMfofxq) |
| — | — | `Email Campaigns Management copy` | singleLineText | GRATSI-ONLY (fldxqQQHpKHqhYqt6) — **a second, distinct field with the identical name** |

---

## 10. (Internal) Product

Same physical table **tblfvfJMYNBz2OYYw**. TEMPLATE 8 fields, GRATSI 11. Primary
`Product Name / Landing Page Name` on both.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Product Name / Landing Page Name` | multilineText | same | multilineText | IDENTICAL |
| `Link` | url | `Link` | url | IDENTICAL |
| `Angles` | link → tbl4UFSFcynlS2Pkn (template `Angles`) | `Angles` | link → tbl4UFSFcynlS2Pkn (**Gratsi `Concepts`**) | IDENTICAL name, **different meaning** |
| `(Internal) Creative Design` | link → tblhU5yVNhVDwykUt | same | link → tblhU5yVNhVDwykUt | IDENTICAL |
| `UGC Management` | link → tblRsVqiqUaZRcQYd | same | link → tblRsVqiqUaZRcQYd | IDENTICAL |
| `(Internal) Collections` | link → tbl6LBNrRqa6Hh4I2 | — | — | TEMPLATE-ONLY — Gratsi's product has **no** link back to collections |
| `Campaigns & Offers` | link → tblRNaWCVa1cCIwLL | — | — | TEMPLATE-ONLY |
| `Meta Copywriting` | link → tblZpBYPTcZcmQ1Kf | — | — | TEMPLATE-ONLY — Gratsi's product links `Youtube Copywriting` instead |
| — | — | `Youtube Copywriting` | link → tblVR1UmkbDoDzJ7z | GRATSI-ONLY |
| — | — | `Table 17` | link → tblABjVpwRpYtY7de | GRATSI-ONLY |
| — | — | `(Internal) Creative Design 2` | singleLineText | GRATSI-ONLY |
| — | — | `Creative Sheet` | singleLineText | GRATSI-ONLY |
| — | — | `Email Campaigns Management copy` | singleLineText | GRATSI-ONLY (fldOjMBRUrKizzabK) |
| — | — | `Email Campaigns Management copy` | singleLineText | GRATSI-ONLY (fldIc0UqHEHWB9l7q) — **duplicate name again** |

---

## 11. Campaigns & Offers

Same physical table **tblRNaWCVa1cCIwLL**. TEMPLATE 14 fields, GRATSI 20. Primary `Name` (formula)
on both, with the identical formula `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})`.

| template field | type | Gratsi field | type | relationship |
|---|---|---|---|---|
| `Name` | formula | `Name` | formula | COMPUTED both, identical formula |
| `Holiday` / `Official Date` / `Country` / `Description` / `Ads Launch Date` / `Ads End Date` / `Discount Offer` / `Code` | singleLineText, date, singleLineText, multilineText, date, date, singleLineText, singleLineText | same names | same types | IDENTICAL (8 fields) |
| `Collections` | link → tbl6LBNrRqa6Hh4I2 | `Collections` | link → tbl6LBNrRqa6Hh4I2 | IDENTICAL |
| `Launched` | checkbox (fldH1Vya4ySQNfhlF) | `Launched` | checkbox (**flddX7ZcPpnHnbjAR**) | IDENTICAL **by name only** — see the warning below |
| `Design attached` | **link** → tblhU5yVNhVDwykUt | `Design attached` | **singleLineText** | IDENTICAL name, **type mismatch** |
| `Confirmed by Client` | checkbox (flddX7ZcPpnHnbjAR) | — | — | TEMPLATE-ONLY **by name** — see the warning below |
| `(Internal) Product` | link → tblfvfJMYNBz2OYYw | — | — | TEMPLATE-ONLY — Gratsi derives `Product` as a lookup through `Collections` instead |
| — | — | `Product` | multipleLookupValues | COMPUTED |
| — | — | `Promotional Ideas` | richText | GRATSI-ONLY |
| — | — | `Interested` | checkbox | GRATSI-ONLY |
| — | — | `COPY` | link → tblVR1UmkbDoDzJ7z | GRATSI-ONLY (`Youtube Copywriting`) |
| — | — | `Angles` | link → tbl4UFSFcynlS2Pkn (**Gratsi `Concepts`**) | GRATSI-ONLY, and the name contradicts the target |
| — | — | `Email Campaigns` | link → tblABjVpwRpYtY7de | GRATSI-ONLY |
| — | — | `Email Campaigns Management copy` | link → tblubVflAQZgJSxcF | GRATSI-ONLY (points at `Email Flows Management`, despite the name) |
| — | — | `Ads Copywriting copy` | link → tblZpBYPTcZcmQ1Kf | GRATSI-ONLY |

### Warning: `Launched` is not the same column on the two sides

- By **name**: template `Launched` ↔ Gratsi `Launched`.
- By **field id**: the physical column flddX7ZcPpnHnbjAR is named `Confirmed by Client` in the
  template and `Launched` in Gratsi. The template's `Launched` (fldH1Vya4ySQNfhlF) has **no**
  counterpart in Gratsi by id.

These two facts contradict each other and the metadata cannot settle which the owner intends. Noted
as a fact about the repo, not a recommendation: the importer at
`/Users/macbook/Tallas Tas/packages/db/src/airtable-import.ts` line 806-807 maps
`confirmedByClient: bool(f.Interested ?? f['Confirmed by Client'])` and `launched: bool(f.Launched)`,
i.e. it treats Gratsi's `Interested` as the client confirmation and Gratsi's `Launched` as launched.

---

## 12. (Internal) Creative Dimensions

Same physical table **tblli0Y76yJvG56zK**, 4 fields on both sides, all four IDENTICAL in name and
type: `Name`, `Dimensions`, `Link Description`, `(Internal) Creative Design` (link →
tblhU5yVNhVDwykUt). Nothing is lost in either direction.

`Link Description` is a `singleSelect` with the same four options in both bases — `Todo`,
`In progress`, `Done`, `https://business.twitter.com/en/help/campaign-setup/creative-ad-specifications.html`.
The URL-as-option is present in the **template** as well as in Gratsi, so it is not a Gratsi artefact.

---

## 13. Competitive research

Same physical table **tbl9W6v78tKWznN9S**, 7 fields on both sides, all seven IDENTICAL in name and
type: `Name`, `Type`, `Website`, `Insta`, `FB Page`, `Meta Ads Library`, `Analysis`.

One option clash: `Type` is `Competitor`/`Inspiration` in the template and
`Competitor`/`Inspiration`/**`Inspirations`** in Gratsi — a duplicate of the second value in plural.

---

## 14. Client Assets Organisation

Same physical table **tbldFmPU6AWg62Fll**, 4 fields on both sides, all four matching by name:
`Name [Folder]`, `Description`, `Location` (url), `(Internal) Creative Design`.

One **type mismatch**: `(Internal) Creative Design` is a `multipleRecordLinks` → tblhU5yVNhVDwykUt in
the template and `singleLineText` in Gratsi (same field id fld9t3iiAd1xqkPtT). Combined with the
missing `Assets` link on Gratsi's `Creative Design`, the creative↔asset-folder relationship does not
exist in the Gratsi base in either direction.

---

## Fields that need a human decision

### A. Gratsi-only fields with no plausible template target

| Table (pair) | Gratsi field (verbatim) | type | what is unresolved / what would settle it |
|---|---|---|---|
| Personas | `Passion` | richText | No template field can take it without displacing the owner-confirmed `Core Desires (Cashvertising)` ↔ `Drivers for this persona` pair. **To decide: a handful of real Gratsi persona records showing what `Passion` and `Drivers for this persona` actually contain side by side** — the Metadata API returns no values. Options: new `personas.passion` column; fold into `psychographic`; or drop |
| Angles | `Potential` | singleSelect | Values are `High Potential for Iteration`/`Winning`/`Losing` — the same vocabulary as `Performance`, but stored on the angle. Is this the angle's own grade (new column) or a copy of the creative grade (drop)? Needs the owner's intent |
| Angles | `Brief`, `Exact Script` | url (both) | Gratsi stores these as **links to external docs**; the template has no angle-level equivalent at all. Decide: store the URL, or treat as the angle brief text |
| Angles | `Client Notes`, `Internal Notes`, `Winning` | multilineText ×2, checkbox | No template angle field. `Internal Notes` must be client-invisible if kept (rule 10) |
| Concepts | `Decription` (sic), `Client's Comments` | multilineText | `Decription` is Gratsi's **stored** concept description where the template has only a lookup from the angle. If the template keeps it as a lookup, Gratsi's typed descriptions are lost |
| Concepts | `Campaigns & Offers` | link | The template concept has no campaign link. Decide whether a concept may belong to a campaign |
| Creative Design | `Batch` | singleSelect `B1`…`B20` | Gratsi stores batch **on the creative**; the template derives it from the concept. Which is authoritative for the creative name? |
| Creative Design | `Language` | singleSelect `English(USA)` | One option only. Is multi-language planned, or is this dead? |
| Creative Design | `Offer` | richText | Free text where the template uses a `Campaigns & Offers` link. Decide: parse to the link, or keep as text |
| Creative Design | `Creative Module` | link → tblzS73a9JrJGiV2J | Gratsi attaches the module/theme to the creative; the template reaches it through the concept. Both, or one? |
| Creative Design | `Spelling Feedback 2` | multilineText | A second feedback column. Is it a separate AI pass or a duplicate? |
| Meta Copywriting | `Funnel` | singleSelect | Six values (`TOF`/`MOF`/`BOF`/`MOF & BOF`/`POST PURCHASE`/`ALL FUNNELS`) against the creative table's three. See the option-set clash list |
| Meta Copywriting | `Copy Type` | link → tblQiBPj9ypCmYxev | Points at `(Internal) Copy Type`, a table the template does not have at all |
| Meta Copywriting | `Winning`, `Meta Rating` | checkbox, rating | No template copy-performance fields |
| Meta Copywriting | `⚠️ Please Change the Status of the copy` | singleLineText | The name is an instruction to the user. Almost certainly not data — confirm before importing |
| Creative Sheet (tblGC0) | `Internal Status` | singleSelect, 11 options | A **second** internal-status select with its own option list, on the roll-up table. Two-track approval (rule 4) needs one authoritative internal status per creative; which one wins? |
| Creative Sheet (tblGC0) | `Used`, `Denied/revisions needed`, `Winning` | checkbox, checkbox, singleSelect | Overlap with `Status` on the same table. Redundant or distinct? |
| UGC Management | `Creator Status` | singleSelect, 5 options | Disjoint from the template's `Internal Creator's Status`. See the option clash list |
| UGC Management | `Paid by TAS` vs `Creator's cost (USD) - Internal` vs the `Creator's cost (USD)` formula | currency ×2 + formula | Three money fields where the template has one. **To decide: which figure the product must store** — the raw cost, the platform-marked-up cost, or what TAS actually paid |
| UGC Management | `Payment Date`, `Creator Info Request`, `Additional Note - TAS Team`, `Slack Notified ` | date, richText ×2, checkbox | No template equivalents. `Slack Notified ` overlaps with our own notification dispatch |
| (Internal) Collections, (Internal) Product | `Email Campaigns Management copy` ×2 **per table** | singleLineText | Two distinct fields with the same name in the same table. **A name-keyed import silently keeps only one.** Needs the owner to say which (if either) holds data |
| (Internal) Collections, (Internal) Product, Angles, Meta Copywriting, Creative Design | `Creative Sheet`, `(Internal) Creative Design 2`, `(Internal) Collections 2`, `UGC Management copy`, `Concepts copy`, `Angles`, `(Internal) Product` | singleLineText | A class of ~12 Gratsi text fields named after tables, where the template has a record link. **Whether they hold real data or are remnants of severed links cannot be established from the metadata** — it needs a records read |
| Campaigns & Offers | `Promotional Ideas`, `Interested`, `COPY`, `Email Campaigns`, `Email Campaigns Management copy`, `Angles` | richText, checkbox, 4 links | `Interested` vs the template's `Confirmed by Client` is the live question (see §11). `Angles` points at Gratsi `Concepts` |
| whole base | the 7 Gratsi-only **tables** (`Email Campaigns Management`, `Email Flows Management`, `Youtube Copywriting`, `Themes` tbl1aFLMJXxhdVKiz, `Creative Reporting`, `SM Campaign Management Feed`, `(Internal) Copy Type`) | 89 fields in total | Out of scope for a field map, but they are Gratsi data with no template home. Needs a per-table in/out decision |

### B. Option-set clashes (a rename or a name match is useless until these are mapped)

| Pair / field | template options | Gratsi options | what would settle it |
|---|---|---|---|
| Personas · `Stage of Market Awareness (Breakthrough Advertising)` ↔ `Problem-Solution Awareness Level` | 3: `Problem-aware`, `Problem-aware → solution-aware`, `Unaware → Problem-aware` | 5: `Completely Unaware`, `Problem Aware`, `Solution Aware`, `Product Aware`, `Most Aware` | Our `awareness_stage` pg enum already holds all seven values, so the question is only whether the template's two arrow options stay. Note `MAPS.awareness` has no key for either arrow option today |
| Concepts · `Batch` | 20: `B1`…`B20` | 2: `B1`, `B2` | Does Gratsi only use B1/B2, or has the select simply not been extended? A records read settles it |
| Concepts · `Production Status` | `To Do (approved by client)`, `In Progress...`, `Launched` + 3 shared | `Editing Concept`, `Declined By Client`, `Filming Concept` + 3 shared | Gratsi has pushed a *style* and a *client verdict* into the production select. Confirm `Declined By Client` maps to the client track, not production |
| Concepts · `Concept Style` ↔ `Style` | `Filming Concept`, `Editing Concept`, `AI Concept` | `Filming`, `Editing` | Does Gratsi need `AI Concept`? Otherwise a 2-to-3 widening is safe |
| Concepts · `Approval Status` ↔ `Status` | `Pending For Approval`, `Approved`, `Needs Revisions` | `Pending For Approval`, `Approved`, `Denied` | Is Gratsi's `Denied` the same terminal state as `Needs Revisions`, or a distinct rejection? They are not interchangeable |
| Creative Design · `Internal Status` | 10 role-based stages | 13, eight naming `Feriel` / `Nadish` | **Person names must collapse to roles.** Confirm `Sent to Feriel`/`Sent to Nadish` → `Sent to Video Editor` and the four `Feriel`/`Nadish` revision/progress options → their generic equivalents; and whether `Design Submitted` is new |
| Creative Design · `Type` | `Static`, `Motion Image`, `Carousel`, `Video` | `Image`, `Motion Image`, `Carousel`, `Video`, `s`, `High (24 hours)` | Confirm `Image` = `Static`. `s` and `High (24 hours)` are junk and need an explicit drop decision |
| Creative Design · `Priority` | `Static Average (24 hours)`, `Static High (12 hours)`, `Video Average (48 hours)`, `Video High (24 hours)` | `Average (3 days)`, `High (24 hours)` | **Fully disjoint.** The template encodes format × urgency; Gratsi encodes urgency only, with a different SLA (3 days vs 24/48 hours) |
| Creative Design · `Source` | `TAS`, `Client` | + `Facebook Reels, Facebook Feed Square` | Junk option; confirm drop |
| Creative Design · `Funnel` | `TOF`, `RETARGETTING`, `ALL FUNNELS` | + `TAS` | Junk option; and this vocabulary differs from `Meta Copywriting`.`Funnel`'s six values — decide on one funnel vocabulary |
| Creative Design · `Platform` | 6 platforms | + 2 pasted sentences (`Use different relevant visuals from the girls gathering folder…`, `Sticky Banner:-`) | Junk options; confirm drop |
| UGC Management · `Status` | `Filming In Progress...` | `Filming In Progress` | Ellipsis only — safe, but must be normalised |
| UGC Management · `Platform` | `Backstage` | `Back stage` | Space only — safe, but must be normalised |
| UGC Management · `Internal Creator's Status` vs `Creator Status` | `(Internal) Request`, `(Internal) Pending for CS Approval`, `(Internal) Revisions Needed`, `(Internal) Approved` | `Waiting for creator's response on the brief`, `Declined the brief`, `Waiting for assets`, `Waiting for revision`, `Assets delivered ` (trailing space) | **Fully disjoint**, and these may be two different state machines (internal approval vs creator-side progress) rather than one renamed field. Needs the owner |
| Creative Sheet (tblGC0) · `Status` | `Revision Submitted` | `Revisions Submitted` | Singular/plural only |
| Competitive research · `Type` | `Competitor`, `Inspiration` | + `Inspirations` | Duplicate plural; confirm it folds into `Inspiration` |

### C. Structural questions the field map cannot answer

1. **Angles vs Concepts.** Gratsi stores `Personas`, `Product`, `Collection`, `Pain Points`, `USP`
   and `Type` on the **Concept**; the template stores them on the **Angle**. Either the importer
   keeps inferring the angle's persona/product from its concepts, or the product accepts that these
   are concept-level attributes for Gratsi. This is a modelling decision, not a mapping one.
2. **Six misnamed Gratsi link fields** (see the table at the top). Each needs a confirmed target
   before any link import.
3. **Themes.** Three candidates for "Gratsi's themes": the 28 select options on `Concepts.Theme`, the
   `(Internal) Creative Modules` table (tblzS73a9JrJGiV2J), and the unrelated `Themes` table
   (tbl1aFLMJXxhdVKiz). The global theme library needs one of them named as the source.
4. **Flattened links.** In Gratsi, `Angles.(Internal) Creative Design`,
   `Meta Copywriting.Product`, `(Internal) Collections.(Internal) Product`,
   `Campaigns & Offers.Design attached` and `Client Assets Organisation.(Internal) Creative Design`
   are `singleLineText` where the template has record links — and `(Internal) Collections.(Internal)
   Creative Design` and `DONT USE Creative Sheet.Creative Name` are flattened on the **template**
   side instead. Whether each holds a recoverable label cannot be established from metadata.
5. **Name generation.** `Concepts.Name` and `Copywriting.Copy #` are **formulas** in the template and
   **stored text** in Gratsi. Gratsi's existing names were typed, so they will not necessarily match
   what our naming formulas generate. Decide whether to regenerate or preserve on import.
