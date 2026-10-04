# Ambiguous fields, and every judgement call the all-tables seed made (2026-10-03)

Track ALL-TABLES, written while seeding `column_definitions` for the twenty tables that followed
Personas (`packages/db/src/column-seed.ts`). Two things are recorded here, both because the law says
so:

> NEVER guess an Airtable field into an existing column: an AMBIGUOUS field becomes a HIDDEN
> child-added row plus a line in a decision doc — guessing is the bug that put Gratsi's `Passion`
> into `core_desires` and displaced `Drivers for this persona`.

1. the two genuinely AMBIGUOUS fields the Gratsi audit found; and
2. **every place where the two discovery documents disagree with each other**, with the reading the
   seed took and why. Ten such places. They are not ambiguity in Airtable; they are ambiguity in
   the audits, and a reviewer diffing the seed against either document will land on each of them, so
   each is written down rather than quietly resolved.

---

## 1. The two AMBIGUOUS fields

| table | Airtable field | type | base |
| --- | --- | --- | --- |
| `Meta Copywriting` → `copywriting` | `⚠️ Please Change the Status of the copy` | singleLineText | Gratsi |
| `Youtube Copywriting` → `youtube_copy` | `⚠️ Please Change the Status of the copy` | singleLineText | Gratsi |

A stored Airtable type with **no Postgres column, no link that resolves it and no formula**. It is
not the converted-link residue the base's other 25 `singleLineText` fields are: its name is not a
table name, and `import-mappings.ts` calls it *"UI instruction banner, not data"* at both sites
(`:717-721`, `:938-942`). Occupancy **could not be established** either way: both tables hold zero
records.

**Decision taken, and it is the conservative one:** a banner is an affordance of the Airtable
interface, not a column. Each gets a HIDDEN child-added row — `is_hidden = true` AND
`source = 'custom'`, which is the Gratsi audit's own prescription for an AMBIGUOUS field — with
`field_type` `singleLineText`, keyed by the sentinel `UNMAPPED_COLUMN_KEY`
(`'airtable_status_banner'`), the one `column_key` in the whole seed that names no Postgres column
and no junction. `source` matters and is not cosmetic: `schema/column-definitions.ts` defines
`parent` as *"part of the master set"*, and no parent row for this key exists on either copy table
(the parent base has no Youtube Copywriting table at all), so a `parent` here would tell an admin who
un-hides the column that it follows a template column that does not exist. The seed's child-row
builder therefore has a fourth kind, `hidden-custom`, for hidden *and* child-added.
`column-seed.test.ts` holds three assertions about it: every *other* key in the seed resolves to
something real, this one never reaches a resolved column list on either table, and the stored row on
each copy table carries `source: 'custom'` with `is_hidden: true`. Nothing reads it, nothing stores
it, and no column was invented to hold it.

**If the owner disagrees** — if the banner should disappear from the platform entirely rather than
sit hidden — delete the two rows and the sentinel. Nothing else depends on them.

---

## 2. Where the two audits disagree, and what the seed did

`docs/audits/overnight-parent-columns.md` pairs each PARENT field with a Postgres column.
`docs/audits/overnight-gratsi-columns.md` does the same for Gratsi and classifies each field. Where
the two name **different columns for the two sides of what one of them calls a single relabel**, the
seed cannot follow both: a relabel is one column under two labels, and
`UNIQUE (brand_id, table_key, column_key)` permits one row per column per base.

The rule applied throughout: **follow the engine** (`packages/db/src/airtable-import.ts`, which the
Gratsi audit cites with line numbers and which the brief names as the authority), and where the
engine is silent, give each field the column its own evidence names rather than merging two fields
into one row.

### 2.1 `Ad Content` vs `Script / Ad Content` — split, not relabelled

The Gratsi audit lists `Script / Ad Content` as a DETACH-RELABEL of the parent's `Ad Content` with
`column_key` `script_content`. But the parent audit pairs `Ad Content` with `ad_content` (schema name
match, `briefs.ts:113`), and the engine writes Gratsi's field to `script_content` (`:1013`). Those
are two different columns, both of which exist.

**Seeded as:** parent row `ad_content` "Ad Content"; Gratsi child-added row `script_content`
"Script / Ad Content"; `ad_content` hidden for Gratsi. No data is merged and nothing is dropped. If
the owner says the two are one datum, the fix is a column migration, not a relabel.

### 2.2 `Inspiration` and `Inspiration Image` — one column, two parent fields (anomaly A5)

The parent base has BOTH `Inspiration` (field 19, richText) and `Inspiration Image` (field 20,
multipleAttachments), and the parent audit pairs **both** with `inspiration_image`. Only one can
have the row. `creative_briefs.inspiration` also exists and **nothing in the engine writes it**.

