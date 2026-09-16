# TICKET-005 · Tenancy tables and `withBrand(brandId)`

- Owners, in order: schema (stage 1, tables + migration) then integrator (stage 2, `withBrand` + test)
- Size: M
- Depends on: TICKET-003
- PRD: §11 (roles, brands and access), §3 (team assignment per brand), §14.1 (one template propagated:
  `template_brand_id`)

## Why

Tenancy is enforced at the query layer. This ticket creates the tables that define who can see which brand
and the single helper every branded query must go through.

## Stage 1 (schema) · tables and migration

1. Tables, all using the shared column helper from TICKET-003:
   - `agencies`: `name`, `clerk_org_id` (unique, nullable until the org is created), `slug` (unique).
   - `brands`: `agency_id` FK, `name`, `slug` (unique per agency), `website` (nullable),
     `template_brand_id` (self FK, nullable; null means this brand *is* the template),
     `is_template` boolean default false, `status` (`active` | `paused` | `archived`) as a pg enum.
   - `users`: `clerk_user_id` (unique), `email` (unique), `full_name`, `slack_user_id` (nullable).
   - `memberships`: `user_id` FK, `agency_id` FK, `role` pg enum `agency_role` (`admin` | `member`),
     unique (`user_id`, `agency_id`).
   - `brand_assignments`: `user_id` FK, `brand_id` FK (this table's `brand_id` is NOT NULL, it is the
     tenancy edge), `role` pg enum `brand_role` (`csm` | `strategist` | `video_editor` | `designer` |
     `media_buyer` | `client`), unique (`user_id`, `brand_id`, `role`).
2. Role enums are defined once in `packages/db/src/schema/enums.ts` and re-exported as TypeScript
   unions so `packages/domain` can import them later without duplicating the list.
3. Migration generated and applied in the PGlite test suite. Indexes on every FK and on
   `brand_assignments (brand_id, user_id)`.
4. Seed: one agency, one template brand, one child brand pointing at it, one admin user with a membership,
   one strategist assigned to the child brand.

## Stage 2 (integrator) · `withBrand`

5. `withBrand(db, brandId)` in `packages/db/src/tenancy.ts` returns a scoped query surface whose
   `select(table)` / `insert(table)` / `update(table)` / `softDelete(table)` only accept tables that have
   a `brand_id` column (typed constraint) and always add `brand_id = $brandId AND deleted_at IS NULL`.
   Inserts force `brand_id` to the scoped brand; updates and soft deletes cannot escape the scope.
6. Unit tests on PGlite: two brands, one `brand_assignments` row each; `withBrand(A).select(...)` never
   returns B's row; `withBrand(A).update(...)` targeting B's id changes zero rows;
   `withBrand(A).insert(...)` with `brand_id: B` in the payload stores A. Setup through `testDb()`.
7. A compile-time test (`expectTypeOf` or `@ts-expect-error`) proves `withBrand(...).select(agencies)`
   does not compile, because `agencies` is not a branded table.

## Files touched

`packages/db/src/schema/*.ts`, `packages/db/src/schema/enums.ts`, `packages/db/drizzle/*`,
`packages/db/src/seed.ts`, `packages/db/src/tenancy.ts`, `packages/db/src/tenancy.test.ts`,
`packages/db/src/index.ts`, `packages/db/vitest.config.ts` (added in round 3, see below).

## Notes

- `agencies`, `brands`, `users`, `memberships` carry the shared `brand_id` column as nullable and unused,
  per the "no exceptions" column rule; only `brand_assignments` is branded and NOT NULL.
- `withBrand` is the first line of defence; route helpers come in a Phase 1 ticket.

## Stage 1 assumptions (schema, round 1)

- `brand_assignments` overrides the shared `brandId` builder with `.notNull().references(() => brands.id)`;
  `columns.ts` itself is unchanged (not in "Files touched"). Its comment now says the foreign key on the
  shared column lands with the Phase 2 per-brand columns (`template_row_id`, `overridden_fields`).
