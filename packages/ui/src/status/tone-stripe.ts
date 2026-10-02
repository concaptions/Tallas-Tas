import type { ChipTone } from '@tas/domain/state';

/**
 * THE left-edge stripe class per chip tone, beside `StatusChip` because it is the same idea in a
 * different shape: a record coloured by the tone the domain gave it, so a brief that chips `warn`
 * also stripes `warn` and the two readings of one record cannot disagree.
 *
 * One map, imported by every view that paints a stripe — the Kanban card and the briefs table row.
 * It used to be a private const in `kanban-board.tsx` copied into the briefs `fields.ts`; two maps
 * drift the moment a tone is added or a token renamed, which is exactly the duplication UI
 * governance rule 3 forbids for the pill itself.
 *
 * Semantic token classes only (`border-l-ok`, …) — the colour of a tone is the token layer's
 * business and is never a hex written here. The caller supplies the width (`border-l-4`), because
 * a card and a table row do not wear the same weight.
 */
export const TONE_STRIPE: Readonly<Record<ChipTone, string>> = {
  ok: 'border-l-ok',
  warn: 'border-l-warn',
  bad: 'border-l-bad',
  info: 'border-l-info',
  accent: 'border-l-accent',
  mute: 'border-l-line2',
};

/** The stripe class for one tone. Total: every `ChipTone` has an entry, so this cannot miss. */
export function toneStripe(tone: ChipTone): string {
  return TONE_STRIPE[tone];
}
