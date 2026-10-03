# Column rollout — what is still stuck, 2026-10-04

Everything else is migrated. Two items remain, each blocked on a decision nobody can infer from the
code, and one of them is blocked on a defect as well.

## 1. Creative Sheet — the last page, blocked on four rulings

`apps/web/src/app/app/creative-sheet` still builds its columns by hand. The seed rows cannot be
written without picking a side on each of these.

### a. Two conflicting name formulas (a DEFECT, filed as its own task)

`creative_sheet_items` has NO `name` column — Airtable's primary field is a formula, and the schema
says in its own voice that storing it would let the month drift from `created_at`. So the name must
be a VIRTUAL column, which is exactly what migration 0046 made possible. But a virtual column names
exactly ONE formula, and there are two:

| Function | Where | With an empty brief name |
| --- | --- | --- |
| `creativeSheetName` | `packages/db/src/formulas/names.ts:39`, and registered | `"October-"` |
| `creativeSheetItemName` | `packages/db/src/creative-sheet-items.ts:81`, and what the page renders | `"October"` |

Airtable's formula is `DATETIME_FORMAT({Created},"MMMM") & "-" & {Creative Name}`, and `&`
concatenates an empty value as an empty string — so the registered one is the faithful transcription
and the one in use is the tidier reading. Which is right is a product decision, because option (a)
changes what the page displays today. This is the duplication the formulas module exists to prevent,
in its own words.

### b. The composite QA cell

One page header, "QA", draws THREE stored booleans (`qa_video_editor`, `qa_designer`,
`qa_strategist`), and the seed holds them as three rows. The resolver returns three columns where the
page draws one cell. Either the registry collapses three keys into one cell — which breaks the
one-key-one-column assumption Column Admin shows an admin, so an admin hiding "QA" would be hiding a
column that is not what they see — or the page grows three tick columns.

### c. Whether this table should be configurable at all

The PARENT base calls it **`DONT USE Creative Sheet`**, and only 5 of its 17 fields carry anything.
Making it configurable may be making a deprecated table configurable.

### d. Two smaller ones, worth settling in the same pass

- `denied_revisions_needed` is spelled `Denied/revisions needed` in the seed (Gratsi's raw field
  name, which the importer keys on) and `Denied / revisions needed` in the panel and in
  `module-parity.spec.ts`. One field, two spellings, today.
- Five fields are configured and drawn only in the PANEL: `client_comments`, `qa_checklist_doc`,
  `denied_revisions_needed`, `spell_check_requested`, `spelling_feedback`. Grid columns or not?

## 2. Themes — unchanged, and still correct

Held global and outside the resolver by
`docs/decisions/themes-stays-outside-the-resolver-2026-10-03.md`. Nothing has changed: `themes` has
no legal `table_key`, two tests assert that absence, `used_by` is a cross-brand count no `column_key`
shape admits, and the client-facing Themes table is deliberately narrow because clients see zero
internal data. The four rulings that would reverse it are in that doc.

## Not stuck

The nine other pages in this wave are done, each with its own commit, its own resolver gate and its
grep proof. The virtual-column mechanism is in and carries six columns in production use. One
cosmetic item worth knowing rather than fixing blind: the propagation spec's `?status=` test fails
only under parallel load and passes alone — a cold-route timeout on a page this rollout never
touched, verified repeatedly across three sessions.
