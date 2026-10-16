/**
 * The Bold redesign rollout gate (chain commit 1; docs/design/bold-redesign-spec.md, "Rollout
 * constraints (2026-10-16)"). The Bold token set ships to the TEMPLATE BRAND ONLY through the whole
 * chain: the app shell stamps `data-ui="bold"` on its root element when the active brand is the
 * parent template, and every Bold block in `packages/ui/src/styles/tokens.css` is scoped under that
 * attribute. A child brand — including demo mode, whose active brand is a child — never carries it,
 * so child brands render the current look untouched until the redesign is approved.
 *
 * The gate reads `BrandSummary.isTemplate` (resolved server-side by `loadBrandScope`), NOT a
 * `column_definitions` flag: template-seeded rows inherit to child brands and would leak the
 * redesign to every child.
 */
export const BOLD_UI_SCOPE = 'bold';

/** The `data-ui` value for the active brand — `undefined` makes React omit the attribute. */
export function uiScope(
  activeBrand: { readonly isTemplate: boolean } | null | undefined,
): typeof BOLD_UI_SCOPE | undefined {
  return activeBrand?.isTemplate === true ? BOLD_UI_SCOPE : undefined;
}
