# Product + Landing Page coverage matrix

**Owner:** Phase 0 of the TAS Flow Completion run (2026-10-16, main @ 366616b).
**Scope:** Every module page under `apps/web/src/app/app/*`, measured against the user intent:
"add a Product and a Landing Page once, then every page that should reference them
already has them filled in; keep adding info on those pages without retyping; every
link works both ways; every field is editable in the sidebar and new dialog."

## GAP-0: Separate `landing_pages` table

**Decision: Resolved by PRD §5.1 — no separate table is needed.**

PRD §5.1 unifies the two concepts:
> "Product or Collection / Landing Page... Product or Landing Page Name, Link."

The schema honours that unification (`packages/db/src/schema/products.ts`):
> "A product or landing page the creative work points at (PRD §5.1: the link is required,
> the collection link is optional)."

The Oct 12 client sync (Ticket 1) reaffirmed it:
> "a product row is a landing page as often as a product."

The UI page title is already **"Products / Landing Pages"** (`products-workspace.tsx:386-389`).
Each row carries `name` (Product or Landing Page name), `link` (landing-page URL, required),
and `collectionLink` (optional). Adding a parallel `landing_pages` table would duplicate the
entity, violate PRD §5.1, and burn a migration slot. CLAUDE.md non-negotiable 10 and principle
"Root cause first" both point the other way. **The reverse-link reads of a product therefore
cover every "landing page" surface the task names.**

## FK and junction inventory (packages/db/src/schema)

| Table | Column / junction | Column kind |
|---|---|---|
| `personas` | `product_id` → `products.id` | FK, nullable |
| `angles` ↔ `products` | `angle_products` junction | many-to-many |
| `creative_briefs` | `product_id` → `products.id` | FK, nullable |
| `copywriting` | `product_id` → `products.id` | FK, nullable |
| `collections` | `product_id` → `products.id` | FK, nullable (table RETIRED Oct 12) |
| `creators` ↔ `products` | `creator_products` junction | many-to-many |
| `email_campaigns` ↔ `products` | `email_campaign_products` junction | many-to-many |
| `youtube_copy` ↔ `products` | `youtube_copy_products` junction | many-to-many |
| `concepts` | **NONE** | inherited through angle (PRD §5.7) |

## Coverage matrix (before this run)

Legend: Yes = present; No = missing (gap); n/a = not expected by PRD; retired = scope removed.

