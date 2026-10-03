# Genuinely missing columns: the search, and its result (2026-10-03)

Track ALL-TABLES, written while seeding `column_definitions` for the twenty tables that followed
Personas. The rule this document answers is the brief's:

> A GRATSI FIELD WITH NO POSTGRES COLUMN that is NOT derived and NOT ambiguous is a genuinely
> missing column: add it to `packages/db/drizzle/0045_column-inheritance.sql` … and record the
> column with its Gratsi field name and the production row count of its table.

## Result: none. Migration 0045 and the journal are unchanged.

**Zero Gratsi fields qualify.** Every one of Gratsi's 340 fields is accounted for by a column that
already exists, by a derivation, or by the two AMBIGUOUS banner fields (which the law routes to a
hidden row and a decision line, never to a new column —
`docs/decisions/overnight-ambiguous-fields.md`). So `0045_column-inheritance.sql` is untouched, the
journal still ends at idx 45, and nothing new needs applying to production.

That is a result, not an absence of work: it is the second independent confirmation that the
`personas.passion` gap — the one real missing column, already added by the `IF NOT EXISTS` block at
the end of 0045 and already imported — was the last of its kind.

## How it was searched

`docs/audits/overnight-gratsi-columns.md` classifies all 340 Gratsi fields and names, for each
stored one, the Postgres column the engine writes it to, with the `airtable-import.ts` line. Every
such column was then checked against the real schema rather than against the audit's prose:

- `packages/db/src/column-seed.test.ts` → *"keys every column to a real Postgres column or a
  junction OF ITS OWN TABLE"* reads `information_schema` from the migrated PGlite database and fails
  on any `column_key` in the seed that is neither a column of its own table nor a junction table
  carrying a foreign key back to that table. The junction half of that check is deliberately strict:
  a key that merely matches *some* public table name is not enough, or a slip like `['assets', …]` on
  `creative_briefs` (the real key is the `asset_id` column, and `assets` is a real table) would pass
  unseen — a companion test asserts that this exact slip is rejected. Two keys are allowlisted with
  the audit line that justifies them, `concepts.angle_products` and `concepts.angle_personas`, the
  engine's inferred concept×angle junctions (`docs/audits/overnight-gratsi-columns.md:510-511`). It
  passes, which means all 170 Gratsi rows and all 152 parent rows name something real, and every
  table-shaped key belongs to the table it is seeded on.
- The classification arithmetic leaves nothing over: 97 INHERIT + 23 DETACH-RELABEL + 114
  CHILD-ADDED + 104 DERIVED + 2 AMBIGUOUS = 340. The 104 DERIVED get no column by law (lookups,
  rollups, formulas, Airtable system fields, and the inverse side of a link the other table owns);
  the 12 parent lookups in `docs/decisions/overnight-dead-lookups.md` are `isValid:false` in
  Airtable itself and seed nothing at all.

## The reverse direction, for the no-drop register

Searching for missing columns also turns up the mirror case: columns the platform HOLDS that no
Airtable field in either base names. These are not missing and nothing is wrong with them, but they
get no `column_definitions` row from this seed, so they are invisible to a resolver-driven page until
someone adds a row by hand. Recorded here so that invisibility is not later read as a drop. Row
counts are the production counts from `docs/decisions/no-drop-2026-10-02.md`.

The seed carries **262 distinct (table, column) pairs across 21 tables**. Everything below is a
stored column those 262 do not reach.

| table | production rows | column with no Airtable field in either base |
| --- | ---: | --- |
| `creative_briefs` | 397 | `version`, `sequence`, `due_date`, `inspo_links`, `launched_at`, `launch_priority` |
| `concepts` | 106 | `internal_status`, `client_status` |
| `creators` | 75 | `product_ids`, `current_period_start`, `partnership_ended_at`, `requires_attention` |
| `personas` | 31 | `product_id` (the parent base has no Product field; the existing seed comment says so) |
| `creative_dimensions` | 22 | `creative_design_id` |
| `products` | 9 | `collection_link` |
| `collections` | 5 | `creative_design_2_id` |
| `copywriting` | 4 | `concept_id`, `click_for_ai_spell_checker`, `spelling_feedback` |
| `creative_reporting` | 0 | `brief_id` |
| `themes` | 9 | the whole table — global, see below |

Four more columns are unreached for a different reason — an Airtable field DOES name them, but it is
a field the law gives no row. They are listed in `docs/decisions/overnight-ambiguous-fields.md`
rather than here: `concepts.name`, `campaigns_offers.name` and `copywriting.copy_number` (generated
names, `formula` in Airtable) and `creative_briefs.inspiration` (two parent fields, one column).

`concepts.internal_status` and `concepts.client_status` are the two that matter most: they are the
two-track approval of CLAUDE.md non-negotiable 4, they are displayed on `/app/concepts` today, and
neither Airtable base has a field for either. **A concepts page driven only by this seed would lose
both columns.** That is the first thing an owner has to rule on before any page moves onto the
resolver, and it is why this track seeded data and did not migrate pages — see the handover notes.

## Themes

`themes` has no rows in this seed at all. The real themes table exists only in the Gratsi base
(`tbl1aFLMJXxhdVKiz`); the parent id of that name is Creative Modules. Themes is a global library by
CLAUDE.md non-negotiable 3 and is deliberately absent from `PROPAGATION_TABLES`, so
`column_definitions.table_key` — documented as *"the content table, as `PROPAGATION_TABLES` keys
it"* — has no legal value for it. Its nine production rows are untouched and its page is unchanged.
Assigning it a key, or a global-library rule of its own, is an owner decision.
