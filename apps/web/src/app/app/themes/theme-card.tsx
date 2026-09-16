import { StatusChip } from '@tas/ui';

import {
  overflowLabel,
  referenceChipRow,
  themeCategoryLabel,
  themeCategoryTone,
  usageLabel,
  type ThemeCardRow,
} from './fields';

interface ThemeCardProps {
  readonly theme: ThemeCardRow;
}

/**
 * One theme in the library grid (PRD §5.5). A CARD, never a table row: a theme is a thing you
 * browse and recognise, not a queue you work down, and a note that reads in two lines is the
 * reason anyone picks one theme over another.
 *
 * Three things, in this order, are the card's contract (ticket criterion 4): the name, the category
 * chip and the usage line. The name is the strategist's own words — themes are the one table whose
 * name is typed rather than generated — so it is `font-sans`, not `font-mono`.
 *
 * The category tone comes from `themeCategoryTone`, never from a local choice, so the same kind is
 * the same colour in the grid, in the filter row and on `/design-system`. The usage line is
 * `usageLabel` from `@tas/domain/themes`, which owns the zero and singular cases: "Used by no
 * brands yet", never "Used by 0 brands". Below the contract sit the two things that make a card
 * worth reading — the note, clamped to two lines so every card in a row is the same height, and
 * the reference links as host-only chips, because a swipe-file URL is 80 characters wide.
 *
 * Presentational and stateless, so the `/design-system` page mounts the identical element the grid
 * renders, and it takes `ThemeCardRow` rather than `ThemeListRow` so that preview can hand it a
 * plain object without importing `@tas/db`.
 */
export function ThemeCard({ theme }: ThemeCardProps) {
  const links = referenceChipRow(theme.referenceLinks);

  return (
    <article
      data-slot="theme-card"
      data-theme-id={theme.id}
      data-category={theme.category}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-text" data-slot="theme-name">
          {theme.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip
            tone={themeCategoryTone(theme.category)}
            label={themeCategoryLabel(theme.category)}
          />
        </div>
        <p className="text-sm text-text3" data-slot="theme-usage">
          {usageLabel(theme.usedByBrandCount)}
        </p>
      </div>

      {theme.notes === null || theme.notes.trim() === '' ? null : (
        <p
          data-slot="theme-note"
          title={theme.notes}
          className="line-clamp-2 text-sm leading-relaxed text-text2"
        >
          {theme.notes}
        </p>
      )}

      {links.shown.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-1.5" data-slot="theme-links">
          {links.shown.map((chip) => (
            <a
              key={chip.url}
              href={chip.url}
              target="_blank"
              rel="noreferrer noopener"
              title={chip.url}
              data-slot="theme-link"
              className="inline-flex items-center rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] leading-none text-text3 hover:border-line2 hover:text-text2"
            >
              {chip.host}
            </a>
          ))}
          {links.overflow === 0 ? null : (
            <StatusChip tone="mute" label={overflowLabel(links.overflow)} />
          )}
        </div>
      )}
    </article>
  );
}
