# TICKET-029a · `createRun`, the `@tas/integrations` package and the Inngest functions

- Owners, in order: schema (stage 1, `packages/db/src/template/run.ts`, `packages/db/src/brand/persist.ts`)
  then backend (stage 2, `packages/integrations/**`, `apps/web/package.json` dependency line)
- Size: M
- Depends on: TICKET-028b, TICKET-027b (`resyncPlan`, `resyncChunk`), TICKET-009 (`persistBrand`),
  TICKET-003
- Decisions: D-023 (Inngest usage; the design's D-013) is appended by the planner before TICKET-020 is
  picked; stage 2 confirms it and records the `inngest` dependency and the new package under it
- PRD: §5 (whenever we make a change in the parent base, it will be replicated), §14.1 (one template,
  propagated), §3 (adding a client is a short setup, not a base clone), §14.6 (cost ceiling)
- Design: §4.1 (seed trigger), §4.4 (step shape), §5 (background jobs), §5.1 (events), §5.2
  (`propagate-run`), §5.3 (`seed-brand`), §5.4 (`sweep-runs`), §5.5 (cost), A5, A6, A13, I14

## Why

Every engine function so far runs only when a test calls it. This ticket is the scheduler's body: the
event schemas, the client factory, the three Inngest functions as thin wrappers over `@tas/db`, and the
seed-run insert at brand creation. Serving them and wiring the request path is TICKET-029b, so each half
stays under the size ceiling.

## Acceptance criteria

1. Unit tests never start Inngest and never need `INNGEST_EVENT_KEY` or `INNGEST_SIGNING_KEY`. Every
   Inngest function body is a wrapper that calls `claimRun`, `applyChildChunk`, `finishRun`, `failRun`,
   `seedBrand`, `resyncPlan`, `resyncChunk`, `findRunsToResend`, `resendRun`, `retryRun` from `@tas/db`
   (the names TICKET-027a/b and TICKET-028a/b export); tests call those functions directly on PGlite
   (design G6). `grep -rln "from 'inngest'\|from \"inngest\"\|require('inngest')" packages/db/src` prints
   nothing (import check; the actor string `'system:inngest'` is allowed).
2. Event payloads and step outputs carry ids, field names and counts only, never row values (A6). The
   test in criterion 6 asserts the exact key set of every event.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root; `pnpm turbo run build --dry` exits 0
   with the new package in the graph.

## Stage 1 (schema) · `createRun` and the seed-run insert

4. `packages/db/src/template/run.ts` gains `createRun(tx, { trigger: 'seed' | 'resync', templateBrandId,
   targetBrandId, actorId })`: inserts one `propagation_runs` row (`status 'queued'`, `attempt 1`,
   `target_brand_id` set, `brand_id` = the template brand) and returns TICKET-025's `RunRef`
   (`{ runId, brandId, trigger, targetBrandId, attempt, resendCount, createdAt, lastEnqueuedAt }`), so
   `enqueueRun` accepts a seed run and a `changes` run through one type. It throws `NotATemplate`
   unless `templateBrandId` is the `is_template` brand and `targetBrandId.template_brand_id =
   templateBrandId`. `persistBrand(tx, plan, actorId)` (`packages/db/src/brand/persist.ts`, TICKET-009)
   gains `createRun(tx, { trigger: 'seed', templateBrandId: plan.brand.templateBrandId, targetBrandId:
   brand.id, actorId })` as its last statement and returns `{ brand, run }`; TICKET-009's tests still
   pass (they ignore `run`), and TICKET-029b makes the action send it.
5. Test `packages/db/src/template/run.test.ts` (extends TICKET-028a's file) and
   `packages/db/src/brand/persist.test.ts` (one case): `createRun` writes one queued row with the target
   set; a second `createRun` for the same brand writes a second row (seed runs are not coalesced;
   `propagation_runs_one_queued` applies to `changes` only); `createRun` with a child brand as
   `templateBrandId` throws `NotATemplate`; `persistBrand` leaves exactly one queued `seed` run targeting
   the new brand with `seeded_at` null, and a failed `persistBrand` (duplicate slug) leaves no run row.
   Setup through `testTemplateWorld()` / `testDb()`.

## Stage 2 (backend) · `packages/integrations/src/inngest/**`

6. Package `@tas/integrations` at `packages/integrations`, mirroring TICKET-014 criterion 1:
   `package.json` (`"type": "module"`, `main`/`exports` → `src/index.ts`, scripts `typecheck` and
   `build`, dependencies `inngest` (major 3, exact major pinned), `@tas/db`, `@tas/domain`, `@tas/env`
   as `workspace:*`, `zod` with the workspace's major), `tsconfig.json` extending the base,
   `vitest.config.ts` discovered by the root runner, `src/index.ts`. `apps/web/package.json` gains
   `"@tas/integrations": "workspace:*"` and `inngest` (the serve adapter TICKET-029b imports from
   `inngest/next`). One serialised `pnpm install` (announce it); `pnpm turbo run build --dry` exits 0.
7. `packages/integrations/src/inngest/events.ts`: zod schemas for `template/run.queued`
   (`{ templateBrandId, runId, attempt, resend }`), `brand/seed.queued` (`{ brandId, templateBrandId,
   runId, attempt, resend, trigger: 'seed' | 'resync' }`) and `template/run.finished` (`{ runId,
   templateBrandId, status, stats }`), each `.strict()`. Pure `eventForRun(run: RunRef, { resend: boolean })`
   maps a run to `{ name, id, data }`: trigger `changes` → `template/run.queued`, `seed` | `resync` →
   `brand/seed.queued` (`brandId = run.targetBrandId`); `id` is `runEventId(run, { resend })`
   (TICKET-028a). Unit test `events.test.ts`: the four `(trigger, resend)` combinations produce the
   documented names and ids; `Object.keys(data)` equals the schema's key list exactly; a payload with an
   extra key fails `.strict()` parsing.
8. `packages/integrations/src/inngest/client.ts`: `createInngest({ id: 'tas', eventKey?, isDev?, baseUrl? })`
   returns a new `Inngest` instance typed with the schemas of criterion 7. No module-level instance:
   `grep -rn "^export const inngest" packages/integrations/src apps/web/src` prints nothing.
9. `packages/integrations/src/inngest/enqueue.ts`: `enqueueRun(inngest, run: RunRef, opts = { resend:
   false })` calls `inngest.send(eventForRun(run, opts))` once and returns the event id. Unit test
   `enqueue.test.ts` with a fake `{ send: vi.fn() }`: one call whose argument deep-equals
   `eventForRun(run, opts)`.
10. `packages/integrations/src/inngest/functions/propagate-run.ts`: `createPropagateRun(inngest, deps)`
    where `deps = { getDb: () => Db, registry, stepBudget?: number }` (default 2000). Configuration is the
    exported pure object `propagateRunConfig = { id: 'propagate-run', concurrency: { key:
    'event.data.templateBrandId', limit: 1 }, retries: 3 }` (§5.2). Steps in order: `step.sleep('coalesce',
    '20s')`; `step.run('claim', ...)` → `claimRun(db, registry, { runId, inngestRunId: ctx.runId })`
    returning `{ skipped: true }` or `{ groups, childIds, attempt, claimGeneration }`; if skipped, return;
    `chunkChildren(childIds, groups.length, stepBudget)` (TICKET-023) gives `n ≥ 1` chunks and each becomes
    `step.run(\`apply:${i}\`, ...)` → `applyChildChunk(db, registry, { runId, inngestRunId, claimGeneration,
    groups, childIds: chunk })`; `step.run('finish', ...)` → `finishRun(db, { runId, claimGeneration })`;
    then `step.sendEvent('finished', { name: 'template/run.finished', id: \`run-finished:${runId}:${attempt}\`,
    data })`. `onFailure` calls `failRun(db, { runId, claimGeneration, error })` (TICKET-028a) under the same
    generation guard. Unit test `propagate-run.test.ts`: `propagateRunConfig` deep-equals the object above;
    `stepPlan(groupCount, childIds, stepBudget)` (pure helper exported from the same file and used by the
    function body to name its steps) returns `['coalesce', 'claim', 'apply:0', 'finish']` for 50 children ×
    1 group, `['coalesce', 'claim', 'apply:0', 'apply:1', 'apply:2', 'finish']` for 50 × 100, and
    `apply:0 … apply:24` for 50 × 800 (TICKET-023's chunk formula is the authority: 25 chunks of 2).
11. `packages/integrations/src/inngest/functions/seed-brand.ts`: `createSeedBrand(inngest, deps)` with
    `seedBrandConfig = { id: 'seed-brand', concurrency: { key: 'event.data.brandId', limit: 1 }, retries: 3 }`.
    Steps: `claim` → `claimRun(db, registry, { runId, inngestRunId: ctx.runId })` (skipped → return);
    for `trigger 'seed'`: `seed` → `seedBrand(db, registry, { runId, auditId })`, then `finish` →
    `finishRun(db, { runId, claimGeneration, seedStats })` (three executions per brand, §5.3); for
    `trigger 'resync'`: `seed` → `resyncPlan(db, registry, { runId, auditId, stepBudget })` returning
    `{ seed, chunks }` (ids and field names only), then `apply:0 … apply:n-1` → `resyncChunk(db, registry,
    { runId, groups: chunks[i], auditId })`, then `finish`. `onFailure` → `failRun`. Test:
    `seedBrandConfig` deep-equals; `seedStepPlan('seed')` is `['claim', 'seed', 'finish']`;
    `seedStepPlan('resync', 3)` is `['claim', 'seed', 'apply:0', 'apply:1', 'apply:2', 'finish']`.
12. `packages/integrations/src/inngest/functions/sweep-runs.ts`: `createSweepRuns(inngest, deps)` with
    `sweepRunsConfig(timezone) = { id: 'sweep-runs', cron: \`TZ=${timezone} 0 7-21 * * 1-6\` }`. One
    `step.run('sweep', ...)` that calls `findRunsToResend(db, now)`, applies the pure `planSweep(runs)`
    (`kind 'resend'` → `{ action: 'resend' }`; `kind 'retry'` → `{ action: 'retry' }`) and executes
    `resendRun` / `retryRun` (TICKET-028a) per run, collecting the rows they return (a `retryRun` that
    returns `null` because `attempt` is already 3 is skipped); then one `step.sendEvent('resend', events)`
    with `eventForRun(row, { resend: action === 'resend' })` per row. Unit tests `sweep-runs.test.ts`:
    `sweepRunsConfig('Asia/Karachi').cron === 'TZ=Asia/Karachi 0 7-21 * * 1-6'`; `planSweep` maps each
    kind and throws on an untagged `succeeded` run; the send batch for a queued run uses the resend id
    and for a failed run the plain id.
13. `packages/integrations/src/inngest/index.ts` exports `createInngestFunctions(inngest, deps)` returning
    the three functions (TICKET-032b appends the retention cron), and `packages/integrations/src/index.ts`
    re-exports `createInngest`, `createInngestFunctions`, `enqueueRun`, `eventForRun` and the event
    types. Test: `createInngestFunctions` with a fake client returns functions whose ids are
    `['propagate-run', 'seed-brand', 'sweep-runs']`.
14. `docs/decisions.md` `D-023 · Inngest usage and the inngest SDK` (appended by the planner; confirm
    present) is completed by this stage with the dependency line: the `inngest` npm package (major 3)
    added to `packages/integrations` and `apps/web`, and the `@tas/integrations` package created with the
    edges `@tas/integrations → @tas/db, @tas/domain, @tas/env` and `@tas/web → @tas/integrations`. If the
    entry is missing, stop and report.

## Gated criteria (D-008)

none (nothing here is served or sent; TICKET-029b carries the live checks).

## Files touched

Stage 1: `packages/db/src/template/run.ts` (+ test), `packages/db/src/brand/persist.ts` (+ test),
`packages/db/src/index.ts`.
Stage 2: `packages/integrations/{package.json,tsconfig.json,vitest.config.ts}`,
`packages/integrations/src/index.ts`, `packages/integrations/src/inngest/client.ts`,
`packages/integrations/src/inngest/events.ts` (+ test), `packages/integrations/src/inngest/enqueue.ts`
(+ test), `packages/integrations/src/inngest/functions/{propagate-run,seed-brand,sweep-runs}.ts`
(+ tests), `packages/integrations/src/inngest/index.ts` (+ test), `apps/web/package.json`,
`pnpm-lock.yaml`, `docs/decisions.md` (D-023 dependency line).

## Notes

- Stage 1 writes only the two `packages/db` files and their tests. Stage 2 never edits `packages/db`,
  `packages/env` or any `apps/web` source file; its one `apps/web` edit is the `package.json` dependency
  line.
- The 20-second `coalesce` sleep is an optimisation (A13). No test depends on it; correctness is the
  database claim (TICKET-028a) and the attempt-suffixed event ids.
- `propagate-run` uses no Inngest `idempotency`, `debounce` or `batchEvents` (design §11).
- `createInngest` is a factory; the request-scoped instance (`inngestForRequest`) and the serve route are
  TICKET-029b. The ESLint fence of TICKET-024b already restricts `@tas/db/template/scope` to
  `packages/db/src/template/**` and `packages/integrations/src/inngest/**`; the functions here import
  ops-level functions, not the scope.
- The `template/run.finished` event has no consumer until Phase 5; it exists so notifications subscribe
  without touching the engine.
- Estimated size ≈250 LOC excluding tests (the package skeleton is ≈30).
