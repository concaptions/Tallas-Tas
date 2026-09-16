# TICKET-002 · Next.js app in apps/web

- Owner: frontend
- Size: S
- Depends on: TICKET-001
- PRD: §11 (brand switcher in the top nav is later; this ticket is the shell only)

## Why

The web app is the host for every later page. It must build, typecheck and be reachable by Playwright
before any feature lands.

## Acceptance criteria

1. `apps/web` is a Next.js 15 App Router app (`next@15`, `react@19`), package name `@tas/web`,
   TypeScript strict extending `tsconfig.base.json`.
2. Tailwind CSS 4 wired (CSS-first config, `@import "tailwindcss"`), shadcn/ui initialised
   (`components.json`, `cn` helper, one Button component under `apps/web/src/components/ui/`).
3. One placeholder page at `/` rendering the text "TAS Creative Platform" inside a shadcn Button or Card,
   proving Tailwind and shadcn styles apply.
4. `pnpm dev` serves it; `pnpm build` succeeds; `pnpm typecheck`, `pnpm lint`, `pnpm test` stay green.
5. Playwright E2E `apps/web/e2e/smoke.spec.ts` opens `/` and asserts the heading text. `pnpm test:e2e`
   passes locally (Playwright browsers installed with `pnpm exec playwright install chromium`).
6. Vitest is wired for `apps/web` with one trivial unit test for the `cn` helper.
7. `docs/decisions.md` D-010 lists the dependencies added.

## Files touched

`apps/web/**` (package.json, next.config.ts, tsconfig.json, postcss config, `src/app/layout.tsx`,
`src/app/page.tsx`, `src/app/globals.css`, `src/lib/utils.ts`, `src/components/ui/button.tsx`,
`components.json`, `e2e/smoke.spec.ts`, `vitest.config.ts`), `docs/decisions.md`.

## Notes

- No auth, no database, no env access in this ticket.
- Keep the layout brand-agnostic; branding arrives with the brand switcher ticket.
