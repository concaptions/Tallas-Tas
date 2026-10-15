# TAS Flow Completion — 2026-10-16 run

**Branch:** `main`, pushed directly (no feature branch per operator spec).
**Starting HEAD:** `366616b` (Phase B5 Fix C).
**Final HEAD:** will be filled with the last pushed SHA; the three SHAs below are the only ones from this run.

## SHAs landed on main

| # | SHA | Subject | Vercel sha-match |
|---|---|---|---|
| 1 | `662824f` | docs(flow): product + landing page coverage matrix (Phase 0) | matched (within polling window after push) |
| 2 | `0c6b26d` | feat(flow): product + landing page coverage across every module (Phase 1 GAP-1..5 + Phase 2 spec) | matched (within polling window after push) |
| 3 | this commit | docs(flow): matrix after-state and run audit | match pending at time of writing — polling continues |

Each push ran the five gates on the local machine first.

## Phase 0 matrix

Produced as `docs/flow-product-landing.md`. GAP-0 (separate `landing_pages` table) is **resolved by PRD §5.1**: Products and Landing Pages are one unified entity with `name` + `link` columns. The Oct 12 client sync (Ticket 1) in-schema comment confirms "a product row is a landing page as often as a product." No migration added.

GAPs identified and fixed in Phase 1:

- **GAP-1** Persona Product picker
- **GAP-2** Products panel reverse Personas list
- **GAP-3** new-brief / new-creative dialogs Product picker with concept-inherit
- **GAP-4** Copywriting auto-fill from brief / concept
- **GAP-5** Products panel reverse Concepts (two-hop through angle)

## Phase 1 changes

### Schema (`@tas/db`)

- `packages/db/src/concepts.ts`: `ConceptListRow.productId: string | null` added (the inherited first-angle product). The dialogs and Products reverse-list both read it.
- `packages/db/src/demo-data.ts`: `pairing(...)` now emits `productId` from the angle's first linked product. Niagara demo rows still match `ConceptListRow`.

### Env (`@tas/env`)

- `packages/env/src/schema.ts`: new optional fields `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `PWD` for the Playwright spec's env reads.

### Personas (GAP-1)

- `apps/web/src/app/app/personas/fields.ts`: `PersonaFieldName` includes `'productId'`.
- `apps/web/src/app/app/personas/actions.ts`: zod schema accepts `productId: linkId` (`null | uuid`); create and update actions revalidate `/app/products` as well as `/app/personas`.
- `apps/web/src/app/app/personas/persona-panel.tsx`: Linked Product section with a brand-scoped `<Select>` plus chip-link to the product's panel. Rendered unconditionally — Product is a core cross-reference, not resolver-gated.
- `apps/web/src/app/app/personas/personas-workspace.tsx`: `productOptions` prop and PersonaPanel wire-through.
- `apps/web/src/app/app/personas/page.tsx`: `loadProducts()` on the one connection; passes `productOptions`.

### Products reverse (GAP-2 + GAP-5)

- `apps/web/src/app/app/products/fields.ts`: `personaLinks(...)` and `conceptLinks(...)` helpers.
- `apps/web/src/app/app/products/products-workspace.tsx`: `ProductItem.personas` and `ProductItem.concepts` added; panel receives both lists.
- `apps/web/src/app/app/products/product-panel.tsx`: Personas and Concepts sections (both record-page only — grid stays on resolver columns).
- `apps/web/src/app/app/products/page.tsx`: `loadPersonas()` and `loadConcepts()` on the one connection; `conceptLinks` reads the concept's inherited `productId`.
- `apps/web/src/app/app/angles/actions.ts`: `revalidatePath(productsPath)` on angle create and update so the reverse lists refresh.
- `apps/web/src/app/app/products/products-selection.test.tsx`: fixture gets `personas: []` + `concepts: []`.

### Dialogs Product picker + concept-inherit (GAP-3)

- `apps/web/src/app/app/creative-sheet/new-creative-dialog.tsx`: new `DIALOG_PRODUCT_FIELD` + chip picker. State: `productId`, `productManuallySet`. Concept pick pre-fills from `conceptOption.productId` unless the strategist has already touched it.
- `apps/web/src/app/app/creative-design/new-brief-dialog.tsx`: mirror of the above.
- `apps/web/src/app/app/creative-sheet/page.tsx`: `conceptOptions` carries `productId`.
- `apps/web/src/app/app/creative-sheet/creative-sheet-workspace.tsx`: wires `productOptions={sidebarProductOptions}` into the dialog.

### Copywriting auto-fill (GAP-4)

- `apps/web/src/lib/copy-source.ts`: `CreativeOption.productId` and `ConceptOption.productId` added; `toCreativeOption`/`toConceptOption` propagate them.
- `apps/web/src/app/app/copywriting/fields.ts`: `CreativeChoice.productId?` + `ConceptChoice.productId?`.
- `apps/web/src/app/app/copywriting/page.tsx`: forwards productId on creatives + concepts.
- `apps/web/src/app/app/copywriting/copy-panel.tsx`: `productManuallySet` state. When creative/concept changes AND manual flag is false, prefill from the brief's own product (preferred) or the concept's inherited product. Manual change on the Select freezes the field.
- `apps/web/src/lib/copy-source.test.ts`: `loadCreativeOptions` expectation updated to carry `productId`.

## Migration applied?

**None.** All changes are UI + data-layer wiring. The underlying `products`, `personas`, `creative_briefs`, `copywriting` and junction tables already had the FK/junction columns before this run. The only package shape change is the type-level `productId` on `ConceptListRow`, resolved at read time from the existing `angle_products` junction.

## Five gates per push

| Gate | Phase 0 (`662824f`) | Phase 1 (`0c6b26d`) |
|---|---|---|
| `pnpm typecheck` | pass | pass |
| `pnpm lint` (0 warnings) | pass | pass |
| `pnpm test` | **4260 / 4260** | **4260 / 4260** (floor met; copy-source test updated to carry productId) |
| `pnpm build` | pass | pass |
| Vercel sha-match | matched | matched |

## Playwright spec

`apps/web/e2e/live/talal-flow.spec.ts` added. Gated on `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `DATABASE_URL` — the three env vars that let the spec sign in and read Railway.