**Seeded as:** one parent row, `inspiration_image` "Inspiration Image" (the pairing the mapping and
the schema agree on), relabelled "Inspiration" for Gratsi, which is the column the engine writes for
Gratsi's `Inspiration` (`:1026`). Parent field 19 gets **no row**. **This is the one place a stored
parent field with a plausible column was left unseeded**, and it needs an owner ruling: does
`creative_briefs.inspiration` belong to parent field 19, or is it dead?

### 2.3 The two creator approval tracks — the engine wins, and it matters

The parent audit pairs BOTH `Internal Creator's Status` (field 12) and `Status` (field 13) with
`internal_creator_status`, which would collide on the unique index. `import-mappings.ts` documents
the pair **swapped** (`:742`, `:804`). The engine does the opposite and says why:
*"the tracks were SWAPPED in the first import. UGC's 'Status' options are exactly the creator CLIENT
track's keys"* (`airtable-import.ts:1145-1160`).

**Seeded as:** `Status` → `client_status`, `Internal Creator's Status` → `internal_creator_status`,
and Gratsi's `Creator Status` relabels `internal_creator_status`. Getting this backwards would label
a client-facing column as the internal one, which is the single mistake CLAUDE.md non-negotiables 4
and 10 exist to prevent.

### 2.4 `Concepts.Themes` — no parent row, so Gratsi's `Theme` is child-added

The parent's `Themes` link points at the table the parent base LABELS `Themes`, which is
Creative-Modules shaped (anomaly A2), and the parent audit states in those words that it **could not
establish** the junction. The Gratsi audit lists Gratsi's `Theme` as a relabel keyed
`concept_themes`.

**Seeded as:** no parent row; Gratsi gets `concept_themes` "Theme" as `source: 'custom'`, detached.
Separately, that column resolves to **zero rows for Gratsi today** — 24 live select labels matching
nothing, because all three Gratsi theme records import with an empty `Name`. That is a
themes-library decision (audit finding 3), not a column one.

### 2.5 `Reference Link` → `foreplay_link` — asserted by one audit, declined by the other

The parent audit says `creative_modules.foreplay_link` *"is the only candidate and I did not assert
it"*. The Gratsi audit's relabel table asserts it.

**Seeded as:** no parent row for `Reference Link`; Gratsi's `Foreplay Link` is child-added on the
engine's evidence (`:1363`). A relabel of something unestablished would be exactly the guess the law
forbids.

### 2.6 `collections` link columns — the FK the schema has, not the junction the parent audit guessed

The parent audit pairs `(Internal) Collections`.`Angles` with a junction `conceptCollections` and
`(Internal) Product` with "no column". `collections` carries `angle_id` and `product_id` as FKs and
the engine writes both in pass 2 (`:1635`, `:1636`); the Gratsi audit calls both INHERIT and names
those columns.

**Seeded as:** `angle_id` and `product_id`.

### 2.7 Gratsi `(Internal) Collections`.`Copywriting` — no row, one column already owns it

Gratsi has two fields that the engine writes to `collections.copywriting_id`: `Copywriting` (order 3,
CHILD-ADDED in the audit) and `Ads Copywriting copy` (order 13, INHERIT). One column, one row per
base.

**Seeded as:** the parent's row for `copywriting_id` ("Ads Copywriting copy"), inherited by Gratsi;
**no row for `Copywriting`**. An owner may prefer the child-added row to win and the inherited one to
be hidden — it is a label choice, and the data is identical either way.

### 2.8 `Concepts to film` — keyed by the junction, with Gratsi's second link kept separate

The parent audit pairs `Concepts to film` with the jsonb `creators.concept_ids`; the Gratsi relabel
table keys the same relabel `creator_concepts`. Gratsi ALSO has a separate field named `Concepts`
which the engine writes to `concept_ids` (`:1849`).

**Seeded as:** parent row `creator_concepts` "Concepts to film" (a link column is keyed by its
junction, as `schema/column-definitions.ts` prescribes), relabelled "Concept to film" for Gratsi;
Gratsi's `Concepts` is a separate child-added row keyed `concept_ids`. Two fields, two rows, nothing
merged.

**Amended 2026-10-04 (AI-41):** two fields, two rows, nothing merged — and the second row is
`hidden-custom`, not `custom`. The rule above is about not GUESSING one field into another column,
and it still holds; what it did not settle is whether the second row should also be *shown*. It
should not. `UGC Management › Concepts` is empty on all 70 live rows, the importer skips it
(`import-mappings.ts`, `handler: 'skip'`) and the exclusion register in `docs/decisions.md` lists
it, so nothing writes `creators.concept_ids` and the UGC grid has no renderer for the key. A visible
row therefore resolved into `gridColumnsFrom`'s `missing` set and the Gratsi UGC page printed
"Configured for this brand but not drawn here: concept_ids" — a notice about a column, where a
column should have been. Hidden is what the AMBIGUOUS rule prescribes for exactly this shape of
field (`is_hidden = true`, `source = 'custom'`), it keeps the row so the Airtable field stays
remembered, and un-hiding it is a one-click Column Admin edit the day the field carries data.
Retiring the row altogether is still open and belongs to the owner, not to a builder.

