# TICKET-013 · shadcn components for Phase 1 and 2

- Owner: frontend
- Size: S
- Depends on: TICKET-002 (`components.json`, the Button that fixed the vendoring shape), TICKET-DS-01 (`packages/ui` exists with `cn`, tokens and the moved Button)
- PRD: §3 (onboarding form), §10 and §11 (the internal screens these components build). Tooling ticket;
  no product behaviour.
- Design: template-engine.md §9 (the UI rows TICKET-033 to TICKET-036; the design's `packages/ui/**`
  maps to `packages/ui/src/components/`, see D-019)

## Why

TICKET-010, 011, 033 and 034 each need several shadcn components. Vendored source is roughly 100 to 200
lines per component, so any feature ticket that also vendors its components blows the 300-LOC ceiling
for reasons that have nothing to do with its feature. Vendoring everything once, with one decisions
entry, keeps every feature diff about the feature.

## Acceptance criteria

1. Files under `packages/ui/src/components/`, one per component, in the shape TICKET-002's
   `components.json` dictates (style `new-york`, `cn` from `@tas/ui (`cn`)`): `dropdown-menu`, `input`,
   `label`, `select`, `card`, `alert-dialog`, `dialog`, `checkbox`, `switch`, `badge`, `textarea`,
   `table`, `tabs`, `radio-group`. Each file is the shadcn new-york Radix source for that component with
   imports resolved to this repo's aliases and no other edit. The CLI is not used (D-010: the current
   `shadcn` CLI would add `radix-ui`, `tw-animate-css` and other runtime packages).
2. `packages/ui/package.json` gains, exact major pinned, minor and patch floating: `@radix-ui/react-dropdown-menu`,
   `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-alert-dialog`,
   `@radix-ui/react-dialog`, `@radix-ui/react-checkbox`, `@radix-ui/react-switch`,
   `@radix-ui/react-tabs`, `@radix-ui/react-radio-group` and `lucide-react` (the icons `dropdown-menu`,
   `select`, `checkbox` and `radio-group` import). `input`, `card`, `badge`, `textarea` and `table` need
   no package. One `pnpm install`, announced; `pnpm install --frozen-lockfile` exits 0 afterwards.
3. `packages/ui/src/components/render.test.tsx` (`// @vitest-environment node`, no DOM library):
   for every component file, the exported root component renders through `react-dom/server`
   `renderToStaticMarkup` without throwing and the markup is non-empty (portal-based content such as
   `DialogContent` is rendered inside its root with `open` so the test covers the file, not only the
   trigger).
4. Every component uses only token classes (`bg-surface`, `border-line`, `text-text2`, …) after the
   shadcn variable aliases of TICKET-DS-01; the DS-01 hex lint passes. `pnpm turbo run build --filter=@tas/web`
   exits 0 (every vendored file compiles through the app); `pnpm typecheck && pnpm lint && pnpm test` green with zero warnings (vendored files that
   trip a strict-type-checked rule get the same per-line disable comment TICKET-002's Button used, with
   the rule named; no file-wide disable).
5. `docs/decisions.md` gets `D-019 · shadcn components vendored under packages/ui/src/components` (next
   free number if taken; update this header): the fourteen components, the nine Radix packages and
   `lucide-react`, and three rules: (a) files under `packages/ui/src/components/` are shadcn source and
   are excluded from the 300-LOC diff count of the Definition of Done in the ticket that vendors them;
   a later edit to one of them counts as ordinary code; (b) no toast library: pages show inline
   `role="status"` messages (TICKET-034, 035); (c) every shadcn component lives in `packages/ui/src/components/` and is imported from `@tas/ui`;
   `apps/web` never vendors its own copy (CLAUDE.md layout; design handoff TICKET-DS-01).

## Gated criteria (D-008)

none

## Files touched

`packages/ui/src/components/{dropdown-menu,input,label,select,card,alert-dialog,dialog,checkbox,switch,badge,textarea,table,tabs,radio-group}.tsx`,
`packages/ui/src/components/render.test.tsx`, `packages/ui/package.json`, `packages/ui/src/index.ts` (re-exports), `pnpm-lock.yaml`,
`docs/decisions.md`.

## Notes

- Nothing else: no page, no layout, no component outside `ui/`. TICKET-010 (`dropdown-menu`), TICKET-011
  (`input`, `label`, `select`, `card`), TICKET-033 (`alert-dialog`, `dialog`, `checkbox`, `switch`,
  `badge`, `textarea`, `table`) and TICKET-034 (`tabs`, `radio-group`) consume them and add none.
- Chart and sidebar CSS variables stay out (D-010); none of these components needs them.
