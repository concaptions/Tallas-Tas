# Oct 12 client sync + LuckyFours Studio audit — engineering loop (Tickets 1–21)

**Source**: the "TAS Digital Platform — Full Engineering Loop Prompt (Oct 12 Client Sync + LuckyFours
Studio Audit)" brief, 2026-10-12. Status log: `docs/sprint-oct12.md`. Final deliverable:
`docs/sprint-oct12-summary.md` (written when the last phase closes).

**PRD sections**: §5.1 (Products), §5.7 (Concepts), §5.10 (Creative Briefs), §5.11 (Copywriting),
§7 (names), §9 (two-track approval), §11 (roles).

Phases run in order; the human is reported to after each phase is green. A ticket that is blocked is
logged in `docs/sprint-oct12.md` and skipped, never faked.

## Phase A — cleanup and consolidation

| Ticket | Scope | PRD |
| ------ | ----- | --- |
| 1 | Collections removed from the product: nav entry, route (`/app/collections` → Products / Landing Pages, permanent redirect), the Copywriting panel's Linked Collection control and reverse-read list, the brief's and the concept's Collection fields and the sheet's Collection lookup. Products relabelled "Products / Landing Pages" (nav, eyebrow, h1); the product form's name field "Product Name / Landing Page Name". The `collections` table is FROZEN like `creative_sheet_items` (schema deprecation comment "as of Oct 12", `FROZEN_PROPAGATION_TABLES`, seeded columns hidden on every brand) and `frozen-tables.test.ts` fails the suite on any new import of the table from app code. | §5.1, §5.11 |
| 5 | `internal_status` consolidation (next). | §9 |
| 15 | Copywriting field cleanup (next). | §5.11 |
| 2 | Concepts finalisation (next). | §5.7 |

## Phase B–E

Tickets 3, 4, 6–14, 16–21 as the brief lists them; each is added to this table when its phase opens.

## Acceptance (every ticket)

- `pnpm typecheck` 0 errors · `pnpm lint` 0 warnings · `pnpm test` green · `pnpm --filter @tas/web build:ci` green.
- Conventional Commit referencing the ticket number; pushed to `main`; Vercel green.
- Any migration applied to Railway with its `packages/db/applyNN.mjs` BEFORE the push that reads it.
- `docs/sprint-oct12.md` updated: ticket DONE, files changed, test count delta.
