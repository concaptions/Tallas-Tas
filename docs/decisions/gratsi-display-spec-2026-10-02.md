# Display spec: the UI shows Gratsi's fields, under Gratsi's names (2026-10-02)

Owner's rule, pinned this round: **the Airtable Gratsi base `appllDG4OmkK2Hdnn` defines what the app
displays.** Two consequences, applied to all 21 tables:

1. **Never show a column the Gratsi base does not define.** Columns we hold that Gratsi has no field
   for are HIDDEN from the grid and the detail panel. They are NOT dropped — see
   `docs/decisions/no-drop-2026-10-02.md`; 28 production tables hold rows. Each hidden column keeps
   its data and gains a `@deprecated` comment in its Drizzle schema naming this document.
2. **Show Gratsi's field name, not ours.** The display label comes from the Gratsi field; the
   database column keeps its existing name, so this is a label change in the UI layer only. No
   migration renames a column.

## Personas — the worked example (Gratsi `tblyt7X4VjHxtMDVS`, 7 fields)

The page and the panel show these seven and nothing else, in this order:

| # | Gratsi field (the displayed label) | our column | note |
| --- | --- | --- | --- |
| 1 | `Name` | `name` | unchanged |
| 2 | `Description [Age Status Salary]` | `demographic` | relabelled from "Demographic" |
| 3 | `Personality` | `psychographic` | relabelled from "Psychographic" |
| 4 | `Drivers for this persona` | `core_desires` | relabelled from "Core Desires" |
| 5 | `Passion` | **`passion` (new in 0044)** | see below |
| 6 | `Angles` | `angle_personas` junction | relabelled from "Linked angles"; must be two-way (AI-40/42) |
| 7 | `Problem-Solution Awareness Level` | `stage_of_awareness` | relabelled from "Stage of Awareness" |

**`Passion` gets its own column.** It is the one Gratsi Personas field with no counterpart in our
schema. It must not be folded into another column: it previously sat in `core_desires`, which
displaced `Drivers for this persona`, so one wrong mapping made two columns wrong. Migration 0044
adds a nullable `passion text` column; the importer reads Gratsi `Passion` into it. Additive, so no
data-loss risk.

**Hidden from the Personas UI, kept in the database and marked deprecated:** `product_id` (shown as
"Product"), `day_in_the_life`, `emotional_triggers`, `pain_points`, `success_factors`,
`perceived_barriers`, `buying_triggers`, `problem_challenge`, `success_transformation`,
`trigger_words` — and the `Updated` column, which is platform plumbing (`updated_at`) rather than a
Gratsi field. Ten of those eleven are empty for Gratsi in any case; `emotional_triggers` held
`Drivers for this persona` until 2026-10-02 and is empty now that `core_desires` holds it correctly.

## Importer

Gratsi's 7 Personas fields map 1:1 onto the columns above. After migration 0044 and a
dependency-closed re-import, every one of the seven displayed columns must carry data wherever the
Gratsi row carries it — that is the acceptance test, measured with `count(col)` against `count(*)`
per column for `brand_id = <gratsi>`, not asserted.

## The same discipline, every other table

For each of the remaining 20 tables: the grid column defs and the detail panel show exactly the
Gratsi fields for that table, under Gratsi's names; every other column is hidden and marked
deprecated; any Gratsi field with no column is added additively in 0044. `Updated` comes off every
grid under the same rule. Per-table field lists are reconciled against the live base in
`docs/audits/qa-schema-2026-10-02.md` (Subagent A) and the current UI state in
`docs/audits/qa-ui-columns-2026-10-02.md` (Subagent B), because the owner's pinned lists are
approximate: Angles has 19 stored fields against the 16 listed, Creative Design 38 against 30,
Collections 13 against 6, and Creative Sheet's 15 includes several Airtable formulas the app must
derive rather than store.

## Collaborator (assignee) fields — audited 2026-10-02

Imported `singleCollaborator` values are Airtable collaborator NAME strings, not Clerk user ids, so
every Clerk lookup misses for imported rows. The required behaviour is the Themes pattern: show the
resolved Clerk name as prose when there is a match, otherwise show the stored value itself in
`font-mono` with the "stored assignee value; it matches no user on the platform" tooltip. Never
"null", never a blank, never a dash that hides a real name.

| Surface | State | Action |
| --- | --- | --- |
| Themes | **Correct.** `assigneeValue()` (`themes/fields.ts`) returns `{text, mono}`; the grid and card render `data-resolved` and the hint. | reference implementation |
| Email Campaigns Management | **BUG.** `email-campaigns-workspace.tsx:163` is `item.row.assigneeName ?? <Dash />`, and `assigneeName` is `assigneeNames.get(assigneeId) ?? null` (`packages/db/src/email-campaigns.ts:195`). An imported collaborator name misses the Clerk map and renders as a dash — the real name is dropped from the display. | adopt `assigneeValue` |
| Email Flows Management | **BUG.** `email-flows-workspace.tsx:212` is `item.flow.assigneeName ?? dash()`, same null-collapse (`packages/db/src/email-flows.ts:184`). | adopt `assigneeValue` |
| Creative Design | Safe by accident: `creative_briefs.assignee` is plain `text` with no Clerk lookup, so the stored name renders as-is. Not Clerk-linked, but it cannot show a null. | leave; note for later |
| UGC Management | **The pinned list names "UGC.Assignee", but the Gratsi UGC Management table has no Assignee field** — its 34 stored fields contain none. Nothing to display. | flag to the owner |

The fix is to lift `assigneeValue` and `UNRESOLVED_ASSIGNEE_HINT` out of `themes/fields.ts` into a
shared helper so the three modules cannot drift, and to use it in the two broken grids and their
panels.
