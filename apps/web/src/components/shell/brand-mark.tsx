/**
 * The brand gradient, as it reaches the screen.
 *
 * `--accent-gradient` is the signature purple of the Sep 28 client feedback ("purple gradient +
 * white, friendly, not corporate"). It has lived in the token layer since P2D with no call site at
 * all, so the brand the client asked for rendered nowhere. These two pieces are that call site, on
 * the one surface every signed-in page carries: the mark in the shell's brand lockup and the rule
 * along the bottom edge of the sticky bar. Both reference the gradient through the
 * `.bg-brand-gradient` utility (apps/web/src/app/globals.css), never a colour literal.
 *
 * Both are deliberately text-free, and that is a measured decision, not timidity. The dark palette's
 * gradient is a pair of light purples and the light palette's a pair of dark ones, so the two
 * themes want opposite ink and no single text token clears 4.5:1 against both (`--bg` manages a
 * comfortable ratio on the light gradient and under 4:1 on the dark one; `--bg-deep` is the mirror
 * image). The wordmark therefore keeps `text-text` on `bg-surface`, where it already passed, and
 * the gradient carries no glyph in either theme. The same measurement is why the primary CTA in
 * `@tas/ui` stays flat `bg-accent`.
 */

/** The gradient mark plus the product wordmark. The link wrapper belongs to whoever places it. */
export function BrandLockup() {
  return (
    <span data-slot="shell-brand-lockup" className="flex items-center gap-2">
      <span
        aria-hidden="true"
        data-slot="shell-brand-mark"
        className="bg-brand-gradient size-7 shrink-0 rounded-card"
      />
      <span className="sm:hidden">TAS</span>
      <span className="hidden sm:inline">TAS Creative Platform</span>
    </span>
  );
}

/**
 * The gradient hairline along the bottom edge of the shell's top bar. Absolute inside the bar's own
 * box, so it never overlaps the page: `position: sticky` already makes the header the containing
 * block. The bar keeps its `border-line` hairline underneath — nothing is replaced, the brand rule
 * sits on top of it.
 */
export function BrandRule() {
  return (
    <span
      aria-hidden="true"
      data-slot="shell-brand-rule"
      className="bg-brand-gradient pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
    />
  );
}
