# TICKET-003 · Env loader package and Neon + Drizzle wiring in packages/db

- Owners, in order: integrator (stage 1, `packages/env`) then schema (stage 2, `packages/db`)
- Size: M
- Depends on: TICKET-001
- PRD: §14.6 (cost: Neon free tier), §5 (every table is per-brand unless global; sets the column
  conventions used from here on)

## Why

Proves the database loop end to end: schema → migration → seed → test, with the environment validated
once and the driver injected, so no later ticket invents its own wiring.

## Stage 1 (integrator) · `packages/env`

1. Package `@tas/env` exporting `serverEnv()` and `clientEnv()` built with zod. Required now:
   `DATABASE_URL` (url). Optional now, validated when present: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`, `SLACK_BOT_TOKEN`, `RESEND_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`,
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `ANTHROPIC_API_KEY`,
   `AIRTABLE_PAT`. `NODE_ENV` defaults to `development`.
2. Validation is lazy (called, not at import) and memoised per call site through an explicit factory, no
   module-level singleton. A missing required variable throws an error naming the variable.
3. `.env.local` is loaded only in development through `dotenv` from the repo root; production reads the
   process environment.
4. Unit tests: valid env parses; missing `DATABASE_URL` throws with the variable name; malformed url
   throws. Tests inject the env object, they never mutate `process.env`.

## Stage 2 (schema) · `packages/db`

5. Package `@tas/db` with Drizzle ORM and drizzle-kit. `src/columns.ts` exports the shared column helper
   giving every table `id` (uuid, defaultRandom), `brand_id` (uuid, nullable, FK added in TICKET-005),
   `created_at`, `updated_at` (timestamptz, default now), `created_by`, `updated_by` (text, nullable
   until users exist), `deleted_at` (timestamptz, nullable).
6. Table `health_check` (uses the helper, plus `note text not null`). Migration generated with
   `drizzle-kit generate` into `packages/db/drizzle/`.
7. `createDb(client)` factory returning a Drizzle instance; two adapters: `createNeonDb(databaseUrl)`
   for production (driver must support transactions; record the choice in `docs/decisions.md`) and
   `createPgliteDb()` for tests. No module-level database instance anywhere.
8. Scripts: `pnpm --filter @tas/db db:generate`, `db:migrate` (applies `drizzle/` to `DATABASE_URL` from
   `@tas/env`), `db:seed` (inserts one `health_check` row).
9. Vitest test on PGlite: apply the migrations, run the seed function, read the row back. Under three
   lines of setup through a shared `testDb()` helper in `packages/db/src/testing.ts`.
10. `docs/runbook.md` "Migrations" section filled in; "Pending human verification" gets:
    `DATABASE_URL=<neon preview> pnpm --filter @tas/db db:migrate && pnpm --filter @tas/db db:seed`.
11. `docs/decisions.md` D-011 lists dependencies added and the production driver choice.

## Gated criteria (D-008)

- Migration run against a Neon preview branch: gated on `DATABASE_URL`. Verified on PGlite instead.

## Files touched

`packages/env/**`, `packages/db/**`, `docs/runbook.md`, `docs/decisions.md`, root `.env.example` (add any
variable not already listed).

## Notes

- Stage 2 must not touch `packages/env` beyond importing it.
- Keep the schema agent inside `packages/db`; the type re-export for consumers is `@tas/db`'s own index.
