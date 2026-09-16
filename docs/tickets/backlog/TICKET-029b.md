# TICKET-029b · Inngest serve route, request-path client, seed on brand creation, readiness gate, env

- Owners, in order: backend (stage 1, `apps/web/src/app/api/inngest/**`, `apps/web/src/lib/inngest.ts`,
  `apps/web/src/app/app/(admin)/admin/brands/create-brand-actions.ts`) then frontend (stage 2,
  `apps/web/src/components/workspace/setting-up.tsx`,
  `apps/web/src/app/app/(workspace)/brands/[brandSlug]/layout.tsx`) then integrator (stage 3,
  `packages/env/**`, `.env.example`, `docs/runbook.md`, `docs/decisions.md`)
- Size: M
- Depends on: TICKET-029a, TICKET-027a (`readBrandReadiness`), TICKET-009, TICKET-010, TICKET-012b,
  TICKET-007 (the runbook "Deploy" variable table)
- Decisions: D-023 and D-024 (appended by the planner before TICKET-020 was picked); stage 3 confirms
  both
- PRD: §5 (whenever we make a change in the parent base, it will be replicated), §14.1, §3 (adding a
  client is a short setup: the seed starts when the brand is created), §14.6 (cost ceiling)
- Design: §4.1 (seed trigger and readiness: "Setting up from template"), §4.3 (request-path backstop),
  §5 (serve route, `maxDuration = 300`), §5.1 (`enqueueRun` after commit), §5.4 (`AGENCY_TIMEZONE`),
  §5.5 (cost), A14, I13

## Why

TICKET-029a built the functions; nothing serves them and no request enqueues anything. This ticket
connects the request path to the job: the serve route, the request-scoped client every Server Action
uses, the seed event on brand creation, the readiness gate that keeps a half-seeded brand out of the
workspace, and the environment variables the jobs read.

## Acceptance criteria

1. No request handler or Server Action calls `propagateRun`, `seedBrand`, `resyncBrand`, `resyncPlan` or
   `resyncChunk`. They insert the run row inside their transaction, commit, then call `enqueueRun` and
   return (CLAUDE.md "never call an external API from a request handler"). `grep -rn
   "propagateRun\|seedBrand(\|resyncBrand(\|resyncPlan(\|resyncChunk(" apps/web/src` prints nothing (the
   test-only drain route arrives in TICKET-034).
2. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root.

## Stage 1 (backend) · serve route, request client, `createBrand` wiring

3. `apps/web/src/lib/inngest.ts` exports `inngestForRequest()` = React `cache(() => createInngest({ id:
   'tas', eventKey: env.INNGEST_EVENT_KEY, isDev: env.INNGEST_DEV, baseUrl: env.INNGEST_BASE_URL }))` with
   `env = serverEnv()` (the same pattern as `dbForRequest`, TICKET-008). Every Server Action factory that
   enqueues (this ticket, TICKET-031b, TICKET-032a, TICKET-032c, TICKET-033, TICKET-035, TICKET-036a) is
   built in its `actions.ts` with `{ auth: getAuth(), db: dbForRequest(), inngest: inngestForRequest() }`
   and tested with a fake `inngest`. No module-level client (`grep -rn "^export const inngest\|^const inngest"
   apps/web/src` prints nothing).
4. `apps/web/src/app/api/inngest/route.ts` exports `GET`, `POST`, `PUT` from `serve({ client, functions,
   signingKey: env.INNGEST_SIGNING_KEY })`, `export const maxDuration = 300` and `export const runtime =
   'nodejs'`. `client` is `inngestForRequest()`; `functions` is `createInngestFunctions(client, { getDb: ()
   => createDbFromUrl(serverEnv().DATABASE_URL), registry: templateRegistry })` (TICKET-012a's dispatcher,
   called per function invocation: no module-level database). The route is the only file that constructs
   the Inngest *functions*. It works with no Inngest keys when `INNGEST_DEV` is set (the local dev server
   needs none). Test `route.test.ts`: importing the module with a stubbed env holding only `DATABASE_URL`
   exports `maxDuration === 300` and the three handlers as functions.
5. `createBrandActions({ auth, db, inngest })` (TICKET-009) calls `enqueueRun(inngest, run)` with the
   `run` `persistBrand` returns (TICKET-029a criterion 4) after `db.transaction` resolves and returns
   `{ brandId, slug, runId }`. The action never calls `seedBrand`. Unit test (extends TICKET-009's action
   test, fake `inngest`): after `createBrand` PGlite holds one queued `seed` run targeting the new brand,
   `seeded_at` is null, and the fake `send` was called once with `brand/seed.queued` carrying that
   `runId`; when the transaction throws (`slug_taken`) no run row exists and `send` was not called.

## Stage 2 (frontend) · readiness gate

