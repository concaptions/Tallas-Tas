# TICKET-007 · Vercel deploy skeleton

- Owner: integrator
- Size: S
- Depends on: TICKET-002 (the app that builds), TICKET-003 (the variable list), TICKET-006 (CI is the gate
  before a preview is trusted)
- PRD: §14.6 (cost: Vercel Pro, one seat, is the largest line of D-006), §16 (delivery cadence: the human
  reviews a preview URL every ~3 days), §17 q5 (hosting question; Vercel kept per the brief, D-006).
  Config and docs only; no product behaviour.
- Design: template-engine.md A14 and §12 (the Inngest route will need `maxDuration = 300` on Vercel Pro;
  this ticket records the plan tier the settings assume)

## Why

Every later ticket that crosses a page boundary needs a preview URL the human can open. The settings that
make a pnpm + Turborepo monorepo build on Vercel are not obvious (root directory, install command, ignored
builds) and must be written down once, in the repo, so the human can create the project in minutes and no
agent guesses them later.

## Acceptance criteria

1. `apps/web/vercel.json` exists and is valid JSON with exactly these keys: `"$schema":
   "https://openapi.vercel.sh/vercel.json"`, `"framework": "nextjs"`, `"installCommand": "pnpm install
   --frozen-lockfile"`, `"buildCommand": "pnpm turbo run build --filter=@tas/web"`, `"ignoreCommand":
   "npx turbo-ignore @tas/web"`, `"regions": ["fra1"]` (one region; closest to the agency, cheapest), and
   `"crons": []` (empty, so Phase 2's Inngest cron does not need a new key). No `env` key: variables live in
   the Vercel project, never in the file. `node -e "JSON.parse(require('fs').readFileSync('apps/web/vercel.json','utf8'))"`
   exits 0.
2. `pnpm turbo run build --filter=@tas/web` exits 0 from the repo root with `.env.local` absent (the build
   command must not need secrets; `serverEnv()` is lazy per TICKET-003). If TICKET-004's `ClerkProvider`
   makes the build fail without a publishable key, the build command is unchanged and the failure is
   listed under the gated criterion below with the variable that fixes it.
3. `npx turbo-ignore @tas/web` runs locally and exits with 0 or 1 (both are valid answers; the point is
   that the binary ships with the already installed `turbo` and needs no new dependency). Paste the
   output.
4. `docs/runbook.md` gets a section "Deploy" with, in this order: (a) Vercel project settings as a table:
   Framework `Next.js`, Root Directory `apps/web`, "Include source files outside of the Root Directory"
   enabled, Node.js version `24.x`, Production branch `main`, plan `Pro` (one developer seat, D-006);
   (b) the environment variable table: every variable of `.env.example` with the Vercel environments it
   is set in (`Production`, `Preview`, `Development`) and who provides it, plus the variables Vercel sets
   itself (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`) marked "automatic" (TICKET-012b adds the
   `E2E_AUTH_BYPASS` row with the value "never set on Vercel"; this ticket does not pre-empt it); (c)
   "Preview per pull request": the Vercel GitHub app comments the preview URL on every PR; `DATABASE_URL`
   for previews points at a Neon branch created per PR by the Neon Vercel integration, or at one shared
   `preview` branch until that integration is enabled; (d) "Turborepo remote cache (optional)":
   `TURBO_TOKEN` and `TURBO_TEAM` as Vercel and GitHub Actions variables, explicitly optional, with the
   note that the free Vercel remote cache is enough at this size; (e) "Rollback": Vercel dashboard
   "Instant Rollback" to the previous production deployment; (f) the gated verification lines.
5. `.env.example` is unchanged by this ticket unless a variable named in the runbook table is missing
   from it, in which case it is added with a one-line comment.
6. `docs/decisions.md` gets `D-016 · Vercel project settings` (next free number if taken; update this
   header) recording: root directory `apps/web` with the workspace built through `pnpm turbo run build
   --filter=@tas/web` (not `next build` directly, so `@tas/env`, `@tas/db` and `@tas/domain` build first
   through the pipeline), `turbo-ignore` to skip unaffected builds (saves Pro build minutes), one region,
   and that no dependency was added.
7. `pnpm typecheck && pnpm lint && pnpm test` stay green (the JSON file is outside every tsconfig and
   lint glob; if Prettier reformats it, keep the formatted version).

## Gated criteria (D-008)

- Project creation, first production deploy and first preview: gated on a Vercel account (human, Pro
  plan). Runbook lines, run from the repo root once logged in with `pnpm dlx vercel login`:
  `pnpm dlx vercel link --cwd apps/web` (choose the new project, confirm the settings of criterion 4a),
  `pnpm dlx vercel env pull apps/web/.env.local --environment=development` (proves the variable table),
  `pnpm dlx vercel deploy --cwd apps/web` (preview) and `pnpm dlx vercel deploy --cwd apps/web --prod`.
  Then open a pull request and confirm the Vercel bot comments a preview URL that renders "TAS Creative
  Platform" at `/`.
- If criterion 2 failed locally for a missing Clerk publishable key, the production build on Vercel is
  verified after the human sets `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` on the project.

## Files touched

`apps/web/vercel.json`, `docs/runbook.md`, `docs/decisions.md`, `.env.example` (only per criterion 5).

## Notes

- No code in this ticket. Do not add `vercel` as a dependency; the CLI runs through `pnpm dlx` and only
  the human runs it.
- `regions` is a hint, not a lock-in; change it in one place if the agency's timezone decision (design
  §10 q8) moves the team.
- The Inngest serve route (TICKET-029b) will export `maxDuration = 300`; that is a route-level export, not
  a `vercel.json` `functions` entry. TICKET-032c appends the `db:migrate` deploy hook to `buildCommand`;
  that is the only Phase 2 edit to this file.
- Keep the runbook table the single source for "which variable goes where"; TICKET-012b adds
  `E2E_AUTH_BYPASS`, TICKET-029b adds `AGENCY_TIMEZONE` and `INNGEST_*`.
- Note (2026-09-16): `apps/web/vercel.json` and the runbook "Deploy" section already exist (decision entry "Fast-path Vercel deploy configuration"). Extend them; do not recreate them.
