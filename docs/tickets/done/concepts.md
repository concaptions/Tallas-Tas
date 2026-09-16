# Concepts · One Angle paired with one Theme (PRD §5.7)

- Pages: `/app/concepts` (list) and `/app/concepts/<id>` (real detail page), sidebar section `concepts`
- Pattern: Personas/Angles for source + actions + fields, Themes for the card grid (board view).
  Depends on Angles (`demoAngles`), Themes (global library), `@tas/domain/state`, `@tas/ui`

## Why

PRD §5.7: "A concept is the pairing of one Angle and one Theme… Name — **auto-generated**, do not let
anyone type it: Batch-Angle-Theme"; "everything derivable from the Angle must auto-fill". PRD §7 fixes
the format; PRD §9 opens the client track only once internal status is Approved.

## Acceptance criteria

1. `/app/concepts` renders inside the app shell with no frame, padding or background of its own; the
   sidebar's Concepts section gets an `href` in `nav.ts` and `conceptsPath` in `routes.ts` in the same
   change, its `SoonChip` is gone, and it is active on both the list and the detail page.
2. The list is URL-backed: `?view=table` and `?view=board` are the only values, table is the default
   when the parameter is absent or unrecognised, and the toggle writes it (History API, as the Angles
   panel does) so a reload or a shared link restores the view. The toggle is two controls under
   `data-slot="concepts-view-toggle"`; neither is `rounded-full`.
3. Table view has exactly five columns in this order: **Name**, **Batch**, **Angle**, **Theme**,
   **Internal Status**. Board view groups the same rows into one column per internal status in the
   order `internalStatusFor('video')` returns, each card showing name, batch and theme.
4. Both views render the same 4 concepts; every status label and chip tone comes from
   `@tas/domain/state` (`internalStatusFor`, `chipTone`) via `StatusChip`. No magic string, no inline
   status logic, no locally chosen colour.
5. A row (table) or card (board) navigates to `/app/concepts/<id>` — a real route segment, NOT a side
   panel or dialog: the URL becomes the detail path, the list is gone, Back restores it with `?view=`.
6. The detail page shows a live auto-name preview in `font-mono`, `data-slot="concept-name-preview"`,
   assembled as `Batch-Angle-Theme` from three dropdowns — **Batch** (B1…B20), **Angle**, **Theme**.
   Changing any dropdown updates it immediately with no round trip, and no text field anywhere on the
   page holds the name.
7. The formula is a pure, unit-tested function `conceptName({ batch, angleName, themeName })` in
   `packages/domain/src/concepts/` — the only place the string is built (page, fixtures, `seed()`).
8. Read-only fields auto-filled from the linked Angle, each carrying the visible label "from Angle":
   **Description**, **Pain Points**, **USP**, **Persona**, **Product**. Each renders as text, never an
   editable control, and shows the em dash from `fields.ts` when the angle or the field is missing.
   Selecting a different Angle re-fills all five.
9. Editable fields, in this order: **Category** (New / Iteration), **Concept Style** (Filming /
   Editing / AI Concept), **Formats** (Static / Video / Carousel / Motion Graphic), **Hook examples**,
   **Script idea**, **Ad Inspo** — the first three from vocabulary constants in `@tas/domain/concepts`,
   never literals in a component.
10. The detail page has a right rail, `data-slot="concept-rail"`, carrying `TwoTrackApproval` from
    `@tas/ui` with `clientOnly={false}`, fed the concept's internal and client status. The widget is
    imported, never re-implemented, and the client bar's gate is left to `isClientTrackOpen`.
11. `demoConcepts` in `packages/db/src/demo-data.ts` has **4 concepts** for the demo brand, each with
    a hardcoded uuid, fixed timestamps, a real seeded angle and a real seeded theme, and each in a
    **different** internal status strictly before `approved` — none `approved` or `launched`, so the
    client track is closed on all four. The existing concept keeps its id; the same four rows appear
    in the demo pages and in `seed(db)`.
12. In demo mode every write — the detail page's save, the status advance controls, the "New concept"
    button — is disabled through `DisabledWrite` + `disabledWriteClassName` from `@tas/ui` with a
    tooltip saying why, and each action refuses before any validation, actor lookup or connection,
    returning a typed result and never throwing (copy `angles/actions.ts`).
13. `loadConcepts()` / `loadConceptById()` in `apps/web/src/lib/concepts-source.ts` copy
    `personas-source.ts`: demo mode reads `demoConcepts` from `@tas/db` and constructs **no** database
    client even when `DATABASE_URL` is set; live mode opens Neon per call and closes it in a `finally`.
    A connect-spy test proves it; an unknown id renders `notFound()` rather than crashing.
14. Colours go through the token layer only (no hex in a component); every rounded control is
    `rounded-input`/`rounded-card`, no button `rounded-full`, every chip `StatusChip`.
15. `tsc --noEmit` and vitest are clean for `@tas/web`, `@tas/db` and `@tas/domain`, and
    `apps/web/e2e/concepts.spec.ts` covers: table is the default view, `?view=board` renders the
    board, the toggle writes the URL, a row click lands on `/app/concepts/<id>`, the name preview is
    monospace and changes with the Batch dropdown, the five "from Angle" fields are not editable, the
    right rail shows both tracks, and save is disabled in demo mode.

Out of scope: client interface, Client's Comments, Creators/Creative Brief links, CSV upload,
propagation, Production Status, and creative naming (§7 creatives).

## Files each agent touches

- domain: `packages/domain/src/concepts/{index.ts,concept-name.ts,concept-name.test.ts,vocabulary.ts,vocabulary.test.ts}`, `packages/domain/src/index.ts`, `packages/domain/package.json` (`./concepts` export)
- db: `packages/db/src/schema/concepts.ts` (`formats`, `adInspo`, `internalStatus`, `clientStatus` columns), a generated migration in `packages/db/drizzle`, `packages/db/src/demo-data.ts` (four concepts), `packages/db/src/concepts.ts` + `concepts.test.ts` (`listConcepts`, `getConceptById`, `insertConcept`, `updateConcept`, all through `withBrand`), `packages/db/src/{index.ts,seed.ts}`
- app: `apps/web/src/lib/concepts-source.ts` + `concepts-source.test.ts`, `apps/web/src/app/app/concepts/{page.tsx,concepts-workspace.tsx,view-toggle.tsx,concept-board.tsx,fields.ts,actions.ts,actions.test.ts}`, `apps/web/src/app/app/concepts/[conceptId]/{page.tsx,concept-detail.tsx,name-preview.tsx}`, `apps/web/src/lib/routes.ts` (`conceptsPath`, `conceptPath(id)`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/concepts.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); the db tests run on PGlite.
