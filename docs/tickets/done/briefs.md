# Creative Briefs · One record per creative asset (PRD §5.10)

- Pages: `/app/briefs` (list) and `/app/briefs/<id>` (three-column detail), sidebar section `briefs`
- Pattern: Concepts for source + detail route + rail, Personas/Angles for actions + fields. Depends on `demoConcepts`, `@tas/domain/state`, `@tas/ui`

## Why

PRD §5.10: "The heart of the system. One record per creative asset… Name — **auto-generated** (see §7)… Concept (link)… **Optional**". §7 fixes
`{FUNNEL}{FORMAT}{NUMBER}-BATCH#-CONCEPT NAME-VARIATION#-(PRODUCT)` and "Version is picked from a dropdown and written into the name automatically";
§8: "a Creative Brief must be able to exist **without** a parent concept"; §9 opens the client track only once Internal Status = Approved.

## Acceptance criteria

1. `/app/briefs` renders inside the app shell with no frame, padding or background of its own; the sidebar's Creative
   Briefs section gets an `href` in `nav.ts` and `briefsPath` in `routes.ts` in the same change, its `SoonChip` is gone,
   and it is active on both the list and the detail page.
2. The list renders all 6 seeded briefs with exactly these columns in order: **Name** (`font-mono`), **Concept**,
   **Type**, **Priority**, **Assignee**, **Internal Status**. A standalone brief shows a "Standalone" chip in the
   Concept cell, never a blank or a bare em dash.
3. A row navigates to `/app/briefs/<id>` — a real route segment, NOT a side panel or dialog: the URL becomes the detail
   path, the list is gone, Back restores it. An unknown id renders `notFound()`.
4. The detail header shows the auto-generated name in `font-mono` under `data-slot="brief-name"` with a copy button
   (`data-slot="brief-name-copy"`) that writes it to the clipboard and confirms in place. No text field anywhere on the
   page holds the name.
5. The name is built only by a pure, unit-tested `creativeName({ funnel, format, number, batch, conceptName, version, product })` in
   `packages/domain/src/creatives/`, per §7: funnel letter T/R/A, format letter V/S/C/M, per-brand number, batch, concept name (or the standalone
   slug when there is no concept), version, optional product suffix. Page, fixtures and `seed()` all call it; no component concatenates the string.
6. The detail page is a three-column grid — `data-slot="brief-left"` ~30%, `data-slot="brief-centre"` ~45%,
   `data-slot="brief-right"` ~25% — stacking to one column below the shell's md breakpoint.
7. Left column, in order: the linked **Concept** as a context card (`data-slot="brief-concept"`: name, batch, angle,
   theme, linking to `/app/concepts/<id>`) or a "Standalone" `StatusChip` when `conceptId` is null; **Assignee**;
   **Type** (Video / Static / Carousel / Motion Image); **Version** dropdown (V1…V6) that updates the name in criterion
   4 immediately with no round trip; **Priority** chip (Static High 12h / Static Average 24h / Video High 24h / Video Average 48h);
   and a **Dimensions** grid (`data-slot="brief-dimensions"`) showing the §8 defaults for the brief's type — 4:5, 1:1 and 9:16 for
   video, 1:1 and 9:16 for static.
8. Centre column: three rich-text sections in order — **Brief to Design**, **Script or Ad Content**, **Elements we are
   Testing** — each showing the em dash from `fields.ts` when empty.
9. Below them an **Inspiration** section (`data-slot="brief-inspiration"`). A pure, unit-tested `inspirationLink(url)` in
   `packages/domain/src/creatives/` classifies Meta Ad Library, YouTube, TikTok and Instagram URLs (plus `other`) and
   returns the embed URL; each link renders an inline preview (iframe when embeddable, a labelled card otherwise) plus
   the original href. An unrecognised or malformed URL degrades to the card, never throws.
10. Right column: `TwoTrackApproval` from `@tas/ui` with `clientOnly={false}` under `data-slot="brief-rail"`, fed the
    brief's internal and client status, the gate left to `isClientTrackOpen`; then a **QA checklist**
    (`data-slot="brief-qa"`) of exactly three checkboxes — Video Editor QA, Graphic Designer QA, Creative Strategist QA — and a
    **Spelling Feedback** panel (`data-slot="brief-spelling"`) showing the stored AI text with a "Re-run AI check" button.
11. Every status label and chip tone comes from `@tas/domain/state` (`internalStatusFor`, `chipTone`) via `StatusChip`;
    Type, Priority, Version, Funnel and Dimension vocabularies are constants in `@tas/domain/creatives`, never literals
    in a component. No magic strings, no inline status logic.
12. In demo mode every write — QA checkboxes, the Version save, "Re-run AI check", status advance, "New brief" — is
    disabled through `DisabledWrite` + `disabledWriteClassName` from `@tas/ui` with a tooltip saying why, and each
    action refuses before any validation, actor lookup or connection, returning a typed result and never throwing (copy
    `angles/actions.ts`).
