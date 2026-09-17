/**
 * Why the Recipient column is text and not a picker, in one sentence the whole platform shares.
 *
 * PRD §12 closes with "Routing comes from the team assignment made at onboarding (§3) — filled once,
 * never rebuilt by hand", and ticket criterion 4 turns that into a rule about the table: the
 * Recipient cell is "read-only text naming the role(s) the DM goes to … never editable, never a
 * control — that is what criterion 2's note is about". A read-only column with no explanation reads
 * like a missing feature, so the note above the table is what makes the design legible.
 *
 * The sentence lives here rather than in `page.tsx` for the reason every other string in this package
 * does: the page renders it today, and the day §12's DMs actually send, the email footer that says
 * "you are getting this because…" says the same thing rather than a second, slightly different
 * explanation written months later.
 *
 * Pure: a function of nothing, returning a constant. It takes no arguments on purpose — there is no
 * per-brand wording, because the rule is not per brand.
 */

/**
 * The fixed note that sits above the table, `data-slot="routing-note"`.
 *
 * One short paragraph, no markup: the page wraps it in a `rounded-card` `border-line` `bg-surface2`
 * block in `text-text3` and renders the `teamPath` link after it, so no colour, radius or `href`
 * decision leaks into this package.
 */
export const NOTIFICATION_ROUTING_NOTE =
  'Recipients come from the team assignment made at onboarding, not from this page. ' +
  'Each trigger below sends a Slack DM to whoever holds that role on this brand, so changing ' +
  'who is assigned changes who is notified — there is nothing to pick here.';

/** The anchor text of the note's link to the Team page, so the component writes no copy at all. */
export const NOTIFICATION_ROUTING_LINK_LABEL = 'Manage team assignment';

/**
 * The routing note. A function rather than a bare constant because every other rule the pages read
 * out of this package is called, and because a caller that wants the sentence should not have to
 * care whether it is stored as one string or assembled from two.
 */
export function routingNote(): string {
  return NOTIFICATION_ROUTING_NOTE;
}
