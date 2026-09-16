import { StatusChip } from '@tas/ui';

import { GLOBAL_BADGE_LABEL, GLOBAL_BADGE_NOTE, GLOBAL_BADGE_TONE } from './fields';

/**
 * The GLOBAL badge that opens the Themes page (PRD §5.5, CLAUDE.md non-negotiable 3).
 *
 * It sits ABOVE the heading rather than beside it because it is not a decoration on the title: it
 * is the one fact a strategist has to carry into every edit on this page. Every other table in the
 * platform is per-brand and seeded from the parent template; this one is a single shared library,
 * so a theme added here is in every client's workspace immediately and there is no per-brand copy
 * to change later.
 *
 * `StatusChip` in the `warn` tone, never a hand-rolled pill: the chip resolves `--warn` itself, so
 * no hex value is written here, and the band around it is `bg-surface2` / `border-line` from the
 * token layer. `rounded-card` on the band, `rounded-input` inside the chip — no `rounded-full`
 * anywhere. It is a plain server component with no state, so the `/design-system` page mounts the
 * identical element the route renders.
 */
export function GlobalBadge() {
  return (
    <div
      data-slot="global-badge"
      className="flex flex-col gap-2 rounded-card border border-warn/40 bg-surface2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
    >
      <StatusChip
        tone={GLOBAL_BADGE_TONE}
        label={GLOBAL_BADGE_LABEL}
        className="shrink-0 self-start px-2 py-1 text-xs tracking-[0.12em] sm:self-auto"
      />
      <p className="text-sm text-text2">{GLOBAL_BADGE_NOTE}</p>
    </div>
  );
}
