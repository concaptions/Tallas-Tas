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

### Ticket 5 — Internal status values cleanup — BLOCKED

- **Blocker 1 (infrastructure)**: the data migration the ticket requires (every old
  `internal_status` key rewritten on 397 live briefs) must be applied to Railway BEFORE the code that
  reads the new keys is pushed (CLAUDE.md release rule). Railway is unreachable from this session:
  `iriguchi.proxy.rlwy.net:48139` answers `ECONNREFUSED` through the container's network policy
  (tested 2026-10-12 with `pg` from `packages/db`). The operator applies it:
  `cd packages/db && DATABASE_URL=… node apply66.mjs` once 0066 exists.
- **Blocker 2 (decision, Talal)**: two stored values have no target in the final list
  (`draft`, `ad_submitted`, `sent_to_editor_or_designer`, `under_editing_or_designing`,
  `revisions_needed`, `revision_submitted`, `approved`):
  - `launched` (internal, "media buyer confirmed the ad is live"; the client track keeps its own
    `launched`). Map to `approved`, or keep `launched` as an eighth internal value?
  - `on_hold` (the non-linear branch off in-progress). Map to `under_editing_or_designing`?
  The operator can size both first:
  `select internal_status, count(*) from creative_briefs where deleted_at is null group by 1 order by 2 desc;`
- **Proposed mapping, ready to write as 0066 once the two answers are in**:
  `sent_to_video_editor`, `sent_to_designer` → `sent_to_editor_or_designer`;
  `video_editing_in_progress`, `static_design_in_progress` → `under_editing_or_designing`;
  `videos_revisions`, `images_revisions` → `revisions_needed`; `revisions_submitted` →
  `revision_submitted`; `ad_submitted`, `approved` unchanged; `draft` is new (nothing maps to it).
- **Scope note**: this is the two-track machine (`INTERNAL_VIDEO_STATUS` / `INTERNAL_STATIC_STATUS`,
  `docs/decisions.md` 2026-10-01 editor board) collapsing to one list — 60+ files reference the old
  keys (state machine, QA gate derivation, editor Kanban columns, the status guard, the portal gate on
  `launched`, demo fixtures, e2e). Expect two commits: the vocabulary + machine, then the surfaces.

### Ticket 15 — Copywriting field cleanup — PARTIAL (form done; column drops blocked)

- **Done**: Used, Winning, Meta Rating and the Client's Comment section are off the Copywriting
  panel; `updateCopyAction` no longer reads or writes them; the four grid renderers are gone and the
  seeded rows (`copywriting.used` on the template, Gratsi's `client_comment`, `used`, `winning`,
  `meta_rating`) are hidden on every brand. A copy links to a Creative and a Product only (Ticket 1
  took Collection). `client_approval_status` is on `copywriting` already (migration 0055; the panel's
  "Client Approval" select writes it).
- **Blocked — the drop migration**: "after confirming no production data" needs the counts, and
  Railway is unreachable from here (see Ticket 5). The operator runs
  `select count(*) filter (where used), count(*) filter (where winning), count(meta_rating), count(client_comment) from copywriting where deleted_at is null;`
  and, if all four are zero, a 0066/0067 `ALTER TABLE copywriting DROP COLUMN …` migration follows.
- **Keep `client_comment` out of the drop until Talal confirms**: it is the client's own note, written
  by the portal's `updateClientStatus` path and shown on `/client/<brand>/copywriting`. Dropping it
  removes the client's comment from the portal, not just from the internal form.
- **Vocabulary (decision, Talal)**: the brief's four values (`pending_client_approval`, `approved`,
  `disapproved`, `revision_needed`) conflict with AUDIT-13 (`docs/decisions.md` 2026-10-10: ONE
  client vocabulary, `CLIENT_STATUS`, six keys, on briefs, concepts and copywriting). Left on
  `CLIENT_STATUS` pending his call; Ticket 16 has the same question.
- **Files**: `apps/web/src/app/app/copywriting/{copy-panel.tsx,copywriting-workspace.tsx,actions.ts,build-items.ts,fields.ts}`,
  `packages/db/src/column-seed.ts` (`RETIRED_COLUMNS`), `packages/db/src/scripts/verify-rollout.ts`,
  tests and specs alongside.

### Ticket 2 — Concepts table finalisation — DONE (code); two items for Talal

- **Done**: Batch, Angle and Theme are the only required fields (Category is optional, still a closed
  vocabulary when chosen; `REQUIRED_CONCEPT_FIELDS` drives the form's Required marks and the Server
  Action re-runs `validateConceptDraft` before every write — both already existed). The concept name
  stays derived on save and read-only. Creator was already optional. The duplicate
  "Formats to create (production)" (`concepts.formats_to_create`) is off the form, the grid and the
  seed; `production_status` is off the form's write path and hidden on every brand including Gratsi
  (the Oct 4 fidelity row). Product and Persona stay the read-only "from Angle" block
  (`inheritedFromAngle`). The brief section is headed "Concept Details". Domain tests cover the
  required set, the name formula and the inherited read-only rule.
- **Decision, Talal — the separator**: the brief writes `${batch} - ${angle} - ${theme}`; PRD §7 and
  CLAUDE.md non-negotiable 6 write `Batch-Angle-Theme`, every live concept (102 on Gratsi) carries the
  hyphen, and the creative name formula slices the batch off it. The hyphen stays until he rules;
  `concept-name.test.ts` pins it.
- **`blind_approval`**: no such column or field exists on `concepts` (nothing to make optional).
- **Blocked — the two column drops** (`formats_to_create`, `production_status`, 73 stored values on
  the latter): production data check and migration apply need the operator (see Ticket 5).
- **Files**: `packages/domain/src/concepts/validate-concept-draft.ts` (+test), `concept-name.test.ts`,
  `apps/web/src/app/app/concepts/{[conceptId]/concept-detail.tsx,[conceptId]/page.tsx,actions.ts,fields.ts,concepts-workspace.tsx}`,
  `packages/db/src/column-seed.ts`, `packages/db/src/scripts/verify-rollout.ts`, tests and specs alongside.

## Blockers and decisions the human owns

- **Ticket 1** · the Campaigns & Offers page still shows its read-only "Collections" reverse-link
  column and panel list (the ticket names the Copywriting form and the brief/concept pickers only).
  Drop it too? One commit if yes.
- **Ticket 1** · `seed-columns --apply` on Railway (above) is a production write; it needs the
  operator.
- **Ticket 5** · see its entry above: Railway unreachable from here; `launched` / `on_hold` mapping.
- **Tickets 15 / 16** · the four-value client vocabulary in the brief conflicts with the AUDIT-13
  decision (ONE client vocabulary, `CLIENT_STATUS`, six keys, on briefs, concepts and copywriting).
  Needs Talal's call before either ticket changes a status enum.
- **Ticket 2** · the concept name separator (see its entry above).
- **Ticket 3** · an internal `draft` status does not exist in the schema; the entry statuses are
  `sent_to_video_editor` / `sent_to_designer`.
- **Column drops** (Tickets 5, 15) · production data counts cannot be checked from this session
  (no `DATABASE_URL` here); the operator confirms before any `DROP COLUMN` migration.
