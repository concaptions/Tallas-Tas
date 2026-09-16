# TICKET-DS-05 · Design system reference page

- Owner: frontend (`apps/web/src/app/(dev)/design-system/**`)
- Size: M
- Depends on: TICKET-DS-04, TICKET-013, TICKET-008
- PRD: §11 (admin), handoff "TICKET-DS-05"

## Why

One page is the style reference for every person and sub-agent that touches UI. Every component must
match it; deviations need a decision entry.

## Acceptance criteria

1. `apps/web/src/app/(dev)/design-system/page.tsx` behind `requireAdmin()` (TICKET-008); the `(dev)`
   layout applies the guard once for every design-system route, including the DS-01, DS-03 and DS-04 pages.
   A non-admin gets the app's forbidden page; signed-out users are redirected by the middleware.
2. Top of page, verbatim: "This page is the style reference. Every component in the product must match.
   Deviations require a decision entry in `docs/decisions.md`."
3. Sections, in order: (1) palette swatches for both themes side by side (dark and light rendered in two
   scoped containers with `data-theme` set, not by toggling the page); (2) typography scale (sans
   400/500/600 and mono 400/500 at every size used by the product so far); (3) primitives with all their
   variants: `StatusChip` (six tones), `StepRow` (three states, badge), `Button` (every shadcn variant and
   size in use), `Input`, `Select`, and a right panel (shadcn `Sheet` opening from the right) each shown in
   default, hover-described, disabled and error states where applicable; (4) `TwoTrackApproval` mounted
   three ways: pre-Approved internal (`ad_submitted`), post-Approved internal (`approved`), and
   `clientOnly`; (5) links to the sub-pages `/design-system/tokens`, `/two-track`, `/status`.
4. Every section has an `id` anchor and a sidebar table of contents. The page works at phone width without
   horizontal scroll.
5. Playwright `apps/web/e2e/design-system.spec.ts`: as the test admin, the page renders all five sections
   (heading assertions) and `toHaveScreenshot('design-system-dark.png')` / `'-light.png'` baselines are
   committed; as a non-admin test user the page is refused.
6. `Input` and `Select` come from TICKET-013; `Sheet` is added to `packages/ui` (shadcn source, Radix dialog
   already present) with the token aliases from DS-01 (no hex); `docs/decisions.md` lists any package added.
7. CLAUDE.md governance rule 4 ("render on the /design-system page before Done") is satisfied by this
   ticket for every primitive that exists so far.

## Gated criteria (D-008)

none.

## Files touched

`apps/web/src/app/(dev)/design-system/**`, `apps/web/src/app/(dev)/layout.tsx`,
`packages/ui/src/components/sheet.tsx`, `apps/web/e2e/design-system.spec.ts`,
`apps/web/e2e/__screenshots__/*`, `docs/decisions.md`.

## Notes

- The screenshot baselines are the visual contract; a later ticket that changes a primitive must
  regenerate them deliberately and say so in its report.
