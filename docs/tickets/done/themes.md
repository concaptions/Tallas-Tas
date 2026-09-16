# Themes · The global creative library (PRD §5.5)

- Page: `/app/themes`, sidebar section `themes` (`href`-less today, so it renders with a `SoonChip`).
  Pattern: Personas and Angles, mirrored file for file. Cards, not a table — a library, not a queue.
  Depends on `schema/themes.ts` (exists, `themes_global` check) and `demoThemes` (2 rows today).

## Why

PRD §5.5: "the theme library is shared across every brand in the platform… In Airtable each base has
its own disconnected Themes table." Three kinds: Frameworks, Production styles, Seasonal hooks.

## Acceptance criteria

1. `/app/themes` renders inside the app shell with no frame, padding or background of its own, and the
   sidebar's Themes section is active on it (`themesPath` added to `routes.ts` and `href` added to
   `nav.ts` in the same change, so its `SoonChip` is gone).
2. A GLOBAL badge sits at the top of the page, above the cards and visually prominent: `font-mono`,
   `warn` tone through the token layer, carrying the word `GLOBAL` plus one line of explanation that
   this library is shared by every brand. It is `data-slot="global-badge"`, and its tone comes from
   the same token variables `StatusChip` uses — no hex, no `rounded-full`.
3. Themes render as a responsive grid of cards (`data-slot="theme-card"`), never a `<table>` or a
   row list. Each card uses `rounded-card` and `border-line`.
4. Every card carries exactly three things in this order: the theme **name**, a **category chip**
   (`StatusChip`, one fixed tone per category), and a **"used by N brands"** line in `text-text3`.
   Singular reads "used by 1 brand"; zero reads "used by no brands", never "0 brands".
5. `usedByBrandCount` is the number of DISTINCT brands whose concepts link to that theme, computed in
   the data layer (not a component) and carried on the row type. Concept links are nullable, so a
   theme with no concepts is a valid row with count 0.
6. A filter chip row offers exactly **Framework**, **Production Style**, **Seasonal**, plus an "All"
   chip. Selecting one narrows the grid; the selection lives in `?category=` written through the
   History API, so a refresh keeps it. Labels come from the shared `themeCategories` tuple in
   `@tas/db` — no string literal in a component.
7. `themeCategories = ['Framework', 'Production Style', 'Seasonal'] as const` plus its `pgEnum` live in
   `packages/db/src/schema/enums.ts` exactly as `angleFormats` does, and `themes.category` is a
   not-null column on that enum with a generated migration.
8. A "New theme" button opens a create form (a `Dialog` from `@tas/ui`) with Name, Category and Notes.
   The theme name is typed by the strategist — it is a real field, not an auto-generated name.
9. In demo mode the "New theme" button and the form's save are disabled through `DisabledWrite` +
   `disabledWriteClassName` from `@tas/ui`, tooltip "Sign in required to save changes", and
   `createTheme` refuses before any validation, actor lookup or connection, returning a typed result
   carrying `DEMO_MUTATION_REFUSED` and never throwing (copy `personas/actions.ts`).
10. `loadThemes()` in `apps/web/src/lib/themes-source.ts` copies `personas-source.ts`: demo mode reads
    `demoThemes` from `@tas/db` and constructs **no** database client even when `DATABASE_URL` is set;
    live mode opens Neon per call and closes it in a `finally`. A connect-spy unit test proves the
    demo branch never calls `connect`.
11. Themes are GLOBAL: `listThemes(db)` takes no `brandId`, never goes through `withBrand`, and rows
    are written with `brandId: null`. A db test asserts an insert carrying a brand is rejected by the
    `themes_global` constraint.
12. `demoThemes` in `packages/db/src/demo-data.ts` has **6 themes** spread across the three categories
    (at least one each; the PRD names Problem/Solution, Ideal Gift for X, Green Screen, UGC Mashup,
    Yapper Style, Holiday Gifting, World Cup). The two existing themes keep their uuids — the seeded
    concept's auto-generated name is built from `problemSolutionTheme` — and every new row has a
    hardcoded uuid and fixed timestamps, so demo rows and `seed(db)` rows are identical.
13. Colours go through the token layer only (no hex), rounded controls use `rounded-input` /
    `rounded-card`, no button is `rounded-full`, every chip is `StatusChip`. Themes have no
    workflow status: none is invented, no label is written inline.
14. `pnpm --filter @tas/web exec tsc --noEmit`, `pnpm --filter @tas/db exec tsc --noEmit` and the
    vitest runs for both packages are clean, and `apps/web/e2e/themes.spec.ts` covers: the GLOBAL
    badge is visible, six cards render, each shows a category chip and a "used by" line, the three
    category chips filter the grid and set `?category=`, reload keeps the filter, and "New theme" is
    disabled in demo mode.

Out of scope: Reference Links editing, Attachments, editing or deleting an existing theme, a detail
panel, CSV upload, and anything concept-related beyond reading the counts.

## Files each agent touches

- schema/db: `packages/db/src/schema/enums.ts` (`themeCategories`), `packages/db/src/schema/themes.ts`
  (`category`), a generated migration in `packages/db/drizzle`, `packages/db/src/demo-data.ts` (six
  themes), `packages/db/src/themes.ts` + `themes.test.ts` (`listThemes`, `insertTheme`, the brand-count
  aggregate), `packages/db/src/index.ts`, `packages/db/src/seed.ts`
- app: `apps/web/src/lib/themes-source.ts` + `themes-source.test.ts`,
  `apps/web/src/app/app/themes/{page.tsx,themes-workspace.tsx,theme-card.tsx,new-theme-dialog.tsx,fields.ts,actions.ts,actions.test.ts}`,
  `apps/web/src/lib/routes.ts` (`themesPath`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/themes.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); the db tests run on PGlite.