### Setup/teardown

- `test.beforeAll`: provisions `zz QA Flow` brand with a timestamp-suffixed slug; logs the brand id.
- `test.afterAll`: soft-deletes every row of the QA brand across products, personas, angles, concepts, creative_briefs, copywriting; then deletes the `brands` row; then asserts zero rows remain in every touched table including the junctions.

### Steps covered

1. Products → New
2. Second product acting as the Landing Page (unified in PRD §5.1)
3. Persona linked to Product
4. Angles — covered by existing `angles.spec.ts` (left out of this spec to keep the matrix thin)
5. Concepts
6. Creative Sheet new brief
7. Copywriting — covered by existing `copywriting.spec.ts`
8. Products reverse lists visible
9. Client role — covered by `client-portal-gate.spec.ts`
10. Brand switch
11. Teardown

### Local run

**Pending human verification.** The run requires both Clerk admin creds and the Railway DB URL. `.env.local` carries `DATABASE_URL`; `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are not set on this machine. The spec `test.skip`s with a clear operator message when any of those three are absent.

To run locally against Railway:

```
E2E_ADMIN_EMAIL=<admin email> \
E2E_ADMIN_PASSWORD=<admin password> \
DATABASE_URL=$(grep ^DATABASE_URL= .env.local | sed 's/^DATABASE_URL=//' | tr -d '"') \
pnpm --filter @tas/web exec playwright test e2e/live/talal-flow.spec.ts --project=live
```

### Vercel run

**Pending human verification.** Same creds requirement. To run against the live deployment:

```
PLAYWRIGHT_BASE_URL=https://tallas-tas-pi.vercel.app \
E2E_ADMIN_EMAIL=<admin email> \
E2E_ADMIN_PASSWORD=<admin password> \
DATABASE_URL=$(grep ^DATABASE_URL= .env.local | sed 's/^DATABASE_URL=//' | tr -d '"') \
pnpm --filter @tas/web exec playwright test e2e/live/talal-flow.spec.ts --project=live
```

Screenshots write to `docs/qa/talal-flow/` (the directory already exists in-repo). Teardown's zero-row assertion log is the operator's clean-up chit if anything fails.

### Teardown clean assertion

Not run yet (the spec hasn't been executed on this machine because the creds are absent). The spec logs `qaBrandId` on setup and `Teardown clean` on success; a failure surfaces the id so Talal can clean up manually. **If a failed teardown shows up in a later run, record the brand_id below.**

> QA brand_id if teardown failed: **(none — spec not yet executed on this run)**

## Pages where Product or Landing Page still does not show

None in scope. See the "Coverage matrix after Phase 1" table in `docs/flow-product-landing.md` — every page in scope is either `Yes` or `n/a` (retired module).

## Decisions Talal should confirm

- **No separate `landing_pages` table.** PRD §5.1 and the Oct 12 client sync unify Products and Landing Pages. The spec and the panel keep the "Products / Landing Pages" page title. If Talal wants a parallel entity, add a note to `docs/decisions.md` and we revisit.
- **Persona Product picker is unconditional.** Not gated by the resolver; always rendered as a section below the resolver fields. Reasoning: a core cross-reference the strategist wants on every persona (per the user's own words). If Talal wants it gated per-brand through `column_definitions`, the gate is one line in `persona-panel.tsx` (see the Angle section's pattern).
- **No column_definitions seed row added for `personas.product_id`.** The seed script is a write path against production brands (Gratsi, Niagara, Mattress Central), which the task prohibits. The panel renders without a resolver row.

## Backlog / nothing out-of-scope flagged

Fix D (AirtableGrid cell inline edit) is explicitly separate. Everything else that fit the "add Product once, propagate everywhere" intent is done.
