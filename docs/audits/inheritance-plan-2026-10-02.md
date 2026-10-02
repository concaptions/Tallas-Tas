# Column inheritance: the plan (2026-10-02)

Decided from the four Phase 1 discovery audits: `existing-inheritance-2026-10-02.md`,
`parent-columns-2026-10-02.md`, `gratsi-columns-2026-10-02.md`, `ui-columns-2026-10-02.md`.

## Build new, borrowing two proven patterns

A new `column_definitions` table. Not an extension of anything, for three evidenced reasons:

1. **`overridden_fields` and `template_row_id` are PER-ROW.** The inheritance needed is per
   brand × table × column. `overridden_fields` is written only ever as `[]` — no code anywhere adds
   a field name — and `template_row_id` is set on 0 of 591 production rows, so the row engine has
   never run. Keying a brand-level column fact to a row-level jsonb array would mean the same entry
   on each of Gratsi's 390 briefs, and nothing at all for Mattress Central and Funky Painting, which
   have no rows.
2. **`interface_fields` is the right SHAPE but the wrong SURFACE.** It already carries exactly the
   triple we need — `label`, `visible`, `position` (an integer, unlike `custom_field_schemas`) — per
   brand, per field, and it already propagates. But its rows key to one of five client
   `interface_page_key` values, not to a content table, and `docs/design/template-engine.md:1447`
   already lists "one table with a `surface` column for both workspace and client fields" under
   REJECTED alternatives. Folding it in is a later migration, not a prerequisite.
3. **`custom_field_schemas` means "the column exists BECAUSE this row exists".** Inherited columns
   must be able to say "the parent defines it and this child hides it" — a row that SUPPRESSES
   rather than CREATES. Conflating the two makes a soft delete ambiguous. It can later become a
   `source = 'custom'` subset of `column_definitions`.

Borrowed deliberately: `interface_fields`' label/visible/position triple, and
`listApplicableFieldSchemas`' resolution trick (`brand?.templateBrandId ?? brandId`), which inherits
by READING THE PARENT'S ROWS rather than copying them — so a parent edit reaches every attached child
with no propagation job at all.

The name is `column_definitions`, not `brand_field_overrides`: the table holds the parent's master
set as well as the children's overrides, and "overrides" names only half of it.

## The model

`column_definitions`: the shared base columns, plus `brand_id` (the base this row applies to, parent
or child), `table_key` ('personas'), `column_key` (the Postgres column, or a junction key such as
`angle_personas`), `display_label`, `display_order` **integer**, `is_hidden` boolean,
`is_detached` boolean, `field_type`, and `source` ('parent' | 'inherited' | 'custom').
Unique on `(brand_id, table_key, column_key)` where `deleted_at is null`.

Resolution, one function in `packages/db`, `resolveColumns(db, brandId, tableKey)`:

- the parent's rows are the master set, ordered by `display_order`;
- a child row with `is_detached = true` REPLACES the parent's row for that column and ignores later
  parent edits;
- a child row with `is_detached = false` tracks the parent — its label and order may still be set
  locally, but a parent change flows through;
- a child row with no parent counterpart is a child-added column;
- `is_hidden` rows are excluded from the returned list but kept in the table;
- a column with no child row at all inherits the parent's row verbatim.

Nothing copies on write; inheritance happens at read time, so there is no propagation job to go
stale and no child to repair after a parent edit.

## What the pages need, and why it is cheaper than it looks

267 displayed columns across 29 record tables; 23 pages hold a literal array and 9 are partly
config-driven. The expensive-looking part — per-column `render` functions — is already solved:
`apps/web/src/components/views/grid-cells.tsx` is a shared cell-primitive library (TextCell,
BoolCell, ChipCell, ChipListCell, LinkCell, CountCell, DateCell, MoneyCell) imported by 18 workspace
pages, whose own doc comment says "Nothing here knows a vocabulary: the caller resolves labels and
tones and hands them in". So the resolver supplies label, order and visibility as DATA, and each page
keeps a small renderer registry keyed by `column_key`. Labels and order stop being code; rendering
stays code.

## Gratsi's seed, from the live bases

340 Gratsi fields against the parent's 203, every one classified exactly once: **126 IDENTICAL**
(inherit, no child row), **29 RENAMED** (a detached child row carrying Gratsi's label), **177
GRATSI-ONLY** (child-added), **8 LEVEL-SHIFT** (needs an explicit decision), and **37 PARENT-ONLY**
(a child row with `is_hidden = true`).

## Four things discovery found that must be fixed alongside

1. **`/app/interface-config` has no admin gate at all** — the one route that edits per-column
   visibility today. `/app/propagation` is gated (`canSeePropagationPage`) and re-checks in its
   actions; interface-config checks nothing. The brief requires admin-only structure changes.
2. **The Template base is excluded from the brand switcher by exactly one predicate**,
   `apps/web/src/lib/data-source.ts:316` (`!row.isTemplate`).
3. **`PROPAGATION_TABLES` has 20 entries but 21 schema files spread `propagationColumns()`** —
   `client-asset-folders` carries the columns and is missing from the registry.
4. **`custom_field_schemas.sort_order` is `text`**, so it orders lexically ('10' before '2'). The new
   table uses an integer; the existing one is a separate fix.
