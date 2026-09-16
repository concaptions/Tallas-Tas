# TICKET-027a · `seedBrand`, readiness read, `testTemplateWorld` and the dev seed

- Owner: schema (`packages/db/src/template/seed.ts`, `readiness.ts`, `testing.ts` (`testTemplateWorld`),
  `packages/db/src/seed.ts`)
- Size: M
- Depends on: TICKET-024b, TICKET-026
- PRD: §3 (adding a client is a short setup, not cloning a base), §5 (per-brand tables seeded from the
  parent template), §14.1, §14.2 (onboarding is a form, not a base clone)
- Design: §2 (I1, I2, I11 seed clause, I12, I13), §3.1 (`brandReadiness`), §3.3 (self-link post-pass,
  join tables), §4.1 (seed), §4.8 (a brand created against an empty template), §8 (fixture
  `testTemplateWorld`; T1, T2, T3, T18 seed clause, T21), §11 (per-table seed transactions rejected)

## Why

A new brand is a row plus a seed run (PRD §3, §14.2). Seed must be all-or-nothing so `seeded_at` is
trustworthy (I13) and idempotent so a retry is harmless (I2). The fixture every later engine test
starts from is built on it, so it lands first.

## Acceptance criteria

1. `seedBrand(db, registry, { runId, actorId = 'system:inngest', auditId? })` reads the run (`trigger IN
   ('seed', 'resync')`, its `target_brand_id`, `audit_id` and the brand's `template_brand_id`), throws
   `NotSeedable` for a template brand, an archived brand or a run of another trigger, and runs one
   `withTemplateScope(reason 'seed', targetBrandId, existingAuditId)` where `existingAuditId` is the
   `auditId` argument, else the run row's `audit_id`, else absent (a bare call outside a claimed run
   opens its own audit row). Inside, one transaction: for every spec in registry order,
   `insertCopiesSql(spec, T, C, actorId, 'all')` (TICKET-024b; `ON CONFLICT (brand_id, template_row_id)
   DO NOTHING RETURNING`), the self-link post-pass for specs that declare one, `spec.recompute` per
   returned row when defined, and as the last statement `UPDATE brands SET seeded_at = now() WHERE id =
   $C AND seeded_at IS NULL`. Local fields are absent from the column list (defaults apply). Returns
   `SeedResult = { tables: Record<name, { parents, inserted, unresolved }>, seededAt }` where
   `unresolved` counts parent rows excluded by a non-nullable link plus rows inserted with a nullable
   link forced to `NULL`. Running it twice inserts nothing the second time. `seedStatements(scope,
   registry, { T, C, actorId })` (the loop without the `seeded_at` update) is exported for
   TICKET-027b's resync.
2. `readiness.ts`: `readBrandReadiness(db, brandId)` reads the brand (`deleted_at IS NULL`, else `null`)
   and its newest `propagation_runs` row with `target_brand_id = brandId AND trigger IN ('seed',
   'resync')` and returns `brandReadiness(brand, run)` from `@tas/domain` (TICKET-022). Both reads are
   keyed by the brand id the caller already resolved through `requireBrandRole`; no cross-brand data is
   returned. This is the one readiness read; TICKET-029b's layout gate calls it.
3. `testing.ts` gains `testTemplateWorld(opts?: { registry?: 'fixture' })`: migrations applied, one
   agency, template brand `T` with three `interface_pages` and five `interface_fields` (two pages hold
   fields), child brands `A` and `B` seeded through `seedBrand` with `seed` runs, actor id
   `'user:test'`. After each `seedBrand` returns, the fixture sets that run row to `status 'succeeded'`,
   `started_at`, `finished_at = now()` and `stats.tables` from the `SeedResult` with a direct UPDATE
   (claim and finish are TICKET-028a's), so no `queued` run exists when the fixture returns. Returns
   `{ db, registry, T, A, B, actor }`. Every test below calls it in one line.
4. `packages/db/src/seed.ts` (`db:seed`) seeds TICKET-005's child brand through a `seed` run and
   `seedBrand`, then marks the run `succeeded` the same way (one direct UPDATE), so `pnpm --filter @tas/db
   db:seed` leaves the child with copies of every template row and no `queued` run.
5. Tests on PGlite:
   - `seed.test.ts`: T1 (A has 3 pages and 5 fields, every `template_row_id` points at a T row of the
     same table, `overridden_fields = []`, `seeded_at` set, `SeedResult.tables` counts; second seed
     inserts nothing and returns `inserted 0`); T2 (`interface_fields.page_id` equals A's page whose
     `template_row_id` is the parent's `page_id`; fixture `parent_item_id` remapped by the post-pass;
     fixture `fx_pairs` rows resolve both sides); T3 (`created_by`/`updated_by` = actor; fixture
     `status` stays `'draft'` when the parent holds `'live'`); T18 seed clause (fixture `theme_ref`
     copied verbatim); I13 (a fixture parent row that violates a fixture CHECK on insert makes the
     whole seed roll back: zero copies, `seeded_at NULL`); I12 (a brand-local row in A is unchanged
     after seed); `NotSeedable` for template, archived and a `changes` run; a run whose `audit_id` is
     set produces no second `engine_audit_log` row (the seed writes under the claim's row), and a run
     without one produces exactly one; T21 seed half (a brand seeded from an empty template: `seeded_at`
     set, zero rows, `tables` all zero).
   - `readiness.test.ts` (T21 readiness half): `readBrandReadiness` for the template brand (`ready`),
     a child with `seeded_at` set (`ready`), a new brand with a `queued` seed run (`seeding`), with a
     `failed` run (`seed_failed`), with `seeded_at` null and no run (`seed_failed`), and `null` for a
     soft-deleted brand id.
   - `testing.test.ts`: `testTemplateWorld()` leaves no `queued` run and two `succeeded` seed runs; A and
     B each hold 3 pages and 5 fields.
6. `packages/db/src/index.ts` exports `seedBrand`, `seedStatements`, `readBrandReadiness`, and
   `testTemplateWorld` (from `@tas/db/testing`). `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/seed.ts`, `packages/db/src/template/readiness.ts`,
`packages/db/src/template/testing.ts`, `packages/db/src/seed.ts`, `packages/db/src/index.ts`, the
`*.test.ts` files next to the code.

## Notes

- No new dependency. Every write runs in the privileged scope with the child brand from the run's
  `target_brand_id`; the only reads of brand-local rows are the natural-key checks (TICKET-027b).
- Run status, `stats` and the audit close are TICKET-028a's `claimRun` / `finishRun`; this ticket's
  function takes a `runId` and returns its result. TICKET-029a wires claim → seed → finish; a claimed
  seed run therefore has exactly one audit row (the claim's), which `seedBrand` writes under.
- Tests change template rows with raw Drizzle updates on purpose: seed reads live parent rows and needs
  no journal (TICKET-025 is not a dependency).
- Estimated size ≈170 LOC excluding tests.
