# TICKET-037 · Runbook, two-connection concurrency script, load-test project, Phase 3 checklist, decisions confirmed

- Owners, in order: planner (stage 1, `docs/runbook.md`, `docs/decisions.md`, `docs/tickets/backlog.md`,
  `docs/tickets/phase-3-checklist.md`) then schema (stage 2a, `packages/db/src/template/concurrency-check.ts`
  and test, `packages/db/package.json` `engine:concurrency` script line) then integrator (stage 2b,
  `packages/db/vitest.config.ts`, `packages/db/vitest.load.config.ts`, `packages/db/package.json`
  `test:load` script line, `turbo.json`, `.github/workflows/nightly-load.yml`, root `package.json`
  `ci:validate`) then qa (stage 3, runs every command and records the output in the ticket report and the
  runbook "Load baseline" lines)
- Size: S
- Depends on: TICKET-029b, TICKET-032b, TICKET-032c, TICKET-036b, TICKET-006
- Decisions: D-021 to D-025 were appended by the planner before TICKET-020; stage 1 confirms them and
  appends D-027
- PRD: §14.1 (one template, propagated), §14.6 (cost), §16 (delivery cadence: what the human must
  verify before clients migrate)
- Design: §4.3, §4.4, §4.5 (the two-connection properties), §4.6 (runbook section), §5.5 (cost), §8
  (`vitest.load.config.ts`, T25L, the T-test table), §9 (Phase 3 ticket shape), §10 (open questions),
  §12 (decisions), G6, A7, A12

## Why

Phase 2 leaves a short list of properties PGlite cannot prove and a load baseline that must run nightly,
not per commit. This ticket writes them down as commands a human can run, wires the nightly project, and
closes the decisions the design deferred.

## Acceptance criteria

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root and `pnpm test` still excludes the load
   project (`pnpm test -- --project db --reporter=verbose 2>&1 | grep -c "load.test"` prints `0`;
   `pnpm --filter @tas/db test:load --run --reporter=verbose` lists exactly the T25L cases).
2. Every command written into the runbook was executed by stage 3 where the machine allows it (PGlite,
   local Playwright) and its output pasted into the ticket report; commands that need credentials are
   under "Pending human verification" with the credential named.

## Stage 1 (planner) · docs

3. `docs/runbook.md` "Rolling a schema change out to every brand" holds the six numbered steps of design
   §4.6 with exact commands (TICKET-032c drafted it; this stage completes and proofreads it, adding the
   "removing a column" and "renaming a field key" steps with the `renameFieldKey` usage from TICKET-021).
4. `docs/runbook.md` gains "Engine concurrency check (two connections)": what the script in criterion 9
   verifies (queued-run row lock of §4.3; `FOR UPDATE` serialisation of a child edit against propagation
   and of promotion approval against a child edit, §4.4 and §4.5; claim takeover with `claim_generation`,
   A12 and I14), the command `DATABASE_URL=<neon preview> pnpm --filter @tas/db engine:concurrency`, and
   the expected last line `engine-concurrency: 4/4 properties held`.
5. `docs/runbook.md` "Pending human verification" lists, one line each with the exact command, every
   gated criterion of TICKET-029b through TICKET-036b plus the concurrency check and the nightly load run
   (`gh workflow run nightly-load.yml` and where to read the wall time). Lines are grouped by credential
   (`DATABASE_URL` Neon preview, Clerk keys, Inngest keys, CI account).
6. `docs/tickets/phase-3-checklist.md`: the checklist a Phase 3 table ticket must satisfy (design §9
   last paragraph): one registry spec with `propagatedFields`, `localFields`, `links`, `naturalKey`,
   `recompute` decided per column (design §10 q4 defaults for Angles), `templatedConstraints`, one
   `fieldKeyTargets` entry, one propagation test, `registryCompleteness` green, field classes reviewed
   against PRD §11 (client-invisible fields are local, never propagated). It also holds the design §8
   test map: one row per T1 … T30, T25L and the Domain row naming the ticket (or tickets, with the clause
   each delivers) that shipped it, so QA can tick every design row; the split rows are T16 (030 / 031a),
   T17 (024a / 026 / 031a), T18 (020 / 027a / 028b), T20 (027b / 028b), T21 (022 / 027a), T22 (020 /
   026), T23 (021 / 026 / 030), T24 (025 / 028a), T26 (020 / 022), T27 (026 / 032c), T29 (027b / 028b).
   `docs/tickets/backlog.md` Phase 3 paragraph links to it and gains one line: "Brand status action
   (`active` ↔ `paused` ↔ `archived`, admin); `archived → active` calls `requestResync` (design A7)".
7. `docs/decisions.md`: confirm the design §12 entries exist under the numbers this plan uses (D-020
   local PGlite full stack from TICKET-012b; D-021 engine ledgers, D-022 package direction, D-023 Inngest
   usage, D-024 D-006 amendment, D-025 concurrency properties, all appended by the planner before
   TICKET-020 and completed by TICKET-029a/b) and append `D-027 · Answers to the engine design's open
   questions and names beyond the design` (next free number if taken; update this header): (a) the
   human's answers to design §10 questions 1, 2, 3, 5, 7 and 8 (Inngest quota, template editors, paused
   brands, Neon CU-hours and Vercel `maxDuration`, coalescing window, agency timezone) or, for each still
   unanswered, the default the code ships with and the one-line change that flips it; (b) the names and
   additions the tickets introduced that the design does not have, so the document and the code stay
   reconcilable: `previewPromotion` / `previewPromotionAction` (031a), the interface host page and
   `listInterfacePagesAction` (033), `/api/test/engine` (034), `createRun` and `RunRef` (025, 029a),
   `INNGEST_DEV` / `INNGEST_BASE_URL` (029b), `existingAuditId` / `closeAudit` (024a), the domain-side
   `no-restricted-imports` fence (020), `packages/db/scripts/resync-field.ts` and the `/app/admin/fields`
   actions (032c), `runDetail`, `resendStaleRunsAction` and `batchIds` (036a), `resyncPlan` /
   `resyncChunk` (027b), `shouldResend` / `canRetry` in domain (023), `requestResync` / `listConflicts` /
   `countConflicts` as the names for the design's `resyncBrand` action and "conflicts query" (032a),
   `seedTable` dropped in favour of `insertCopiesSql` (024a), and `writeChild` rejecting `brandId`
   instead of ignoring it (024a).