- "Indexes on every FK" is read as: every foreign-key column is the leading column of a btree index. The
  unique constraints `brands (agency_id, slug)`, `memberships (user_id, agency_id)` and
  `brand_assignments (user_id, brand_id, role)` serve their leading column; explicit indexes exist for
  `brands.template_brand_id`, `memberships.agency_id` and the ticket's `brand_assignments (brand_id, user_id)`,
  which also serves that table's `brand_id`. No index is duplicated. `tenancy-tables.test.ts` asserts the list.
- `brands.status` is NOT NULL with default `active`; `is_template` NOT NULL default false. No check
  constraint ties `is_template` to `template_brand_id IS NULL` and nothing enforces one template per agency
  yet; both belong to the Phase 2 template-engine ticket.
- Foreign keys use the default `NO ACTION`: rows are soft-deleted, never deleted.
- Enums: an `as const` array is the single list (`agencyRoles`, `brandRoles`, `brandStatuses`), the pg enum
  and the union type (`AgencyRole`, `BrandRole`, `BrandStatus`) derive from it. `brand_status` lives in
  `enums.ts` with the role enums.
- `seed(db)` is plain inserts, as criterion 4 states (round 2; round 1's upsert on natural keys was cut
  for size). The agency is inserted first, so a repeat `db:seed` fails on `agencies_slug_unique` before
  writing anything; `health_check` is inserted last. Seed identities are placeholders (`user_seed_admin`,
  `admin@example.com`, "Creative Hub Template", "Demo Brand") that cannot collide with real Clerk ids or
  addresses. `seed` returns a `SeedResult` with every row, each from one `insertOne(db, table, values)`
  helper (round 1's `one()` guard folded into the insert); `seed.test.ts` reads it and `scripts/seed.ts`
  prints one `Seeded <key> <uuid>` line per key.
- No `docs/decisions.md` entry: no new dependency and the ticket names no D-number. The conventions above
  (enum pattern, FK index reading, seed shape) can be promoted to a D-entry on request.
- Gated criteria (D-008): none in stage 1. Criterion 3 is verified on PGlite as written; applying
  `0001_tenancy` and the seed to Neon is listed under "Pending human verification" in the runbook next to
  TICKET-003's item, same command.

## Stage 2 assumptions (integrator, round 1)

- "Branded table" is a typed constraint, `BrandedTable`: a `PgTable` whose `brandId` column is NOT NULL
  (`AnyPgColumn<{ notNull: true; data: string }>`) and which carries the shared `deletedAt`. Every table
  has `brand_id` through `baseColumns()`, nullable, so nullability is the discriminator: `agencies`,
  `brands`, `users`, `memberships` and `health_check` are rejected at compile time; `brand_assignments`
  is accepted; a Phase 2 table that overrides `brandId` with `.notNull()` is accepted without touching
  `tenancy.ts`.
- `select(table, where?)`, `update(table, set, where?)` and `softDelete(table, where?)` take an optional
  caller filter, ANDed after the scope terms. Drizzle's builders accept `.where()` once, so without this
  parameter a scoped select could not filter at all. The methods return Drizzle's own builders, so
  `.orderBy()`, `.limit()`, `.returning()` and `await` keep working with the concrete row types.
  (Superseded in round 2, below: the builders no longer leave `withBrand`.)
- Payload types omit `brand_id`: `insert` takes `Omit<PgInsertValue<T>, 'brandId'>` (one row or an
  array), `update` takes the same `Omit` over what `db.update(table).set()` accepts, named through the
  builder's `set` signature (`Parameters<PgUpdateBuilder<T, ...>['set']>[0]`) rather than Drizzle's
  `PgUpdateSetSource<T>` alias, because that alias is an all-optional mapped type over a generic table
  and `@typescript-eslint/no-generated-empty-object-type` reads any reference to it as `{}`. At runtime
  both payloads are overwritten with the scoped brand (the update's SET carries `brand_id = $brandId`,
  a no-op for a row already in scope), so a payload of a wider type (a parsed CSV row typed
  `NewBrandAssignment`) cannot smuggle another brand in; that is what criterion 6's "brand_id: B in the
  payload stores A" exercises.
- `softDelete` sets `deleted_at = now()` (database clock, matching `defaultNow()`), and, like `update`,
  does not touch `updated_at` or `updated_by`; no ticket has defined that convention yet.
- `withBrand(db, brandId)` accepts any `Db`, including a `db.transaction(...)` handle.
- The compile-time proof is `@ts-expect-error` on the real call `withBrand(db, id).select(agencies)`
  (checked by `pnpm typecheck`, whose `packages/db` project includes the tests) plus
  `expectTypeOf(...).toExtend` / `.not.toExtend` on the constraint itself.
- Test fixture: `seed(db)` already yields two brands (template and child) and one assignment on the
  child; the test adds one assignment on the template brand. Brand A is the child, brand B the template.
- No `docs/decisions.md` entry: no new dependency, no deviation, and the ticket names no D-number.
  Gated criteria (D-008): none in stage 2; criterion 6 names PGlite as its substrate.

## Round 2 (schema, stage 1)

Architecture reviewer, required change 1 (diff over the 300-line ceiling): option (a) taken. `seed.ts`
shrunk to plain inserts (`upsertBrand`, `upsertUser` and every `onConflictDoUpdate` removed), the
"is safe to repeat" test deleted, the two runbook sentences promising idempotency replaced by the one-shot
statement, `scripts/seed.ts` reduced to a loop over `SeedResult`. Non-test LOC after the change, counted
the reviewer's way (added lines of non-test `packages/db/src/**/*.ts`: tracked diffs plus whole untracked
files; `drizzle/*.sql`, `meta/*.json`, tests and docs excluded): **372 raw / 259 strict** (strict drops
blank and comment-only lines). Per file, raw/strict: `columns.ts` 4/0, `index.ts` 3/3,
`schema/index.ts` 6/6, `scripts/seed.ts` 4/3, `seed.ts` 93/80, `schema/agencies.ts` 17/10,
`schema/brand-assignments.ts` 38/28, `schema/brands.ts` 34/25, `schema/enums.ts` 29/17,
`schema/memberships.ts` 32/24, `schema/users.ts` 19/11, `tenancy.ts` 93/52. Stage 1 alone (without
`tenancy.ts`) is 279 raw / 207 strict. Adversary required changes 1-3 all sit in `tenancy.ts` (stage 2)
and are left for the integrator; that fix has 41 strict lines of headroom under the ceiling, otherwise the
planner splits per the reviewer's option (b).

