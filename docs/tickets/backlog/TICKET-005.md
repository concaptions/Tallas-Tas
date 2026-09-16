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
`packages/db/src/index.ts`.

## Notes

- `agencies`, `brands`, `users`, `memberships` carry the shared `brand_id` column as nullable and unused,
  per the "no exceptions" column rule; only `brand_assignments` is branded and NOT NULL.
- `withBrand` is the first line of defence; route helpers come in a Phase 1 ticket.