| Page | Grid shows Product | Sidebar shows Product | New-dialog picks Product | Picker brand-scoped | Reverse list on Product page | Autofill inheritance |
|---|---|---|---|---|---|---|
| `/app/products` | n/a (is the Product) | n/a | n/a | n/a | **Concepts, Briefs, Copywriting (meta), Creators, Angles, Email campaigns, YouTube copy** — all present (`products-workspace.tsx` + `product-panel.tsx`) | n/a |
| `/app/personas` | **No** (grid resolver has no `product_id` column) | **No** (persona-panel has `LinkField` for angles only; `productId` is in schema but not editable) | **No** (New Persona form has no Product picker) | n/a (not wired) | Products panel does not list Personas (reverse missing) | n/a |
| `/app/angles` | Yes (`angle_products` resolver column renders) | Yes (angle-panel has Product `LinkField` through `angle_products`) | Yes (same panel is Create and Edit) | Yes (`loadProducts()` from server page) | Yes (Product panel's `angles` LinkField) | n/a |
| `/app/concepts` | **Inherited only** (`productName` via angle; no own column) | Read-only quick-look panel; full edit is `/app/concepts/[conceptId]` | **No** (concept detail picks Angle + Theme + Batch; Product is read-off-angle) | Angle picker is brand-scoped | Products panel does NOT list Concepts directly (reverse missing — must be read through angle) | **Partial**: `inheritedFromAngle` fills productName, personaName, type on the detail page; grid shows these. But the inheritance NEVER writes `product_id` back to the concept (there is no column), so a brief created from the concept has to read product through the chain. |
| `/app/creative-sheet` (briefs) | Yes (resolved column from `products` link) | Yes (sidebar `InlineField` kind `link` with brand-scoped `sidebarProductOptions`) | **No** (`new-creative-dialog.tsx` picks Concept + Type only; Product is not asked at create time) | Yes (`loadProducts()` + brand scope) | Yes (Product panel's `creativeDesigns`) | **Partial**: picking a Concept copies `batch`; it does NOT copy the concept's inherited Product onto the new brief |
| `/app/creative-design` (list retired, dialog still exists) | n/a | Yes via `brief-panel.tsx` full page | **No** (`new-brief-dialog.tsx` same shape as creative-sheet) | n/a | Yes | Same partial as creative-sheet |
| `/app/copywriting` | Yes (resolver has `product_id` column) | Yes (`copy-panel.tsx` has Linked Product `<Select>` over `products`) | Yes (same panel is Create/Edit) | Yes (brand-scoped `workspace.products`) | Yes (Product panel's `metaCopywriting`) | **No**: picking a Concept or a Creative Brief does NOT prefill Product even though the brief already has one |
| `/app/collections` | retired (`CollectionsPage` returns null) | retired | retired | retired | retired | retired |
| `/app/ugc` (creators) | n/a | Yes (`creator-panel.tsx` has `creator-products` LinkField) | Yes (same panel) | Yes (`loadProducts()`) | Yes (Product panel's `creators`) | n/a |
| `/app/assets` (asset library) | n/a (no FK to products — asset belongs to brief) | n/a | n/a | n/a | n/a | n/a |
| `/app/overview-dashboard` | n/a (read-only summary) | n/a | n/a | n/a | n/a | n/a |
| `/client/[brandSlug]/*` (client portal) | n/a (client-facing track; no product picker; read-only Product name is already surfaced on briefs they see) | n/a | n/a | n/a | n/a | n/a |

## GAP list (post-matrix)

- **GAP-1** `/app/personas`: Persona has `product_id` in schema but the form, panel, and grid do not expose it. Fix: add Product picker to the persona panel (reuse `LinkField` or a `<Select>`), wire `loadProducts()` on `page.tsx`, surface the stored name in the grid.
- **GAP-2** `/app/products` (reverse): Products panel does not list linked Personas. Fix: add `personas` reverse list to `ProductItem` and the panel (mirror `creators`/`creativeDesigns`/`metaCopywriting`).
- **GAP-3** `/app/creative-sheet` + `/app/creative-design` dialogs: new-brief / new-creative dialogs do not pick Product on create. Picking a Concept does not inherit the concept's (through-angle) Product onto the new brief. Fix: add Product `InlineField` to both `new-brief-dialog.tsx` and `new-creative-dialog.tsx`; when a Concept is picked, if the concept's inherited product is set, prefill the Product chip (strategist can override).
- **GAP-4** `/app/copywriting`: new-copy flow does not inherit the Product from the picked Creative Brief or Concept. Fix: when `creativeBriefId` or `conceptId` changes in `copy-panel.tsx`, prefill `productId` from the brief / concept's inherited product if unset.
- **GAP-5** Products reverse-list ↔ Concepts: Product panel does not list concepts whose angle links to this product. Fix: compute concept-through-angle set in the Products page loader and render in the panel.

## Decisions deferred to Phase 1

- Concepts stay without a direct `product_id` (PRD §5.7 is explicit the Product field on a concept is **auto-filled** from the linked Angle). The autofill is already in `inheritedFromAngle`; brief and copy pickers that start from a concept should read that inherited product and prefill their own `product_id`.
- Collections stays retired; nothing is wired there.
- `creative_briefs.product_id` and `copywriting.product_id` remain the canonical FK columns (no column rename, no shadow table).

## Phase 1 plan derived from this matrix

1. GAP-1: Persona Product picker (schema already fine; UI + loader + action patch).
2. GAP-2: Products panel surfaces Personas (page loader + ProductItem shape + panel section).
3. GAP-3: New-brief and new-creative dialogs add Product picker + concept-inherit prefill.
4. GAP-4: Copywriting panel auto-fills Product from Creative Brief / Concept on pick.
5. GAP-5: Products panel surfaces concept-through-angle Concepts list.

Everything else in the matrix is Yes; this is the GAP shortlist that fulfils "add a Product once,
every page that should reference it has it already."
