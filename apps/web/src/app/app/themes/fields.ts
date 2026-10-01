import {
  NO_USAGE_LABEL,
  THEME_CATEGORIES,
  THEME_CATEGORY_KEYS,
  THEME_STATUSES,
  themeCategoryLabel,
  themeCategoryTone,
  themeStatusLabel,
  themeStatusTone,
  usageLabel,
  type ThemeCategoryEntry,
  type ThemeCategoryKey,
  type ThemeStatusEntry,
  type ThemeStatusKey,
} from '@tas/domain/themes';
import type { ChipTone } from '@tas/domain/state';

import { hostLabel } from '../products/fields';
import type { ThemeFieldName } from './actions';

/**
 * How the Themes route presents what the GLOBAL library stores (PRD §5.5). One module, so the card
 * grid, the filter row, the New theme dialog and the `/design-system` preview cannot drift: the
 * copy of the GLOBAL badge, the chip tone of a category, the filter vocabulary, how a note is
 * clamped and how a reference link is shortened are each stated exactly once.
 *
 * Nothing here invents a vocabulary. The three categories come from `THEME_CATEGORIES` in
 * `@tas/domain/themes` (which mirrors the `themeCategories` tuple and its `theme_category` pg enum
 * verbatim), so no component writes `'Production Style'`, exactly as no component writes a status
 * string. The "used by N brands" sentence is `usageLabel` from the same package: a component that
 * interpolated the count itself would get both ends of the range wrong.
 *
 * A category is a KIND, not a state. The optional `status` column tracks workflow progress
 * (not_started / in_progress / done / archived) through `THEME_STATUSES` from `@tas/domain/themes`.
 *
 * `ThemeFieldName` is re-exported from `actions.ts` rather than declared a second time: the actions
 * own the union their zod schema validates. A type-only re-export is erased, so this module stays
 * importable from a client component, and `@tas/db` is deliberately absent for the same reason — a
 * runtime import of that package would drag the database driver into the browser bundle.
 */
export type {
  ThemeFieldName,
  ThemeCategoryEntry,
  ThemeCategoryKey,
  ThemeStatusEntry,
  ThemeStatusKey,
};
export {
  NO_USAGE_LABEL,
  THEME_CATEGORIES,
  THEME_CATEGORY_KEYS,
  THEME_STATUSES,
  themeCategoryLabel,
  themeCategoryTone,
  themeStatusLabel,
  themeStatusTone,
  usageLabel,
};

/**
 * The GLOBAL badge (PRD §5.5, CLAUDE.md non-negotiable 3). This page's entire point is that the
 * library is NOT per-brand, so the sentence is part of the specification rather than a label a
 * component may reword. `warn` is the tone because the badge is a caution — an edit here lands in
 * every client's workspace immediately — and it resolves to `--warn` through `StatusChip`, so no
 * hex value is written anywhere on this page.
 */
export const GLOBAL_BADGE_LABEL = 'GLOBAL';
export const GLOBAL_BADGE_TONE: ChipTone = 'warn';
export const GLOBAL_BADGE_NOTE =
  'One library, shared by every brand. A theme added here is available to every client immediately.';

/** The line under the heading: the count is the whole platform's, never the current brand's. */
export function libraryCountLabel(total: number): string {
  const count = Math.max(Math.floor(total), 0);
  return `${String(count)} ${count === 1 ? 'theme' : 'themes'} across the whole platform`;
}

/** The count line while a filter is narrowing the grid, so "6 themes" never contradicts 2 cards. */
export function filteredCountLabel(visible: number, total: number): string {
  return `${String(Math.max(Math.floor(visible), 0))} of ${libraryCountLabel(total)}`;
}

/** The "no category chosen" filter. Not a stored value, which is why it is not in the tuple. */
export const ALL_CATEGORIES = 'All';

export type CategoryFilter = typeof ALL_CATEGORIES | ThemeCategoryKey;

export interface CategoryFilterEntry {
  readonly key: CategoryFilter;
  readonly label: string;
  /** `All` is quiet; each real category keeps the tone its chip carries everywhere else. */
  readonly tone: ChipTone;
}

/**
 * The filter chip row: `All`, then the three categories in the one order the vocabulary states.
 * Built from `THEME_CATEGORIES`, so a fourth kind appears here the moment the enum grows one.
 */
export const CATEGORY_FILTERS: readonly CategoryFilterEntry[] = [
  { key: ALL_CATEGORIES, label: 'All', tone: 'mute' },
  ...THEME_CATEGORIES.map((entry) => ({ key: entry.key, label: entry.label, tone: entry.tone })),
];

/**
 * The `?category=` parameter as a filter.
 *
 * Total on purpose: a value this build does not know (a hand-typed parameter, a link from a newer
 * build) falls back to `All` rather than rendering an empty grid a visitor cannot explain. A `+`
 * is read as a space first, so `?category=Production+Style` — the form encoding another tool may
 * produce — means the same thing as the `%20` this page writes.
 */
