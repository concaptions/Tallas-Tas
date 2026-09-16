# TICKET-005 · stuck-rule report (2026-09-16)

Three build → QA → review rounds ran without a full approval, so the loop stopped per the engineering
brief (§7, stuck rule). The uncommitted work is in the working tree; nothing was discarded.

## What each round found

| Round | QA | Product reviewer | Architecture reviewer | Adversary |
| --- | --- | --- | --- | --- |
| 1 | pass | approve | request changes: non-test diff 309 lines; `seed.ts` had grown an upsert-on-natural-key layer criterion 4 never asked for | request changes: three real escapes from `withBrand` |
| 2 | fail: `pnpm test` timed out on PGlite boot (5 s default) under machine load 14–19 on 8 cores; passed on the middle run | request changes: raise the PGlite test timeout | same | approve |
| 3 | pass (3/3 runs) | approve | approve | request changes: one type-level defect (below) |

Round 1 adversary findings, all fixed in round 2 with regression tests: (a) the helper returned Drizzle's
mutable builder, so `.$dynamic().where(...)` replaced the brand scope; (b) `and(scope, callerWhere)` did
not parenthesise a raw `sql` filter, so a top-level `OR` made the scope optional; (c) the raw insert
builder exposed `onConflictDoUpdate({ set: { brandId } })`, moving a row to another brand. The fix
seals the surface: `select`/`insert`/`update`/`softDelete` return closure-built `ScopedSelect` /
`ScopedWrite` objects (only `orderBy`, `limit`, `returning`, thenable), and the caller filter is wrapped
in parentheses.

Round 2 QA failure was environmental (first test of each PGlite file boots PGlite and applies both
migrations in 4–10 s); `packages/db/vitest.config.ts` now sets `testTimeout: 30_000`.

## What is left (round-3 adversary, required)

`ScopedInsertValue<T> = Omit<PgInsertValue<T>, 'brandId'>` drops every optional column, not only
`brandId`, because `keyof PgInsertValue<T>` collapses to the required keys. `withBrand(db, a)
.insert(brandAssignments, { userId, role: 'csm', createdBy: 'x' })` fails to compile (TS2353) although
plain Drizzle accepts it. Fix: derive the payload types from the table's insert model instead:
`Omit<T['$inferInsert'], 'brandId'>` for inserts and `Partial<Omit<T['$inferInsert'], 'brandId'>>` for
updates, plus a compile-time test that `createdBy`, `deletedAt` and `id` are accepted. Estimated change:
under ten lines of code and one test.

## Recommendation

Run one more round with exactly that fix. Everything else in the ticket is approved by QA, both
reviewers and the adversary. The alternative, discarding the ticket, loses three rounds of verified work
for a one-line type fix.