## Round 2 (integrator, stage 2)

Adversary required changes 1-3 share one root cause: the scope handed back Drizzle's mutable builder, so
`$dynamic().where()` replaced the scope's `where` (finding 1) and `onConflictDoUpdate({ set: { brandId } })`
moved a row through the insert's upsert path (finding 3). Fix, all in `tenancy.ts`:

- The builder never leaves `withBrand`. `select` returns `ScopedSelect<Row>` (`orderBy`, `limit`,
  thenable), `insert` / `update` / `softDelete` return `ScopedWrite<Row>` (`returning()`, thenable that
  resolves to nothing). Both are plain objects made by `sealSelect` / `sealWrite`, which hold the builder
  in a closure and delegate. `where`, `$dynamic`, `onConflict*`, joins and set operations exist neither in
  the type nor on the runtime object, so a cast cannot reach them either. The round-1 bullet "the methods
  return Drizzle's own builders" is superseded.
- `select` calls `$dynamic()` internally, after `.where()`, only so that Drizzle's `orderBy` / `limit`
  return the same builder (without it each call returns an `Omit<...>` the seal cannot re-wrap); that
  dynamic builder is what the closure holds and it is never exposed.
- Row types: `ScopedSelect<Row>` is inferred from the builder's own `then`, so
  `await scope.select(brandAssignments)` is still `BrandAssignment[]` and the `expectTypeOf` proof stands.
  For writes `sealWrite<T>` is generic over the table the call site names and asserts once, because
  Drizzle types a plain update's `returning()` through its join-aware result type, a conditional
  TypeScript resolves only for a concrete table (comment on `sealWrite`).
