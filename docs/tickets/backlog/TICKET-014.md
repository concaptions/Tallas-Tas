# TICKET-014 · `@tas/domain` package skeleton and role arrays

- Owner: integrator
- Size: S
- Depends on: TICKET-003 (`@tas/env` is the package pattern to copy; same `zod` major), TICKET-005 (the
  enum values the drift test copies)
- PRD: §11 (roles), §3 (the internal team roles a brand is assigned)
- Design: template-engine.md §3.3 and §12 package-direction decision (D-022 in this plan's numbering:
  role and status arrays live in `@tas/domain`; direction `@tas/db → @tas/domain`)

## Why

Every engine decision and every business rule is a pure function in `@tas/domain`. The package must exist,
with the workspace edge pointing the right way, before TICKET-009 (brand creation) and TICKET-022 (the
engine's domain half) can start, and neither of those needs Clerk. Splitting the skeleton out lets the
engine chain run in parallel with the auth chain.

## Acceptance criteria

1. Package `@tas/domain` at `packages/domain`: `package.json` (`"type": "module"`, `main`/`exports` →
   `src/index.ts`, scripts `typecheck` and `build` matching `@tas/env`'s pattern, dependency `zod` with
   the same major as `@tas/env`), `tsconfig.json` extending `tsconfig.base.json`, `vitest.config.ts`
   discovered by the root runner, `src/index.ts`. No dependency on `@tas/db`, `@tas/web`, React or Next
   (`grep -c "@tas/db" packages/domain/package.json` prints `0`).
2. `packages/domain/src/roles.ts` exports `agencyRoles = ['admin', 'member'] as const`,
   `brandRoles = ['csm', 'strategist', 'video_editor', 'designer', 'media_buyer', 'client'] as const`,
   `internalBrandRoles = ['csm', 'strategist', 'video_editor', 'designer', 'media_buyer'] as const`
   (PRD §3, the internal team; `brandRoles` minus `client`), `brandStatuses = ['active', 'paused',
   'archived'] as const`, and the unions `AgencyRole`, `BrandRole`, `InternalBrandRole`, `BrandStatus`.
   This is the only name for the internal-role array in the repository; no ticket exports `teamRoles`.
3. `packages/domain/src/roles.test.ts` (fixtures only, no `@tas/db` import): asserts `agencyRoles`,
   `brandRoles` and `brandStatuses` equal, in order, a literal copy of TICKET-005's `pgEnum` values
   (`packages/db/src/schema/enums.ts`), and that `internalBrandRoles` equals `brandRoles` without
   `'client'`. Until TICKET-022 stage 2 re-points `enums.ts` at these arrays, this literal is what stops
   the two lists drifting; after it, the literal is the last copy of the migration values and the test
   still guards them.
4. `packages/db/package.json` gains `"@tas/domain": "workspace:*"` (the D-022 direction) and
   `apps/web/package.json` gains `"@tas/domain": "workspace:*"`. `pnpm install` once (announce it),
   `pnpm turbo run build --dry` exits 0 (no cycle), `pnpm typecheck && pnpm lint && pnpm test` green.
5. `docs/decisions.md` gets `D-018 · @tas/domain created; role arrays live in domain` (next free number
   if taken; update this header): `zod` as the package's only dependency, the `@tas/db → @tas/domain`
   edge, the drift test of criterion 3 as the bridge until TICKET-022 re-points `enums.ts`, and that
   `internalBrandRoles` is the one exported name for the internal team roles.

## Gated criteria (D-008)

none

## Files touched

`packages/domain/{package.json,tsconfig.json,vitest.config.ts}`, `packages/domain/src/{index,roles}.ts`,
`packages/domain/src/roles.test.ts`, `packages/db/package.json`, `apps/web/package.json`,
`pnpm-lock.yaml`, `docs/decisions.md`.

## Notes

- Nothing under `packages/domain/src/brand/**` or `packages/domain/src/template/**` is written here;
  TICKET-009 and TICKET-022 own those.
- No file under `packages/db/src/**` is edited: the drift test compares against a literal, not the
  schema module, so the schema role's files stay untouched.
