# Products · Product or Collection / Landing Page (PRD §5.1)

- Page: `/app/products`, sidebar section `products` (currently `href`-less, so it renders with a `SoonChip`)
- Pattern: Personas, mirrored file for file
- Depends on: TICKET-005 (`withBrand`), the Personas route as the reference implementation

## Why

PRD §5.1: "Product or Landing Page Name, Link." — "adding this is required, at least the landing page
link", with an optional Collection link and optional links out to the other tables. The PRD also asks
for bulk CSV upload with a downloadable template.

## Acceptance criteria

1. `/app/products` renders inside the app shell with no frame, padding or background of its own, and the
   sidebar's Products section is active on it (its `href` is added to `nav.ts` and `routes.ts` in the same
   change, and its `SoonChip` is gone).
2. The table has exactly four columns, in this order: **Product name**, **Landing page URL**,
   **Collection link**, **Updated**. Collection link is optional: a product without one shows the em dash
   from `fields.ts`, never an empty cell or a broken link.
3. Rows are the brand's live products, newest edit first. Updated is a relative label rendered on the
   server with one `now` (`relativeTime` / `absoluteTime`), with the absolute time in `title`.
4. Clicking a row opens a detail panel: fixed to the right edge at 60% width, NOT a modal — no backdrop,
   the table stays visible and clickable — with the selected id in `?product=` written through the History
   API, so a refresh reopens the panel and the URL is shareable. A close control clears the parameter.
5. The panel shows every product field (name, landing page URL, collection link) plus a **linked concepts**
   count: the number of live concepts whose angle points at this product (`concepts.angleId` →
   `angles.productId`). Zero renders as `0`, not as a blank or a dash.
6. Top-right of the page header: a **Upload CSV** button and a **Download template** link.
7. In demo mode the Upload CSV button is disabled through `DisabledWrite` + `disabledWriteClassName` from
   `@tas/ui`, with a tooltip saying why. **Download template** stays enabled in demo mode: it builds the
   CSV string in the browser and triggers a download, so it is not a write and never touches the server.
   The template's header row is exactly the writable columns: `name,link,collection_link`.
8. Every save path is a typed result, never a thrown error: in demo mode the action refuses before any
   validation, actor lookup or connection, exactly as `personas/actions.ts` does.
9. `loadProducts()` in `apps/web/src/lib/products-source.ts` copies `personas-source.ts`: demo mode reads
   `demoProducts` from `@tas/db` and constructs **no** database client even when `DATABASE_URL` is set;
   live mode opens Neon per call and closes it in a `finally`. A connect-spy unit test proves the demo
   branch never calls `connect`.
10. The seeded brand has **at least 3 products**: a third fixture is added to `demoProducts` in
    `packages/db/src/demo-data.ts` (hardcoded uuid and fixed timestamps, like the other two) and therefore
    appears in both the demo page and `seed(db)`.
11. Colours go through the token layer only (no hex in a component), every rounded control uses
    `rounded-input` / `rounded-card` and no button is `rounded-full`. Any status label comes from
    `@tas/domain/state`; this page has no status of its own, so it must not invent one.
12. `pnpm --filter @tas/web exec tsc --noEmit`, `pnpm --filter @tas/db exec tsc --noEmit` and the vitest
    runs for both packages are clean, and the new e2e spec `apps/web/e2e/products.spec.ts` covers: three or
    more rows, opening a row sets `?product=`, reload keeps the panel open, the upload button is disabled
    in demo mode, and the template link is not.

Out of scope: parsing an uploaded CSV, product create/edit forms beyond the panel's own fields, links to
Campaigns, Angles, Briefs, Copywriting or UGC, and anything client-facing.

## Files each agent touches

- schema/db: `packages/db/src/demo-data.ts` (third product), `packages/db/src/products.ts` +
  `products.test.ts` (`listProducts`, `getProductById`, `countLinkedConcepts`, all through `withBrand`),
  `packages/db/src/index.ts`
- app: `apps/web/src/lib/products-source.ts` + `products-source.test.ts`,
  `apps/web/src/app/app/products/{page.tsx,products-workspace.tsx,product-panel.tsx,fields.ts,actions.ts,actions.test.ts}`,
  `apps/web/src/lib/routes.ts` (`productsPath`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/products.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); the db tests run on PGlite.
