# Sprint Oct 12 — status log

Ticket index: `docs/tickets/in-progress/sprint-oct12-client-sync.md`. One entry per ticket, in the
order they were worked; blockers and the decisions the human owns are at the bottom.

## Phase A

### Ticket 1 — Collections removal, Products relabel, freeze + grep guard — DONE

- **Nav / route**: `collections` is in `REMOVED_WORKSPACES` (`packages/domain/src/team/access.ts`)
  with a new redirect target `products`; `/app/collections` and every address under it permanently
  redirect to `/app/products` through the segment's `sectionGuard` layout. The sidebar never offers
  Collections on any brand or role (the catalogue entry stays, hidden, as every Oct 7 retirement does:
  `nav.test.ts` requires each retired key to keep its href so an old URL still resolves); the Products
  entry reads "Products / Landing Pages".
- **Copywriting**: the Linked Collection select, its hidden input, the chip and the reverse-read list
  are removed from `copy-panel.tsx`; `updateCopyAction` no longer accepts `collectionId` nor calls
  `setCollectionCopywritingLinkInBrand`; the three grid renderers (`collections`, `collection_url`,
  `products_from_collections`) and the `CopyLookupCollection` read are removed. A copy links to a
  Creative and a Product only.
- **Brief / concept / sheet**: the brief page's Collection fact, the `collection_id` grid renderer,
  the concept rail's Collections section, the `concept_collections` grid renderer and the Creative
  Sheet's `Collection` lookup (grid and sidebar) are removed.
- **Products**: eyebrow and h1 "Products / Landing Pages"; form label "Product Name / Landing Page
  Name" (the grid header already carried the seeded label).
- **Freeze**: `packages/db/src/schema/collections.ts` carries the deprecation comment (as of Oct 12);
  `collections` is in `FROZEN_PROPAGATION_TABLES` (no seed, no row propagation, no resync); the six
  seeded columns that read the table are `is_hidden` on every brand through
  `RETIRED_COLLECTION_COLUMNS` in `column-seed.ts`; `frozen-tables.test.ts` scans `apps/web`,
  `packages/domain`, `packages/ui` and `packages/integrations` and fails on any import of the
  `collections` Drizzle table. The query layer (`packages/db/src/collections.ts`), the junction reads
  and the importer are untouched: the table is frozen, not dropped.
- **What stays on purpose**: the Campaigns & Offers grid's read-only "Collections" column (the
  reverse of `collections.campaign_id`, through `loadCollections`) — not named by the ticket; flagged
  below for Talal.
- **Files**: `packages/domain/src/team/access.ts`, `apps/web/src/lib/removed-workspaces.ts`,
  `apps/web/src/components/shell/{nav,icons}.ts(x)`, `apps/web/src/app/app/products/{products-workspace.tsx,fields.ts}`,
  `apps/web/src/app/app/copywriting/{copy-panel,copywriting-workspace}.tsx`,
  `apps/web/src/app/app/copywriting/{actions,build-items,fields,page}.ts(x)`,
  `apps/web/src/lib/{copy-source,creative-sheet-source,collections-source}.ts`,
  `apps/web/src/app/app/concepts/{[conceptId]/concept-detail.tsx,[conceptId]/page.tsx,fields.ts,concepts-workspace.tsx,page.tsx}`,
  `apps/web/src/app/app/creative-design/{[briefId]/page.tsx,[briefId]/brief-detail.tsx,fields.ts,briefs-workspace.tsx}`,
  `apps/web/src/app/app/creative-sheet/{build-items.ts,creative-sheet-workspace.tsx,creative-sheet-panel.tsx,fields.ts,page.tsx}`,
  `apps/web/src/app/app/collections/page.tsx` (stub; workspace, panel, actions and fields deleted),
  `apps/web/src/app/(dev)/design-system/{copywriting,creative-sheet}.stories.tsx`,
  `packages/db/src/{column-seed,propagation}.ts`, `packages/db/src/schema/collections.ts`,
  `packages/db/src/frozen-tables.test.ts`, tests and e2e specs alongside (`collections.spec.ts`
  deleted; `removed-workspaces.spec.ts` covers the redirect).
- **Tests**: see the gate line below.
- **Production step (no migration)**: the hidden rows reach Railway only when the column seed is
  re-applied: `pnpm --filter @tas/db seed-columns -- --apply` (prod `DATABASE_URL` in the live
  repo's `.env.local`). Until then the six columns stay configured in `column_definitions` and the
  Copywriting, Concepts and Creative Sheet pages report them as "configured but not drawn" — a
  notice, not a failure.

## Blockers and decisions the human owns

- **Ticket 1** · the Campaigns & Offers page still shows its read-only "Collections" reverse-link
  column and panel list (the ticket names the Copywriting form and the brief/concept pickers only).
  Drop it too? One commit if yes.
- **Ticket 1** · `seed-columns --apply` on Railway (above) is a production write; it needs the
  operator.
- **Ticket 5** · the brief asks to drop `launched` / `on_hold` and the per-track revision keys from
  `internal_status`. Production carries 397 live briefs on the current vocabulary (`docs/decisions.md`
  2026-10-10); a data migration is needed and must be applied by the operator before the push.
  The QA auto-reset (`QA_INVALIDATING_INTERNAL`) is derived from the vocabulary and follows it.
- **Tickets 15 / 16** · the four-value client vocabulary in the brief conflicts with the AUDIT-13
  decision (ONE client vocabulary, `CLIENT_STATUS`, six keys, on briefs, concepts and copywriting).
  Needs Talal's call before either ticket changes a status enum.
- **Ticket 2** · the brief's concept name separator (" - ") conflicts with CLAUDE.md non-negotiable 6
  (`Batch-Angle-Theme`), and the `production_status` fidelity flip reverses the Oct 7 decision.
- **Ticket 3** · an internal `draft` status does not exist in the schema; the entry statuses are
  `sent_to_video_editor` / `sent_to_designer`.
- **Column drops** (Tickets 5, 15) · production data counts cannot be checked from this session
  (no `DATABASE_URL` here); the operator confirms before any `DROP COLUMN` migration.
