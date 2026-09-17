# Client Queue · Kanban of the client approval track (PRD §9, §10)

- Page: `/app/queue/client`, sidebar section `client-queue` (Approvals group, currently `SoonChip`)
- Pattern: the Internal Queue board (`app/app/queue/internal`) for shape, `personas-source.ts` for the demo branch.
  Depends on `demoBriefs`, `@tas/domain/state`, `@tas/ui`

## Why

PRD §9: "**Client Status** (only visible/actionable once we've internally approved): Pending for Approval → Approved /
Revisions Needed → Launched… A creative appears in the client's interface **only** when Internal Status = Approved and
Client Status = Pending for Approval." PRD §10 gives the client exactly two editable things on the Creatives page:
"Client Status, comments / annotations".

## Acceptance criteria

1. `/app/queue/client` renders inside the app shell with no frame, padding or background of its own; `clientQueuePath`
   lands in `apps/web/src/lib/routes.ts` (asserted in `routes.test.ts`) and the `client-queue` section in
   `apps/web/src/components/shell/nav.ts` gets that `href` in the same change, its `SoonChip` disappears, and the section
   is the active one on the page. The page is a server component shaped exactly like
   `app/app/queue/internal/page.tsx`: it resolves every label and tone and hands a plain item array down.
2. The board is the same shape as the Internal Queue — a horizontal strip of columns, each headed by a status `label`
   from `@tas/domain/state` plus a count, cards inside — but grouped by CLIENT status. Columns come only from a pure,
   unit-tested `clientQueueColumns()` in `packages/domain/src/state/queue-columns.ts`: `CLIENT_STATUS` in PRD §9 order
   with `launched` removed, exported from `packages/domain/src/state/index.ts`. No component lists a client status,
   compares one to a literal, orders them or invents one; `CLIENT_STATUS` itself and `CLIENT_TRANSITIONS` are unchanged.
3. Grouping is a pure, unit-tested `groupByClientStatus()` beside `groupByInternalStatus` in the same module: every
   eligible row lands in exactly one column by its stored `clientStatus`, an unknown value falls into the same "other"
   column `groupByInternalStatus` already uses, and an empty column still renders with a count of 0 and the muted empty
   note the Internal Queue uses.
4. Eligibility is PRD §9's rule and nothing else: a row appears only when `isClientTrackOpen(row.internalStatus)` is true
   AND its client status is not `launched`. The check is a pure, unit-tested `isOnClientQueue(row)` in
   `apps/web/src/app/app/queue/client/fields.ts` that calls `isClientTrackOpen` from `@tas/domain/state` — no component
   compares `internalStatus` to `'approved'`, and no internal status is ever rendered on this page (it is team-only).
5. Of the 6 seeded briefs exactly one is internally Approved, so the board shows one card, in Pending for Approval, and
   the remaining column(s) render empty. The page says in one muted line why the board is short (internal sign-off gates
   it) rather than looking broken. No fixture is added or edited: `packages/db/src/demo-data.ts` and
   `packages/db/src/briefs.ts` are untouched, and the rows come from the existing `loadBriefs()`.
6. The data comes from `apps/web/src/lib/client-queue-source.ts`, copied in shape from `personas-source.ts` /
   `internal-queue-source.ts`: demo mode returns the fixtures through `loadBriefs()` with NO database client constructed
   even when `DATABASE_URL` is set, live mode goes through the brand-scoped helper. `client-queue-source.test.ts` proves
   it with an injected connection factory that throws if it is ever called (the connect spy).
7. A card (`data-slot="client-queue-card"`) shows the creative **name** in `font-mono`, the **thumbnail** from
   `briefThumbnail`, the **assignee**, and the client-status chip via `StatusChip` — all imported from the existing
   Internal Queue / `@tas/ui` code, never re-implemented. Clicking the card or pressing Enter/Space navigates to
   `briefPath(id)`.
8. Each card carries two write controls, `data-slot="client-queue-approve"` and
   `data-slot="client-queue-request-revisions"`, labelled "Approve" and "Request Revisions". In demo mode both are
   wrapped in `DisabledWrite` with `disabledWriteClassName` and a tooltip that says writes are off in demo mode, are
   `disabled`, and are not `rounded-full`.
9. Both controls call Server Actions in `apps/web/src/app/app/queue/client/actions.ts`. In demo mode each refuses with a
   typed `{ ok: false, error: DEMO_MUTATION_REFUSED }` result BEFORE any validation, env read or connection, and never
   throws; a unit test asserts the refusal for both actions. The legality of a move is `canTransitionClient` from
   `@tas/domain/state`, never inline logic.
10. Colours, radii and fonts come from the token layer only — `bg-surface2/3`, `border-line`, `text-text2/3/4`,
    `rounded-card`, `rounded-input`, `font-mono` — no hex in a component, every chip a `StatusChip`. The column strip
    scrolls horizontally on a narrow viewport and never forces the shell into a horizontal page scroll.
11. The client card is rendered on `/design-system` as a story module the page mounts, with both write controls in their
    disabled state, before the ticket is Done.
12. `tsc --noEmit` and vitest are clean for `@tas/web` and `@tas/domain`, and `apps/web/e2e/client-queue.spec.ts` covers:
    the client columns present in §9 order with counts, exactly one card on the board, its monospace name, thumbnail,
    assignee and client-status chip, both write buttons present and disabled with a tooltip, and a card click landing on
    `/app/briefs/<id>`.

Out of scope: comments and annotations, per-brand page/field configuration (PRD §10), the `?view=` filter, drag-and-drop, Launched creatives, concepts / copy / UGC client tracks, new fixtures, notifications, the brand switcher.

## Files each agent touches

- domain: `packages/domain/src/state/{queue-columns.ts,queue-columns.test.ts,index.ts}`
- backend: `apps/web/src/lib/{client-queue-source.ts,client-queue-source.test.ts}`,
  `apps/web/src/app/app/queue/client/actions.ts`
- app: `apps/web/src/app/app/queue/client/{page.tsx,client-queue-board.tsx,client-queue-card.tsx,fields.ts,fields.test.ts}`,
  `apps/web/src/lib/routes.ts` (`clientQueuePath`), `apps/web/src/lib/routes.test.ts`,
  `apps/web/src/components/shell/nav.ts`, `apps/web/src/app/design-system/stories/client-queue-card.stories.tsx`
- qa: `apps/web/e2e/client-queue.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database, no new fixture); the board reads `demoBriefs`
through the existing `loadBriefs()` and both writes refuse with a typed result.
