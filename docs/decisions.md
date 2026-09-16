# Architectural decisions

Append-only. Newest at the bottom. Format: ID, date, decision, why, consequences.

## D-001 · 2026-09-16 · PRD source and conversion

The PRD is `C_PRD___TAS_Creative_Platform_v1.docx` (Talal Abulshamat, TAS Digital, 10 September 2026),
found on the dev machine and stored as `docs/prd-assets/PRD-v1-original.docx`. `docs/PRD.md` is a
formatting-only conversion (headings, lists, tables, hyperlinks, two images). The author's section numbers
are kept and are what tickets cite. The Airtable bases the PRD references ("TAS Digital Creative Hub
Template version 5.1", "Niagara Sleep Solutions") are not reachable from this machine's Airtable
connection, which only exposes an unrelated base. Migration work (Phase 6) needs access granted.

## D-002 · 2026-09-16 · Ticket files

`docs/tickets/backlog.md` is the ordered index. Ticket bodies are one file each under
`docs/tickets/backlog/`, moved with `git mv` to `in-progress/` and then `done/`. A ticket names its
owning role(s); a two-role ticket lists build stages that run in order.

## D-003 · 2026-09-16 · Clerk tenancy model

One Clerk Organization represents the agency (TAS Digital). Brands are rows in our database, never Clerk
orgs. Internal team members are org members; their real permissions come from `memberships` (agency role)
and `brand_assignments` (per-brand role). Clients are ordinary Clerk users with no org membership; their
access is resolved solely from `brand_assignments` rows with role `client`. Why: keeps the whole
authorization model in our schema (tenancy at the query layer), keeps Clerk usage inside the free tier
(one organisation), and avoids exposing Clerk's org UI to clients. Revisit only if a client needs
org-level Clerk features.

## D-004 · 2026-09-16 · `packages/env` added to the layout

The brief lists db, domain, integrations and ui packages and requires one zod-validated environment
loader with no `process.env` access elsewhere. db, integrations and web all need it, so it becomes its
own package `@tas/env` rather than living inside one consumer. Lint rule `no-restricted-properties`
blocks `process.env` outside it.

## D-005 · 2026-09-16 · PGlite for database tests, driver factory for production

No Postgres or Docker exists on the development machine. Unit tests for `@tas/db` run on
`@electric-sql/pglite` through `drizzle-orm/pglite`, applying the real generated migrations. Production
code receives its client through `createDb(...)`, so the same schema and queries run against Neon. The
production driver must support transactions (propagation and promotion approval need them).

## D-006 · 2026-09-16 · Cost envelope (to be confirmed by the human)

| Service | Plan assumed | Annual USD | Note |
| --- | --- | --- | --- |
| Vercel | Pro, 1 seat | 240 | Hobby plan forbids commercial use |
| Clerk | Free | 0 | assumes ≤10k MAU and ≤100 monthly active orgs; D-003 uses one org |
| Neon | Free | 0 | scale-to-zero; revisit if compute hours exceed the free quota |
| Cloudflare R2 | Pay as you go | 0–40 | 10 GB free; Airtable attachments may exceed it |
| Inngest | Free | 0 | free tier run quota |
| Resend | Free | 0 | 3k emails/month |
| Anthropic API | Pay as you go | 20–60 | spell checker only |
| **Total** |  | **≈260–340** | under the 500 USD ceiling |

Open: the PRD (§17 q5) mentions Cloudflare and Railway. Vercel is kept per the brief; Cloudflare Workers
via OpenNext would cut the Vercel line to ~60 USD if the human prefers it.

## D-007 · 2026-09-16 · Next.js pinned to 15.x

The brief specifies Next.js 15 with React 19. `apps/web` pins `next@15` even if a newer major is
published. Upgrade is a Phase 7 hardening ticket.

## D-008 · 2026-09-16 · Environment-gated acceptance criteria

Some kickoff acceptance criteria need live services that have no credentials yet (Neon preview branch,
Clerk sign-up). Those criteria are satisfied in code, verified against a local substitute where one exists,
and the live check is recorded under "Pending human verification" in `docs/runbook.md` with the exact
command to run once credentials exist. The ticket file states which criteria are gated. A ticket can move
to `done/` with gated criteria only when everything else in the Definition of Done is met and the gated
items are listed.

## D-009 · 2026-09-16 · Bootstrap tooling (TICKET-001)

Root dev dependencies, exact major pinned, minor and patch float with caret:

- `turbo` 2: task pipeline and caching across the pnpm workspace.
- `typescript` 5: compiler. Major 5 because typescript-eslint 8 supports `<6.1.0` and Next.js 15
  (D-007) is tested against 5.x; the TypeScript 6/7 upgrade is a Phase 7 hardening item.
- `@types/node` 24: Node typings for the root config files.
- `eslint` 10 and `@eslint/js` 10: flat config and the core recommended rules.
- `typescript-eslint` 8: strict-type-checked rules through `projectService`; typed lint is cheap on
  this tree. `no-restricted-properties` blocks `process.env` outside `packages/env/**` (D-004).
- `eslint-config-prettier` 10: switches off formatting rules that would fight Prettier.
- `prettier` 3: formatter.
- `vitest` 4: unit runner; the root config discovers `packages/*` and `apps/*` as projects. Vitest 5.0
  shipped on 2026-09-03; major 4 stays until it has settled, the `projects` API is the same.
- `@playwright/test` 1: E2E runner configured at the root, tests under `apps/web/e2e`.
- `husky` 9 and `lint-staged` 17: pre-commit runs Prettier on staged files and ESLint on staged
  ts/tsx.

Conventions fixed by this ticket:

- Root scripts run through Turborepo. Root-level tools are Turborepo root tasks (`//#lint:root`,
  `//#test:root`, `//#test:e2e:root`, `//#typecheck:root`), the pattern Turborepo documents; they
  are uncached because they read files from every package. Packages provide `typecheck`, `build`
  and `dev` scripts. `lint`, `test` and `test:e2e` run once at the root: root ESLint covers every
  package, root Vitest discovers each package's `vitest.config.ts`, Playwright reads
  `apps/web/e2e`. A package adds its own `lint` or `test` script only when it needs another runner.
- `exactOptionalPropertyTypes` stays off (comment in `tsconfig.base.json`): React, Next.js and
  third-party typings pass `undefined` to optional properties; the option adds friction with no
  safety payoff for this codebase.
- Every package sets `"type": "module"`; `verbatimModuleSyntax` requires ESM.
- Prettier skips `docs/` and `CLAUDE.md`: prose owned by the planner and the PRD author; Prettier's
  table padding would rewrite every table for no gain.
- Playwright declares `webServer` only when `apps/web/package.json` exists because it starts the
  server before it looks for tests. Vitest lists a workspace root only when it holds a package
  because it refuses a `projects` glob with no match.

## D-010 · 2026-09-16 · Web app scaffold (TICKET-002)

Dependencies added to `apps/web` (`@tas/web`), exact major pinned, minor and patch float with caret:

- `next` 15 (15.5.x): the App Router host (D-007). `eslint.ignoreDuringBuilds` is on: `next build`
  walks up to the root `eslint.config.js` and would run the same rules a second time; lint runs once
  at the root (D-009).
- `react` 19 and `react-dom` 19: the brief's React version; Next 15.5 lists `^19.0.0` as a peer.
- `@types/react` 19 and `@types/react-dom` 19: typings for the above.
- `tailwindcss` 4, `@tailwindcss/postcss` 4 and `postcss` 8: CSS-first Tailwind
  (`@import "tailwindcss"` in `src/app/globals.css`) through the PostCSS plugin Next.js supports.
- `clsx` 2 and `tailwind-merge` 3: the shadcn `cn` helper.
- `class-variance-authority` 0.7: variant props for shadcn components.
- `@radix-ui/react-slot` 1: `asChild` composition in the shadcn Button.

Conventions fixed by this ticket:

- shadcn/ui is set up by hand in the shape its manual installation documents (`components.json`
  style `new-york`, base colour neutral, CSS variables, `@/` aliases, `cn` in `src/lib/utils.ts`).
  The current CLI (`shadcn@4`) defaults to the Base UI preset and adds runtime packages (`shadcn`,
  `cn`, `radix-ui`, `lucide-react`, `tw-animate-css`) the ticket does not need. `components.json`
  stays valid for `shadcn add`. Chart and sidebar CSS variables are left out until a component needs
  them; the CLI adds them together with that component.
- Root `typescript`, `@types/node`, `vitest` and `@playwright/test` resolve from the root
  `node_modules`; the app does not list them again.
- `next-env.d.ts` is generated and references `.next/types/routes.d.ts`, so it is gitignored in
  `apps/web` and ignored by the root ESLint config (the one root file this ticket touches). The app's
  `typecheck` script runs `next typegen` before `tsc`, so `pnpm typecheck` passes on a fresh clone.
- `apps/web/tsconfig.json` extends the base and pre-sets every option Next.js would otherwise write
  back (`jsx`, `allowJs`, `incremental`, `lib`, the `next` plugin, `include`), so `next build` never
  rewrites it.
- `@next/eslint-plugin-next` is not added: root ESLint (D-009) already covers the app. It is a later
  tooling ticket if its rules earn their keep.
