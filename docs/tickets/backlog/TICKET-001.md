# TICKET-001 · Bootstrap monorepo

- Owner: integrator
- Size: M
- Depends on: none
- PRD: §14.6 (cost), §16 (delivery cadence). Tooling ticket; no product behaviour.

## Why

Everything else needs a workspace where `pnpm install && pnpm typecheck && pnpm lint && pnpm test` is
green from the first commit, so every later ticket is judged against the same bar.

## Acceptance criteria

1. `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all exit 0 on the empty
   tree (no apps or packages yet). Empty test suites pass explicitly, they do not error.
2. pnpm workspace (`apps/*`, `packages/*`), Turborepo pipeline for `dev`, `build`, `typecheck`, `lint`,
   `test`, `test:e2e` with sensible `dependsOn` and outputs.
3. Root `package.json` has `"packageManager": "pnpm@12.4.2"`, `engines.node >=24`, and `.node-version`
   contains `24`.
4. `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes`
   off (documented), `moduleResolution: bundler`, `verbatimModuleSyntax: true`.
5. Shared ESLint flat config (`eslint.config.js` at root, typescript-eslint strict-type-checked where
   cheap enough, otherwise recommended-type-checked) with `no-restricted-properties` forbidding
   `process.env` outside `packages/env/**`. Zero warnings policy: `pnpm lint` runs with `--max-warnings 0`.
6. Shared Prettier config. `pnpm format` and `pnpm format:check` scripts.
7. Vitest configured at the root as a workspace runner that discovers `packages/*` and `apps/*`; passes
   with no tests.
8. Playwright configured at the root (`playwright.config.ts`), tests dir `apps/web/e2e`, `webServer`
   entry pointing at `pnpm --filter @tas/web dev` (the app arrives in TICKET-002; the config must not
   fail when the app is absent, use `--pass-with-no-tests`).
9. Husky pre-commit runs lint-staged: prettier on staged files, eslint on staged ts/tsx.
10. `.gitignore` covers node_modules, .next, dist, coverage, playwright artefacts, `.env*` except
    `.env.example`, `.turbo`.
11. `.env.example` exists with every variable named in `docs/runbook.md`, each with a one-line comment.
12. `docs/decisions.md` gets a D-009 entry listing every dependency added and why (one line each).

## Files touched

`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`,
`.prettierrc`, `.prettierignore`, `vitest.workspace.ts` (or `vitest.config.ts`), `playwright.config.ts`,
`.husky/pre-commit`, `.lintstagedrc`, `.gitignore`, `.node-version`, `.env.example`,
`docs/decisions.md`.

## Notes

- No packages are created in this ticket. Do not scaffold apps/web here.
- Pin exact major versions; let minor/patch float with caret.
- Run every acceptance command yourself before reporting and paste the output in your report.