- Finding 2: `scopeOf` parenthesises the caller's filter (``sql`(${where})` ``), so ``sql`1 = 1 or 1 = 1` ``
  renders as `(brand_id = $1 and deleted_at is null and (1 = 1 or 1 = 1))`.
- No upsert on the scope: criterion 5 asks for select / insert / update / softDelete and nothing in the
  repo needs one (stage 1 round 2 removed the seed's). A ticket that needs it adds `onConflictDoUpdate`
  to `ScopedWrite` with a `set` type that omits `brandId` and merges `{ ...set, brandId }` as `update` does.
- Tests (`tenancy.test.ts`): the adversary's three snippets no longer compile, so each is covered by
  `expectTypeOf<ScopedSelect | ScopedWrite>().not.toHaveProperty(...)` for `where`, `$dynamic`, `union`,
  `onConflictDoUpdate`, `onConflictDoNothing`, plus a runtime assertion that the sealed objects carry
  exactly `limit` / `orderBy` / `then` and `returning` / `then`. The legal spellings of the same attacks
  (`where` = `eq(brandAssignments.brandId, B)`; the raw `OR` fragment on select, update and softDelete)
  are asserted to reach only brand A with B's row intact afterwards. `orderBy(desc(...)).limit(1)` and
  `await write` resolving to `undefined` are covered. Checked out of band that the original six attack
  lines fail with TS2339 (scratch file, deleted).
- `packages/db/src/index.ts` also exports `ScopedSelect` and `ScopedWrite`.
- Non-test LOC, counted as in the stage-1 note above (added lines of non-test `packages/db/src/**/*.ts`):
  **426 raw / 288 strict**; per file `tenancy.ts` 146/80, `index.ts` 4/4, every other file as listed
  above. Under the 300 strict ceiling with 12 lines of headroom.
- No `docs/decisions.md` entry (no dependency, no deviation, no D-number named) and no gated criteria
  (D-008): criterion 6 runs on PGlite as written.
- The PGlite boot timeout observed in this round (each `testDb()` boots PGlite and applies the
  migrations, 1-3 s idle, 5-10 s under load, against Vitest's 5000 ms default) was fixed in round 3 by
  raising `testTimeout` in `packages/db/vitest.config.ts`; see "Round 3 (schema, stage 1)" below.

## Round 3 (schema, stage 1)

QA (round 2) ran `pnpm test` three times from the root; two runs failed with `Test timed out in 5000ms`
on the first test of each PGlite file (`seed.test.ts:8`, `schema/tenancy-tables.test.ts:42`,
`tenancy.test.ts:57`), 8.7-9.8 s under load against Vitest's default, with no assertion failing. Both
reviewers required the fix in this ticket because it added the two PGlite files that boot in parallel
with `seed.test.ts`. Change: `packages/db/vitest.config.ts` sets `testTimeout: 30_000` in its `test`
block (one non-test line plus a two-line comment). The timeout lives in the package config, not in the
test files, so every future PGlite test inherits it. `packages/db/vitest.config.ts` is added to "Files
touched" above. Non-test LOC, counted as in the round-2 notes: 429 raw / 289 strict, under the 300
strict ceiling. No `docs/decisions.md` entry (no dependency, no deviation, no D-number named) and no
gated criteria (D-008). Nothing else in stage 1 changed.

## Round 3 (integrator, stage 2)

No stage 2 code changed: the QA failure and both reviewers' required change were the one `testTimeout`
line, applied in stage 1 above. Verified here: with the root `projects` config, Vitest's Node API resolves
`testTimeout` to 30000 for the `@tas/db` project (5000 for `@tas/web` and `@tas/env`, unchanged);
`pnpm test` from the root passed 47/47 three times in a row at load 8.6-11.1, including one run where the
first PGlite test of each file took 6.9-7.0 s, past the old default. Non-test LOC recounted as in round 2:
429 raw / 289 strict. `withBrand`, its tests and the exports are as round 2 left them.
