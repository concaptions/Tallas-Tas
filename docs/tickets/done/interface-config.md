# Interface Config · Which pages and fields the client sees (PRD §10)

- Page: `/app/interface-config`, sidebar section `interface-config` in the `settings` group
  (`href`-less today, so it renders with a `SoonChip`). Pattern: Personas, mirrored file for file.

## Why

PRD §10: "the interface must be configurable per client, at two levels: **Which pages appear**…
**Which fields appear.** Some clients want the full script on a concept card, some don't. Today we
hack this base by base; it should be a setting."

## Acceptance criteria

1. `/app/interface-config` renders inside the app shell with no frame, padding or background of its
   own, and the sidebar's Interface Config section is active on it (`interfaceConfigPath` added to
   `routes.ts` and `href` added to `nav.ts` in the same change, so its `SoonChip` is gone).
2. The page is a two-column layout, `data-slot="config-tree"` on the left and
   `data-slot="config-preview"` on the right. It stacks to one column below the `lg` breakpoint with
   the tree first. Both columns use `rounded-card` and `border-line`.
3. The left column is a tree: one row per page (`data-slot="page-node"`) with its field rows nested
   underneath (`data-slot="field-node"`). Rows are `StepRow` from `@tas/ui`; nesting is indentation
   plus `border-line`, never a second border style or a `<table>`.
4. Every node carries a toggle (`data-slot="config-toggle"`, `role="switch"` with `aria-checked`,
   `rounded-input`, never `rounded-full`) labelled by its page or field name.
5. Toggling a field off removes that field from the preview immediately — client state only, no
   server round trip, no navigation, no reload. Toggling it back on restores it in its seeded order.
6. Toggling a page off removes the whole page from the preview (its tab and its card) and visually
   mutes its field rows in the tree; its own field toggles keep their values, so switching the page
   back on restores exactly the previous field set.
7. The right column previews the client interface: a tab strip of the enabled pages and, for the
   Concepts tab, one concept card (`data-slot="preview-concept-card"`) rendering only the enabled
   fields with fixture values. The other four tabs render a short placeholder body; no editing, no
   writes, no client-track logic is implemented in the preview.
8. Seeded from PRD §10 defaults, from one pure module — the five pages in order **Concepts,
   Creatives, Copywriting, UGC Management, Partnership Ads Tracking**, all enabled — and the concept
   card's default fields in order: **Batch, Category, Concept name, Concept Style, Angle, Theme,
   Product, Description (hypothesis), Pain Points, USP, Persona, Hook examples**, all enabled.
9. Those defaults live in `packages/domain/src/interface/` as `const` tuples plus
   `defaultInterfaceConfig()`, a pure function with no I/O, re-exported from `@tas/domain`. No page,
   field label or key is written as a literal inside a component.
10. Any status label rendered by the page or the preview comes from `@tas/domain/state`; the page
    invents no status of its own and writes no label inline.
11. `loadInterfaceConfig()` in `apps/web/src/lib/interface-config-source.ts` copies
    `personas-source.ts`: demo mode reads `demoInterfaceConfig` from `@tas/db` and constructs **no**
    database client even when `DATABASE_URL` is set; live mode opens Neon per call, resolves the
    actor's brand and closes the handle in a `finally`. A connect-spy unit test proves the demo
    branch never calls `connect`. The result carries `source: 'database' | 'demo'` like the others.
12. `demoInterfaceConfig` in `packages/db/src/demo-data.ts` is exactly `defaultInterfaceConfig()` for
    the seeded brand, so the demo page and a seeded database render the same tree and preview.
13. In demo mode the page's "Save configuration" button is disabled through `DisabledWrite` +
    `disabledWriteClassName` from `@tas/ui` with the tooltip "Sign in required to save changes", and
    `saveInterfaceConfig` in `actions.ts` refuses before any validation, actor lookup or connection,
    returning a typed result carrying `DEMO_MUTATION_REFUSED` and never throwing (copy
    `personas/actions.ts`). Toggling stays fully interactive while Save is disabled.
14. Colours go through the token layer only (no hex in a component), rounded controls use
    `rounded-input` / `rounded-card`, no button is `rounded-full`, every chip is `StatusChip` and
    every "not built yet" marker is `SoonChip` from `@tas/ui`.
15. `tsc --noEmit` and vitest are clean for `@tas/web`, `@tas/domain` and `@tas/db`, and
    `apps/web/e2e/interface-config.spec.ts` covers: both columns render, five page nodes and twelve
    field nodes appear, toggling "Hook examples" off removes it from the preview card with no reload
    and toggling it back restores it in order, toggling "Copywriting" off removes its preview tab,
    and "Save configuration" is disabled in demo mode.

Out of scope: persisting a configuration (the live-mode write path beyond the refusing action stub),
a schema table or migration, per-field config on any page other than the concept card, parent/child
interfaces, role or access checks, client login, and editing anything from the preview.

## Files each agent touches

- domain: `packages/domain/src/interface/{index.ts,config.ts,config.test.ts}`,
  `packages/domain/src/index.ts`
- db: `packages/db/src/demo-data.ts` (`demoInterfaceConfig`), `packages/db/src/index.ts`
- app: `apps/web/src/lib/interface-config-source.ts` + `interface-config-source.test.ts`,
  `apps/web/src/app/app/interface-config/{page.tsx,interface-config-workspace.tsx,config-tree.tsx,config-preview.tsx,fields.ts,actions.ts,actions.test.ts}`,
  `apps/web/src/lib/routes.ts` (`interfaceConfigPath`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/interface-config.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database).