export function categoryFromParam(value: string | null | undefined): CategoryFilter {
  if (value === undefined || value === null) {
    return ALL_CATEGORIES;
  }
  // Matched case- and separator-insensitively: the keys are display labels ("Production Style"), and a
  // shared link is as likely to carry `?category=production-style` or `production_style`. Silently
  // dropping the filter would hand someone a URL that does not show what they linked to.
  const normalise = (raw: string) => raw.replace(/[\s+_-]+/g, '').toLowerCase();
  const wanted = normalise(value);
  const match = CATEGORY_FILTERS.find((entry) => normalise(entry.key) === wanted);
  return match === undefined ? ALL_CATEGORIES : match.key;
}

/** What the card renders. Narrower than `ThemeListRow`, so a preview can pass a plain object. */
export interface ThemeCardRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly status: string | null;
  readonly notes: string | null;
  readonly referenceLinks: readonly string[] | null;
  readonly usedByBrandCount: number;
  readonly isActive: boolean;
  /**
   * The other Gratsi stored fields the labelled rows read: the stored `assignee_id`, the
   * `assigneeName` `@tas/db` resolves for it, the attachment URLs the importer captured and the AI
   * "Attachment Summary". Optional so the `/design-system` sample rows, which predate them, still
   * type; a grid row always carries them, and a missing one renders the same dash a null does.
   */
  readonly assigneeId?: string | null;
  readonly assigneeName?: string | null;
  readonly attachments?: readonly string[] | null;
  readonly aiAttachmentSummary?: string | null;
}

/** A theme is in the grid when its category matches the chip row and its text matches `?q=`. */
export function matchesCategory(theme: ThemeCardRow, filter: CategoryFilter): boolean {
  return filter === ALL_CATEGORIES || theme.category === filter;
}

/** A letter or a digit; anything else (space, hyphen, slash, punctuation) opens a new word. */
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * `haystack` contains `needle` at the start of a word.
 *
 * A plain `includes` is wrong here because the notes are prose: searching `green` would surface
 * the Spring x Soccer note for the word "evergreen", and a strategist reading a grid of two cards
 * cannot see why the second one is there. Matching only where the previous character is not a
 * letter or a digit keeps every match a reader can point at, while staying a prefix match inside
 * the word — `season` still finds "Seasonal", and a hyphenated query like `sleep-tracker` still
 * finds the phrase, because the hyphen is part of the needle rather than a boundary in it.
 */
function containsWordStart(haystack: string, needle: string): boolean {
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    if (at === 0 || !WORD_CHARACTER.test(haystack.charAt(at - 1))) {
      return true;
    }
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
}

/**
 * The search reads the two things a strategist would look a theme up by: what it is called and
 * what the note says about when to reach for it. `query` arrives already lowercased and trimmed.
 */
export function matchesQuery(theme: ThemeCardRow, query: string): boolean {
  if (query === '') {
    return true;
  }
  return [theme.name, theme.notes ?? ''].some((value) =>
    containsWordStart(value.toLowerCase(), query),
  );
}

export interface ReferenceChip {
  readonly url: string;
  /** The host alone: a swipe-file URL is 80 characters and would break the card on a phone. */
  readonly host: string;
}

/** How many reference chips a card shows before the rest are counted rather than listed. */
export const MAX_CARD_LINKS = 3;

export interface ReferenceChipRow {
  readonly shown: readonly ReferenceChip[];
  /** How many saved links are not shown; `0` when they all fit. */
  readonly overflow: number;
}

/**
 * The reference links of one card, as host-only chips. Blank entries are dropped (the stored array
 * is written by a form that keeps a trailing empty row) and a value that is not a parseable URL
 * keeps its own text rather than vanishing — the strategist typed it, and hiding it would hide the
 * mistake too.
 */
export function referenceChipRow(links: readonly string[] | null): ReferenceChipRow {
  const chips: ReferenceChip[] = [];
  for (const link of links ?? []) {
    const url = link.trim();
    const host = hostLabel(url);
    if (host !== null) {
      chips.push({ url, host });
    }
  }
  return {
    shown: chips.slice(0, MAX_CARD_LINKS),
    overflow: Math.max(chips.length - MAX_CARD_LINKS, 0),
  };
}

/** The `+N` chip's label, so no component builds that string inline. */
export function overflowLabel(overflow: number): string {
  return `+${String(overflow)}`;
}

/**
 * The card's labelled rows (PRD §5.5; Airtable parity). A theme is a CARD, never a table row, but
 * every Gratsi stored field still reads under its own label, so a strategist is never guessing
 * whether a line of prose is the note or the AI summary. These are the exact label texts, stated
 * once here and never in a component; the parity spec looks for each of them inside the first card.
 */
