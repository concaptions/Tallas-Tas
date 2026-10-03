# Column rollout — what is still stuck, 2026-10-04

**Fourteen tables are resolver-driven.** One item remains, and it is held by decision rather than
blocked by anything.

## 1. Themes — held global, deliberately

`docs/decisions/themes-stays-outside-the-resolver-2026-10-03.md`. Unchanged and still correct:
`themes` has no legal `table_key`, two tests assert that absence, `used_by` is a cross-brand count no
`column_key` shape admits, and the client-facing Themes table is deliberately narrow because clients
see zero internal data. `themes-workspace.tsx` is now the ONLY file in the app that still builds a
`GridColumn` array, which is what that decision costs. The four rulings that would reverse it are in
that doc.

## Settled since the last list

**Creative Sheet is done** (`f432cb7`), and all four of its rulings are closed:

1. **The two name formulas** — settled in favour of the faithful one. `creativeSheetItemName` is
   deleted; the query layer calls `creativeSheetName`, so a row with no brief reads `October-`,
   which is what Airtable's `&` produces. The displayed value changed for those rows; that is the
   cost of mirroring Airtable and the fixtures record it.
2. **The composite QA cell** — three columns, not one. Airtable has three separate checkbox fields,
   and the single `QA` header had the resolver returning three columns where the page drew one cell,
   so an admin hiding "QA" would have been hiding something other than what they saw.
3. **Whether the table should be configurable** — yes. The parent base calling it `DONT USE Creative
   Sheet` is recorded in the seed's comment; it did not change the answer.
4. **The two smaller ones** — `Denied/revisions needed` keeps Airtable's unspaced spelling, which the
   importer also keys on, and the five panel-only fields are real fields of the base so they are
   columns.

One consequence worth knowing rather than fixing blind: the PANEL still writes
`Denied / revisions needed`, spaced, and `module-parity.spec.ts` asserts that spacing. The grid now
reads the unspaced Airtable spelling. The panel is hand-built and not resolver-driven, so the two
differ on screen until panels follow — which is the next piece of work, not a defect in this one.

## Not stuck

Thirteen pages migrated across two waves, each with its own commit, resolver gate and grep proof.
Virtual columns carry seven columns in production. `pnpm --filter @tas/db verify-rollout` reads every
table back through the real resolver and matches the PGlite gates exactly.