6. TICKET-010's `apps/web/src/app/app/(workspace)/brands/[brandSlug]/layout.tsx` calls
   `readBrandReadiness(dbForRequest(), brand.id)` (TICKET-027a) after `requireBrandRole` (one line) and,
   unless the result is `'ready'`, renders `apps/web/src/components/workspace/setting-up.tsx` instead of
   `children`: a plain server component with `data-testid="setting-up"` and the text "Setting up from
   template" (`seeding`) or "Template setup failed, ask an admin to resync" (`seed_failed`). The template
   brand is `ready` by `brandReadiness` (TICKET-022 criterion 7), so `/app/brands/template/...` never
   shows the gate. TICKET-036b replaces the placeholder with the designed page. Test
   `setting-up.test.tsx` is not required here (no logic; the component renders two strings); the
   readiness values are TICKET-027a's tests and the gate is asserted by TICKET-036b's E2E.

## Stage 3 (integrator) · env, `.env.example`, runbook, decisions

7. `serverEnv()` gains `AGENCY_TIMEZONE` (string, default `'Asia/Karachi'`, validated by constructing
   `new Intl.DateTimeFormat('en', { timeZone })` inside a zod `refine`; an unknown zone throws naming the
   variable), `INNGEST_DEV` (optional, `'1'` → `true`, routes events to the local dev server) and
   `INNGEST_BASE_URL` (optional url). `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` stay optional
   (TICKET-003). Unit tests: default timezone applies; `AGENCY_TIMEZONE=Not/AZone` throws with the
   variable name; `INNGEST_DEV=1` parses to `true`. Tests inject the env object.
8. `.env.example` lists the three new variables with one-line comments. `docs/runbook.md` "Credentials the
   platform needs" adds `AGENCY_TIMEZONE` (no secret; the human confirms the zone, design §10 q8); the
   TICKET-007 "Deploy" variable table adds `AGENCY_TIMEZONE`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
   (Production and Preview) and `INNGEST_DEV` (never on Vercel); a new section "Running background jobs
   locally" gives `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` in one terminal and
   `INNGEST_DEV=1 DATABASE_URL=pglite://.local/db E2E_AUTH_BYPASS=1 pnpm dev` in another.
9. `docs/decisions.md`: `D-023 · Inngest usage and the inngest SDK` and `D-024 · D-006 amendment: Vercel
   Pro maxDuration and Neon compute` are present (appended by the planner; D-023 completed by
   TICKET-029a). This stage checks that D-024 states both human-confirmed assumptions the design leaves
   open: ≈2.3k step executions a month (design §5.5) against an assumed 50k free Inngest executions
   (design A5, §10 q1), and ≈60 CU-hours a month against an assumed 100 CU-hour Neon free allowance
   (design §5.5, §10 q5), with the sweeper cadence as the first lever if the human's numbers differ, and
   that `maxDuration = 300` on the serve route needs Vercel Pro (D-006, TICKET-007). If either entry is
   missing or lacks a figure, stop and report; do not append.

## Gated criteria (D-008)

- Live send and seed-on-create. Runbook "Pending human verification" line:
  `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest & INNGEST_DEV=1 DATABASE_URL=<neon preview> pnpm dev`,
  then add a brand at `/app/onboarding` and confirm in the Inngest dev UI (http://localhost:8288) that
  `brand/seed.queued` ran `claim`, `seed`, `finish` and the brand's `seeded_at` is set
  (`psql $DATABASE_URL -c "select name, seeded_at from brands order by created_at desc limit 1"`).
- Cron registration in agency hours: gated on `INNGEST_SIGNING_KEY` on a deployed preview; the human checks
  the Inngest dashboard shows `sweep-runs` with `TZ=<AGENCY_TIMEZONE> 0 7-21 * * 1-6`.
- The Inngest concurrency half of mutual exclusion (A12). Runbook line: `DATABASE_URL=<neon preview>
  pnpm --filter @tas/db engine:concurrency` (script from TICKET-037; expected last line
  `engine-concurrency: 4/4 properties held`) covers the database half; the Inngest half additionally
  needs `INNGEST_SIGNING_KEY` on a deployed preview, where the human sends two `template/run.queued`
  events for one template brand within a second (two template saves) and confirms in the Inngest
  dashboard that the two `propagate-run` runs executed one after the other, never overlapping.

## Files touched

Stage 1: `apps/web/src/lib/inngest.ts`, `apps/web/src/app/api/inngest/route.ts` (+ test),
`apps/web/src/app/app/(admin)/admin/brands/{actions,create-brand-actions}.ts` (+ test).
Stage 2: `apps/web/src/components/workspace/setting-up.tsx`,
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/layout.tsx` (gate call only).
Stage 3: `packages/env/src/**` (+ tests), `.env.example`, `docs/runbook.md`, `docs/decisions.md`
(confirmation only).

## Notes

- Stage 1 never edits `packages/*`, the layout or any component. Stage 2 writes only the two frontend
  files. Stage 3 never edits `packages/integrations` or `apps/web`.
- The serve route is the only file that constructs the Inngest *functions*; the client is constructed by
  `inngestForRequest()` wherever a request needs it (one instance per request through `cache`).
- `readBrandReadiness` is TICKET-027a's; this ticket adds no readiness read of its own.
- Estimated size ≈150 LOC excluding tests.