export const THEME_FIELD_LABELS = {
  notes: 'Notes',
  assignee: 'Assignee',
  status: 'Status',
  attachments: 'Attachments',
  attachmentSummary: 'Attachment Summary',
} as const;

/** What an empty row shows: the same dash every workspace table uses, never a blank under a label. */
export const EMPTY_FIELD = '—';

/**
 * A text field as the card shows it: trimmed, or `null` when there is nothing to show. A literal
 * `"null"` / `"undefined"` is an import artefact (a collaborator cell serialised as text), never a
 * value a reader should see, so it reads as empty too.
 */
export function textValue(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text === '' || text === 'null' || text === 'undefined' ? null : text;
}

export interface ThemeStatusChip {
  readonly tone: ChipTone;
  readonly label: string;
}

/**
 * The Status row's chip, tone and label both from the theme vocabulary in `@tas/domain/themes`;
 * `null` when there is no status, so the row shows the dash rather than a chip reading "—".
 */
export function statusChip(status: string | null | undefined): ThemeStatusChip | null {
  const value = textValue(status);
  return value === null ? null : { tone: themeStatusTone(value), label: themeStatusLabel(value) };
}

export interface AssigneeValue {
  readonly text: string;
  /**
   * True when the card is showing the stored `assignee_id` itself because no live user matched it.
   * An imported Gratsi row stores the Airtable collaborator's display NAME there ("Talal"), so it
   * renders as plain text like a resolved name — never in mono, never as "null" or a blank chip —
   * and the flag only drives the tooltip and the `data-resolved` hook.
   */
  readonly mono: boolean;
}

/** The tooltip on an unresolved assignee, so the stored value explains itself. */
export const UNRESOLVED_ASSIGNEE_HINT =
  'Stored assignee value from the Airtable import; it matches no user on the platform yet.';

/**
 * The Assignee row: the resolved full name when `@tas/db` found the user, else the stored value
 * itself — an imported Gratsi row stores the Airtable collaborator's name there, and hiding it would
 * hide the one clue to who owns the theme — or `null` for the dash. Both read as plain text.
 */
export function assigneeValue(
  theme: Pick<ThemeCardRow, 'assigneeId' | 'assigneeName'>,
): AssigneeValue | null {
  const name = textValue(theme.assigneeName);
  if (name !== null) {
    return { text: name, mono: false };
  }
  const stored = textValue(theme.assigneeId);
  return stored === null ? null : { text: stored, mono: true };
}

export interface AttachmentChip {
  readonly url: string;
  /** The file name when the URL ends in one, else the host: an Airtable CDN URL is 200 characters. */
  readonly label: string;
}

export interface AttachmentChipRow {
  readonly shown: readonly AttachmentChip[];
  /** How many saved attachments are not shown; `0` when they all fit. */
  readonly overflow: number;
}

/** A path's last segment reads as a file name when it ends in a short extension (`cover.png`). */
const FILE_NAME = /\.[A-Za-z0-9]{1,8}$/;

/**
 * What an attachment chip says. The importer keeps only the URL of each Airtable attachment, and a
 * signed CDN URL carries the file name as its last path segment when it carries one at all; when it
 * does not, the host is the most a chip can honestly say, exactly as the reference chips do.
 */
export function attachmentLabel(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter((part) => part !== '');
    const last = parts[parts.length - 1];
    if (last !== undefined) {
      const name = decodeURIComponent(last);
      if (FILE_NAME.test(name)) {
        return name;
      }
    }
  } catch {
    // Not a parseable URL, or a malformed escape in it: the host-or-value label below still holds.
  }
  return hostLabel(url) ?? url;
}

/**
 * The attachments of one card as chips, capped at `MAX_CARD_LINKS` like the reference links so a
 * theme with twelve stills counts the rest rather than listing them. Blank entries are dropped.
 */
export function attachmentChipRow(urls: readonly string[] | null | undefined): AttachmentChipRow {
  const chips: AttachmentChip[] = [];
  for (const entry of urls ?? []) {
    const url = entry.trim();
    if (url !== '') {
      chips.push({ url, label: attachmentLabel(url) });
    }
  }
  return {
    shown: chips.slice(0, MAX_CARD_LINKS),
    overflow: Math.max(chips.length - MAX_CARD_LINKS, 0),
  };
}

/** The dialog's placeholder for an untouched field, matching every other route. */
export const NOT_SET = 'Not set';

/** Why the dialog's Reference Links row is inert: link editing ships with Attachments. */
export const REFERENCE_LINKS_SOON_HINT =
  'Reference links are edited with Attachments in a later ticket; this dialog does not write them.';

/** What the dialog footer says instead of offering a save when there is no database to write to. */
export const DEMO_DIALOG_NOTICE = 'Demo mode — changes are not saved';
