# TICKET-020 · Template registry, `brands` additions and `templatedColumns`

- Owners, in order: schema (stage 1, `packages/db/**`) then integrator (stage 2, `.github/workflows/**`,
  root `eslint.config.js`)
- Size: M
- Depends on: TICKET-022 (stage 1), TICKET-006 (stage 2: the CI workflow it created)
- Decisions: D-021 to D-025 (the design's §12 entries) are appended by the planner before this ticket is
  picked; stage 2 cites D-022
- PRD: §5 (every table per-brand, seeded from the parent), §5.5 (themes are a global library), §14.1
  (one template propagated), §14.4 (global theme library)
- Design: §2 (I1, I2 structural half; I10 CHECK), §3.1 (`brands` additions), §3.2 (`templatedColumns`,
  `templatedConstraints`, semantics of `template_row_id`), §3.3 (`TemplatedTableSpec`,
  `createTemplateRegistry`, self-links and join tables, `registryCompleteness`), §3.10 (`themes`), §7
  (themes never registered), §8 (fixture registry; T18 first two clauses, T22, T26), §12 (package
  direction: CI cycle check)

## Why

The engine knows tables only through a registry entry (G5). This ticket ships the column helper every
templated table uses, the constraint that makes every seed and propagation idempotent (one copy per
parent row, tombstones included), the validated frozen registry, and the completeness test that fails
CI when a Phase 3 ticket adds a column without classifying it.

## Stage 1 (schema) · `packages/db`

1. `brands` gains `seeded_at timestamptz` (nullable; the template brand never receives a seed run and
   keeps it `NULL`, which `brandReadiness` treats as `ready` for `is_template` rows, TICKET-022
   criterion 7), CHECK `brands_template_xor`
   (`is_template <> (template_brand_id IS NOT NULL)`), partial unique index
   `brands_one_template_per_agency` on `agency_id WHERE is_template AND deleted_at IS NULL`, and index
   `brands_template_brand_idx` on `template_brand_id`. Migration generated with `drizzle-kit generate`;
   TICKET-005's seed still applies unchanged.
2. `packages/db/src/template/columns.ts` exports `templatedColumns` (baseColumns with `brand_id` NOT NULL
   FK to `brands.id`, `template_row_id uuid` nullable, `overridden_fields jsonb` NOT NULL default `'[]'`
   typed `string[]`), `templatedConstraints(name, t)` returning the self FK `<name>_template_row_fk`, the
   **full** (not partial) unique index `<name>_brand_template_row_uq` on `(brand_id, template_row_id)`,
   `<name>_brand_deleted_idx`, `<name>_template_row_idx` and the CHECK `<name>_overridden_is_array`
   (`jsonb_typeof(overridden_fields) = 'array'`), and the type `TemplatedTable` (a pgTable that has these
   three columns).
3. `packages/db/src/schema/themes.ts`: the §3.10 table (`baseColumns`, `name text not null`,
   `reference_links jsonb`, `notes text`, `attachments jsonb`) with CHECK `themes_global`
   (`brand_id IS NULL`). No templated columns. In the same migration as criterion 1.
4. `packages/db/src/template/enums.ts` builds, from the `@tas/domain` arrays, the `pgEnum`s
   `template_change_kind`, `template_change_source`, `propagation_trigger`, `propagation_run_status`,
   `propagation_child_status`, `propagation_outcome`, `engine_reason` and `promotion_status`. They are
   exported from the schema index so drizzle-kit emits the `CREATE TYPE` statements in this migration;
   the tables using them arrive in TICKET-021 and TICKET-030.
5. `packages/db/src/template/registry.ts` exports `TemplatedTableSpec<T>` (`TemplatedFieldSpec` from
   domain plus `table: T` and optional `recompute`), `TemplateRegistry`
   (`{ specs, byName }`, `byName` throws `UnknownTable { name }`) and `createTemplateRegistry(specs)`,
   which validates at construction and throws `RegistryError { spec, rule }` when: a
   `propagatedFields`, `localFields`, `links[].field` or `naturalKey` entry is not a column key of
   `spec.table`; `propagatedFields ∩ localFields ≠ ∅`; `naturalKey ⊄ propagatedFields`;
   `links[].field ⊄ propagatedFields`; `links[].to` is neither `'themes'`, the name of an earlier spec
   nor the spec's own name; a self-link is not `nullable`; two specs share a name; or `spec.table`
   lacks `templateRowId` or `overriddenFields` (this is what rejects `themes`). The returned registry
   and its `specs` array are frozen (`Object.isFrozen`). It also exports
   `templateRegistry = createTemplateRegistry([])`, filled by TICKET-026.
6. `packages/db/src/template/testing.ts` exports `registryCompleteness(db, registry)`: for each spec it
   reads `information_schema.columns` for the table, maps SQL column names to Drizzle keys through the
   table's column config, and rejects (`Error` listing `<table>.<column>` pairs) any column that is
   neither a system column nor in `propagatedFields` or `localFields`. The same file exports
   `fixtureRegistry(db)`, which creates (hand-written `CREATE TABLE IF NOT EXISTS` through `db.execute`,
   mirroring `templatedConstraints`) and registers the test-only tables `fx_items` (templated +
   `name text`, `theme_ref uuid` nullable link `to: 'themes'`, `parent_item_id uuid` nullable
   self-link, local `status text default 'draft'`; `naturalKey ['name']`), `fx_links` (templated +
   `item_id uuid` NOT NULL link to `fx_items`, `label text`) and `fx_pairs` (templated + `left_id`,
   `right_id` NOT NULL links to `fx_items`). Fixture tables never enter `packages/db/drizzle/`.
7. Tests on PGlite through `testDb()`:
   - `registry.test.ts` (T22 registry half): the fixture registry is accepted; one rejecting case per
     rule of criterion 5 (unknown field, propagated ∩ local, natural key outside propagated, link
     outside propagated, `to` naming a later spec, non-nullable self-link, duplicate name, a spec for
     `themes` (T18 clause 2)); `byName('nope')` throws; `registry.specs.push` throws (frozen).
   - `registry-completeness.test.ts` (T22 completeness half): passes on the fixture registry; after
     `ALTER TABLE fx_items ADD COLUMN stray text` it fails naming `fx_items.stray`.
   - `brands-constraints.test.ts` (T26): a brand with `is_template = true` and a `template_brand_id`
     fails the CHECK; a brand with `is_template = false` and no `template_brand_id` fails the CHECK; a
     second template in the same agency fails the partial unique index; a template in a second agency
     succeeds; soft-deleting the first template lets a new one be created.
   - `themes.test.ts` (T18 clause 1): inserting a theme with a `brand_id` fails `themes_global`.
   - `templated-columns.test.ts` (I2): on `fx_items`, a second row with the same
     `(brand_id, template_row_id)` fails the unique index even when the first is soft-deleted; two
     brand-local rows (`template_row_id NULL`) in one brand coexist; `overridden_fields = '"x"'` fails
     the CHECK; the FK rejects a `template_row_id` that is not an `fx_items.id`.
8. `packages/db/src/index.ts` exports `templatedColumns`, `templatedConstraints`,
   `createTemplateRegistry`, `templateRegistry`, the enums and `themes`.

## Stage 2 (integrator) · package-graph check

9. `.github/workflows/ci.yml` (TICKET-006) already runs `pnpm turbo run build --dry` as a named step
   before typecheck. This stage keeps that step, gives it the name `Package graph` if it has another,
   and adds a YAML comment citing D-022 (package direction; appended by the planner before this ticket
   was picked, confirm it is present). `pnpm ci:validate` (TICKET-006) exits 0.
10. Root `eslint.config.js`: `no-restricted-imports` for `packages/domain/**` forbidding `@tas/db`,
    `@tas/integrations`, `@tas/web`, `@tas/env` and `drizzle-orm` (message: "domain never imports db,
    design §3.3").
11. Verified locally and pasted in the report: `pnpm turbo run build --dry` exits 0; with
    `"@tas/db": "workspace:*"` temporarily added to `packages/domain/package.json` the same command
    exits non-zero and its output contains `cyclic` (change reverted); a scratch
    `packages/domain/src/x.ts` importing `@tas/db` makes `pnpm lint` fail with
    `no-restricted-imports` (file removed).

## Gated criteria (D-008)

- The `Package graph` step passing on GitHub Actions: gated on a GitHub remote for this repository.
  Runbook command: `git push -u origin HEAD && gh run watch --exit-status`.

## Files touched

Stage 1: `packages/db/src/schema/brands.ts`, `packages/db/src/schema/themes.ts`,
`packages/db/src/schema/index.ts`, `packages/db/src/template/columns.ts`,
`packages/db/src/template/enums.ts`, `packages/db/src/template/registry.ts`,
`packages/db/src/template/testing.ts`, `packages/db/drizzle/*`, `packages/db/src/index.ts`, the
`*.test.ts` files next to them.
Stage 2: `.github/workflows/ci.yml`, `eslint.config.js`.

## Notes

- No new dependency. `drizzle-orm`, `drizzle-kit` and `@electric-sql/pglite` come from TICKET-003.
- Every query in this ticket is a constraint test on PGlite; no production query is added.
- `testing.ts` is production-shipped test support and counts toward the 300 LOC budget; keep the
  fixture tables to the columns listed.
- Estimated size ≈190 LOC excluding tests.