### 2.9 `Creative Name` on `creative_sheet_items` — contested type, agreed column

The field is `multipleRecordLinks` in Gratsi and `singleLineText` in the parent, and the parent audit
marks the `brief_id` pairing CONTESTED. Both audits nevertheless name `brief_id`.

**Seeded as:** one parent row `brief_id` "Creative Name", `field_type` `singleLineText`, inherited by
Gratsi. The type disagreement is recorded in `field_type` only and changes no column. Caveat worth
repeating: `creative_sheet_items` holds **zero rows in production for every brand** against 377 live
Gratsi records, so this table's column map is the least-exercised part of the seed.

### 2.10 `Copywriting`.`Product` — "no column" in one audit, the parent half of an INHERIT in the other

`docs/audits/overnight-parent-columns.md` (`Copywriting`, order 5) pairs the parent's `Product` link
with **"no column"**, on the basis *"mapping `copywriting` handler `skip`"* — pass 1 of the importer
does skip it. `docs/audits/overnight-gratsi-columns.md` §4 field 4 calls Gratsi's `Product`
**INHERIT** into `copywriting.product_id` (citing pass 2, `:1687`), and an INHERIT resolves to
nothing unless the PARENT set carries that column: a child with no row of its own reads the parent's,
so "no parent row" and "Gratsi inherits it" cannot both hold.

The engine settles it, which is this section's standing rule. Pass 2 writes the column from the field
named `Product`: `const productId = firstRef(prodMap, f.Product)` inside the Meta-Copywriting
pass-2 block — read at `packages/db/src/airtable-import.ts:1706`, written by the
`update(copywriting)` at `:1707-1716`. (The Gratsi audit's `:1687` is a few lines off; that line sits
in the creative-briefs pass-2 block above it. The field, the table and the column it names are
right.) The parent
audit also contradicts its own field table in its anomaly A7, where it lists
`copywriting.product_id` as *defined by* `Copywriting`.`Product` (link) — so "no column" there means
"pass 1 stores nothing", not "the field names no column".

**Seeded as:** parent row `product_id` "Product" at `display_order` 5
(`packages/db/src/column-seed.ts`, `COPYWRITING_PARENT`), inherited by Gratsi with no child row. This
is recorded because a reviewer diffing the seed against the parent audit's field table lands on
exactly this row and reads it as invented, which is what §2 exists to prevent. If an owner rules the
other way, the consequence is not a deleted row but a broken INHERIT: Gratsi's `Product` would then
need a child-added row of its own.

---

## 3. Consequences of the law that an owner should see, before any page moves onto the resolver

None of these is ambiguity. Each is the law applied correctly, producing a result that will surprise
someone looking at a resolver-driven page. **No page was migrated in this track, so none of them is
live.**

1. **Generated names get no row.** `Concepts.Name`, `Campaigns & Offers.Name` and
   `Meta Copywriting`/`Copywriting`'s `Copy #` are `formula` fields in Airtable, so the law gives
   them no `column_definitions` row — yet `concepts.name`, `campaigns_offers.name` and
   `copywriting.copy_number` are stored, populated, and the FIRST column of their grids.
   CLAUDE.md non-negotiable 6 makes an auto-generated name a first-class column, computed by
   `packages/domain/naming` rather than by Airtable. **A resolver-driven concepts or
   campaigns-offers grid would therefore have no Name column.** The ruling needed: does a
   generated-and-stored name get a `column_definitions` row (and if so, at what `display_order`)?
2. **Platform columns get no row either.** `concepts.internal_status` and `concepts.client_status`
   are the two-track approval of non-negotiable 4 and neither Airtable base has a field for them;
   nor does any base have a field for the `Updated` column that eleven of the app's tables display
   from `updated_at` (`docs/audits/overnight-ui-columns.md`, every `item.updatedLabel`). The stored
   ones are listed in `docs/decisions/overnight-missing-columns.md`. Until they have rows, a
   resolver-driven page loses them.
3. **Gratsi resolves to no AI Characters columns at all.** `AI Characters / Personas` is a
   parent-only table, so the audit's verdict is twelve HIDDEN rows for Gratsi, and
   `resolveColumns(gratsi, 'ai_characters')` correctly returns `[]`. Hiding never drops data and
   every other brand still sees all twelve — but a resolver-driven `/app/ai-characters` would show
   Gratsi an empty header row. Pinned by a test so it cannot change silently.
4. **Two order spaces interleave.** An inherited column keeps the PARENT's field index; a detached or
   child-added one carries the CHILD's. So Gratsi's resolved order is not Gratsi's Airtable order
   wherever it inherits — on `copywriting`, inherited `Creative` (parent index 2) sorts ahead of
   inherited `Status` (3) although Gratsi's base lists `Status` first. This is intrinsic to resolving
   per column rather than per table; the alternative is a child row for every column, which defeats
   inheritance. Reordering is an admin action on real data, so it is fixable by hand per brand.