13. `loadBriefs()` / `loadBriefById()` in `apps/web/src/lib/briefs-source.ts` copy `personas-source.ts`: demo mode reads
    `demoBriefs` from `@tas/db` and constructs **no** database client even when `DATABASE_URL` is set; live mode opens
    Neon per call and closes it in a `finally`. A connect-spy test proves it.
14. `demoBriefs` in `packages/db/src/demo-data.ts` has **6 briefs** for the demo brand, each with a hardcoded uuid and fixed timestamps, in six
    different internal statuses (at least one `approved` so the client track is open on exactly that one, and at least one before `ad_submitted`),
    covering all four types, **at least one standalone** with `conceptId: null`, and at least two carrying inspiration links across different
    providers. The same six rows appear in the demo pages and in `seed(db)`.
15. Colours go through the token layer only (no hex in a component); every rounded control is `rounded-input` or
    `rounded-card`, no button `rounded-full`, every chip `StatusChip`.
16. `tsc --noEmit` and vitest are clean for `@tas/web`, `@tas/db` and `@tas/domain`, and `apps/web/e2e/briefs.spec.ts`
    covers: six rows with the standalone chip, a row click landing on `/app/briefs/<id>`, the monospace name and working copy button,
    the Version dropdown changing the name with no navigation, the three columns, one inspiration preview, both tracks in the rail,
    and the QA checkboxes and "Re-run AI check" disabled in demo mode.

Out of scope: client interface, Client's Comments, Copywriting links, uploads, Design File / Design Link, Platform, Source,
Performance, frame comments, CSV upload, propagation, post-approval dimension variants.

## Files each agent touches

- domain: `packages/domain/src/creatives/{index.ts,creative-name.ts,creative-name.test.ts,inspiration.ts,inspiration.test.ts,vocabulary.ts,vocabulary.test.ts}`, `packages/domain/src/index.ts`, `packages/domain/package.json` (`./creatives` export)
- db: `packages/db/src/schema/briefs.ts` (nullable `conceptId`, type, version, priority, assignee, three rich-text columns, `inspirationLinks`, QA flags, `spellingFeedback`, `internalStatus`, `clientStatus`), a generated migration in `packages/db/drizzle`, `packages/db/src/demo-data.ts` (six briefs), `packages/db/src/briefs.ts` + `briefs.test.ts` (`listBriefs`, `getBriefById`, `insertBrief`, `updateBrief`, all through `withBrand`), `packages/db/src/{index.ts,seed.ts}`
- app: `apps/web/src/lib/briefs-source.ts` + `briefs-source.test.ts`, `apps/web/src/app/app/briefs/{page.tsx,briefs-workspace.tsx,fields.ts,actions.ts,actions.test.ts}`, `apps/web/src/app/app/briefs/[briefId]/{page.tsx,brief-detail.tsx,brief-name.tsx,inspiration-list.tsx,qa-checklist.tsx}`, `apps/web/src/lib/routes.ts` (`briefsPath`, `briefPath(id)`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/briefs.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); the db tests run on PGlite.

## Notes from the app agent (page stage)

- **No embed dependency was added.** Every inspiration preview is built from the parsed URL by
  `inspirationLink` in `@tas/domain/creatives`, exactly as the Angles page builds its cards: an
  iframe where the provider allows framing (YouTube, TikTok, Instagram) and a labelled card where it
  does not (the Meta Ad Library sends `X-Frame-Options`). A real embed library — oEmbed lookups,
  provider SDKs, thumbnails fetched at write time — is a later decision and would need an entry in
  `docs/decisions.md` with its cost.
- **"Re-run AI check" has no Server Action.** Criterion 12 only requires it to be disabled in demo
  mode; it is disabled in live mode too, with its own hint, because nothing is behind it. The
  spelling pass belongs in an Inngest job (CLAUDE.md: never call an external API from a request
  handler), so wiring it is its own ticket.
- **"New brief" is disabled in both modes** for the same reason: `createBriefAction` is written and
  tested, but the create FORM is not in this ticket's file list, so the button would have nothing to
  submit. The list's empty state offers the same control, with the same hint.
- **The PRD §7 product suffix has no column.** It lives only inside `creative_briefs.name`, so the
  detail page reads it back with `productSuffixOf` (`fields.ts`, unit tested) and resubmits it,
  which is what stops a save of a standalone brief from silently dropping it. If the suffix is ever
  edited by a user it needs a column of its own.
- **Breakpoints.** The three columns are 30/45/25 side by side from `xl`, drop the rail beneath the
  other two at `md` (three columns squeeze the stepper past reading in the shell's content width),
  and stack to one column below `md`, which is what criterion 6 fixes.