## Stage 2a (schema) · concurrency script

8. `packages/db/src/template/concurrency-check.ts` (script `engine:concurrency` in
   `packages/db/package.json`, run with the same runner as `db:migrate`): opens two
   `createNeonDb(DATABASE_URL)` clients against the same database and verifies, each as a named property
   with pass/fail output: (1) with connection 1 holding an open `updateTemplated` transaction on the
   template, connection 2's `claimRun` blocks until commit and then sees the change in the run; (2) with
   connection 1 holding a child copy `FOR UPDATE` inside `applyChildChunk`, connection 2's child
   `updateTemplated` waits and afterwards its override union is computed on the propagated value; (3)
   with connection 1 inside `approvePromotion` after the parent lock, connection 2's child edit waits and
   its override survives the approval; (4) a run claimed by instance X, taken over by instance Y
   (`claimRun` with `started_at` forced 31 minutes back), makes X's `assertClaim` throw `lost claim` and
   X's `finishRun` update zero rows. It creates its own throwaway agency, template and one child, and
   soft-deletes them at the end. Exit code 1 on any failure. Refuses to run unless `DATABASE_URL` starts
   with `postgres` (never on `pglite://`). Last line on success: `engine-concurrency: 4/4 properties held`.
9. Unit test `concurrency-check.test.ts`: the script's `main` with a `pglite://` URL exits with the
   refusal message before opening a connection; the property list has four entries with the names of
   criterion 8 (the properties themselves are not run on PGlite). The script is excluded from both Vitest
   projects' `include` globs (it is not a test).

## Stage 2b (integrator) · load project, nightly CI

10. `packages/db/vitest.load.config.ts` with `include: ['src/**/*.load.test.ts']` and a 20-minute
    timeout; `packages/db/package.json` gains `test:load`; the default `packages/db/vitest.config.ts`
    excludes `*.load.test.ts`; T25L lives in `packages/db/src/template/propagate.load.test.ts` (created
    from TICKET-028b's T25 sibling scaled to 50 × 100 × 8 with the 800-row import chunked into 25 apply
    steps per TICKET-023's formula and the statement count asserted) and prints wall time per phase with
    `console.info`.
11. `turbo.json` adds `test:load` as an uncached task not included in `test`;
    `.github/workflows/nightly-load.yml` (beside TICKET-006's `ci.yml`, same setup steps) runs
    `pnpm --filter @tas/db test:load --run` on a nightly cron (`0 2 * * *` UTC) and on
    `workflow_dispatch`, uploads the Vitest output as an artifact. `pnpm ci:validate` is extended to both
    workflow files and exits 0.

## Stage 3 (qa) · run and record

12. Runs `pnpm typecheck && pnpm lint && pnpm test`, `pnpm --filter @tas/db test:load --run` (once,
    locally on PGlite; records the wall time of each phase in the ticket report and in the runbook under
    "Load baseline"), `pnpm test:e2e` (all Phase 2 specs, on the PGlite database and test sign-in the
    Playwright config provides), and `DATABASE_URL=pglite://x pnpm --filter @tas/db engine:concurrency`
    (expects the refusal). Pastes exact outputs. Anything that needs a credential is confirmed to be
    present under "Pending human verification" with the right command and is not run.

## Gated criteria (D-008)

- `DATABASE_URL=<neon preview> pnpm --filter @tas/db engine:concurrency` → `engine-concurrency: 4/4
  properties held` (Neon preview branch).
- Nightly load run on the CI account: `gh workflow run nightly-load.yml` then `gh run watch`; the
  artifact reports the 50 × 100 × 8 seed, the single-edit propagation, the 100-row import and the 800-row
  import wall times, each under five minutes.

## Files touched

`docs/runbook.md`, `docs/decisions.md`, `docs/tickets/backlog.md`, `docs/tickets/phase-3-checklist.md`,
`packages/db/src/template/concurrency-check.ts` (+ test), `packages/db/src/template/propagate.load.test.ts`,
`packages/db/vitest.config.ts`, `packages/db/vitest.load.config.ts`, `packages/db/package.json`,
`turbo.json`, `.github/workflows/nightly-load.yml`, root `package.json` (`ci:validate` glob only).

## Notes

- Stage 1 writes only under `docs/`. Stage 2a writes only the script, its test and one `package.json`
  script line. Stage 2b never edits `docs/` except to paste the script's expected output line into the
  runbook section stage 1 wrote, and never edits `packages/db/src/**`. Stage 3 writes only the "Load
  baseline" numbers and the ticket report.
- No new dependency: the script uses the runner `db:migrate` already uses (TICKET-003), the same rule as
  TICKET-032c's `resync-field` script.
- The concurrency script is the only code allowed to run engine functions against Neon outside the
  Inngest route, `db:migrate` and `resync-field`; it is not a test and is excluded from both Vitest
  projects.
