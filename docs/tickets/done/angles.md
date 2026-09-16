# Angles · The hypothesis written from a persona (PRD §5.6)

- Page: `/app/angles`, sidebar section `angles` (currently `href`-less, so it renders with a `SoonChip`)
- Pattern: Personas, mirrored file for file (Products is the second reference)
- Depends on: Personas (`personas-source.ts`, panel pattern), Products (dropdown source), TICKET-005 (`withBrand`)

## Why

PRD §5.6: "Written by the creative strategist from research. Angle Name, Type …, Persona (link),
Product (link), … Description (this is the hypothesis), Pain Points, USP, Formats to create (Static /
Video / Carousel / Motion Graphic), Ad Inspo …". PRD §5.4 is the table angles link to: personas are
"Built from research, then referenced by angles", so Persona is a link to a real row, never free text.

## Acceptance criteria

1. `/app/angles` renders inside the app shell with no frame, padding or background of its own, and the
   sidebar's Angles section is active on it (`href` added to `nav.ts` and `anglesPath` to `routes.ts`
   in the same change, and its `SoonChip` is gone).
2. The table has exactly five columns, in this order: **Name**, **Persona**, **Product**,
   **Formats**, **Updated**. No other column.
3. Persona and Product each render as a single chip carrying the linked row's name. Both links are
   nullable: an angle with no persona or no product shows the em dash from `fields.ts`, never an empty
   chip, a blank cell or the raw id.
4. Formats renders one chip per selected format, in the fixed order Static, Video, Carousel, Motion
   Graphic. No formats renders the em dash. Format values come from a shared constant in `@tas/db`
   (a pg enum plus its exported tuple, exactly as `awarenessStages` does) — no string literal in a
   component, no inline list in the panel.
5. Rows are the brand's live angles, newest edit first. Updated is a relative label rendered on the
   server with one `now` (`relativeTime` / `absoluteTime`), the absolute time in `title`.
6. Clicking a row opens a detail panel in the Personas pattern: fixed to the right edge at 60% width,
   NOT a modal — no backdrop, the table stays visible and clickable — with the selected id in
   `?angle=` written through the History API, so a refresh reopens the panel and the URL is
   shareable. A close control clears the parameter.
7. The panel shows, in this order: **Description** (labelled as the hypothesis), **Pain Points**,
   **USP**, **Format tags**, **Ad Inspiration**. Long text fields render whole, not truncated.
8. Ad Inspiration is a list of links rendered as rich link previews: each entry is a card with the
   hostname, the link title (the URL's last path segment when nothing better is stored) and the full
   URL, the whole card being the anchor, `target="_blank"` with `rel="noreferrer noopener"`. Zero
   links renders an explicit empty line, not a blank region.
9. Persona and Product are `<select>` dropdowns in the panel, populated from the brand's personas and
   products (loaded by the page, passed in as props) plus an explicit "None" option for the nullable
   case. Neither field accepts typed text anywhere in the UI.
10. In demo mode every write on this page — the panel's save and the "New angle" button — is disabled
    through `DisabledWrite` + `disabledWriteClassName` from `@tas/ui` with a tooltip saying why, and
    the action itself refuses before any validation, actor lookup or connection, returning a typed
    result and never throwing (copy `personas/actions.ts`).
11. `loadAngles()` in `apps/web/src/lib/angles-source.ts` copies `personas-source.ts`: demo mode reads
    `demoAngles` from `@tas/db` and constructs **no** database client even when `DATABASE_URL` is set;
    live mode opens Neon per call and closes it in a `finally`. A connect-spy unit test proves the
    demo branch never calls `connect`.
12. `demoAngles` in `packages/db/src/demo-data.ts` has **5 angles**, spread across the 3 seeded
    personas (at least one persona carries two), each with hardcoded uuid and fixed timestamps, so the
    same five rows appear in the demo page and in `seed(db)`. The existing two angles keep their ids
    (the seeded concept's auto-generated name is built from `bodyClockAngle`).
13. Colours go through the token layer only (no hex in a component), every rounded control uses
    `rounded-input` / `rounded-card`, no button is `rounded-full`, chips are `StatusChip` from
    `@tas/ui`. Angles have no status of their own in this scope: none is invented, and no label is
    written inline instead of coming from `@tas/domain/state`.
14. `pnpm --filter @tas/web exec tsc --noEmit`, `pnpm --filter @tas/db exec tsc --noEmit` and the
    vitest runs for both packages are clean, and `apps/web/e2e/angles.spec.ts` covers: five rows, the
    five columns, opening a row sets `?angle=`, reload keeps the panel open, persona and product are
    `select` elements, and save is disabled in demo mode.

Out of scope: Type multi-select, Collection link, Potential, Winning, Internal Notes, Client Notes,
CSV upload, creating angles from a persona page, and anything client-facing or concept-related.

## Files each agent touches

- schema/db: `packages/db/src/schema/angles.ts` (`formats`, `adInspo` columns + format pg enum), a
  generated migration in `packages/db/drizzle`, `packages/db/src/demo-data.ts` (five angles),
  `packages/db/src/angles.ts` + `angles.test.ts` (`listAngles`, `getAngleById`, `insertAngle`,
  `updateAngle`, all through `withBrand`), `packages/db/src/index.ts`, `packages/db/src/seed.ts`
- app: `apps/web/src/lib/angles-source.ts` + `angles-source.test.ts`,
  `apps/web/src/app/app/angles/{page.tsx,angles-workspace.tsx,angle-panel.tsx,fields.ts,actions.ts,actions.test.ts}`,
  `apps/web/src/lib/routes.ts` (`anglesPath`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/angles.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); the db tests run on PGlite.
