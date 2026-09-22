import type { ChipTone } from '@tas/domain/state';

/**
 * The twelve AI Characters fields and the presentation rules the table, the panel and the Server
 * Actions all read. One module, so a label, a group heading, a chip tone or the dash an unset value
 * renders as cannot drift between them — the same discipline `personas/fields.ts` and
 * `products/fields.ts` follow.
 *
 * `status` is stored as plain `text` in `packages/db/src/schema/ai-characters.ts` (no pg enum
 * exists for it yet), so — exactly like `stageOfAwareness` reads its labels from a local table in
 * `personas/fields.ts` rather than a magic string — the three values and their tones are declared
 * once, here, and everything else imports them.
 */
export type AiCharacterFieldName =
  | 'name'
  | 'status'
  | 'attachments'
  | 'basicInfo'
  | 'toneOfVoice'
  | 'voiceLink'
  | 'personalityTraits'
  | 'appearance'
  | 'traitsAndHabits'
  | 'hobbiesAndLifestyle'
  | 'workAndBackground'
  | 'whyPromotesBrand';

export type AiCharacterStatus = 'active' | 'draft' | 'archived';

export const AI_CHARACTER_STATUSES: readonly AiCharacterStatus[] = ['active', 'draft', 'archived'];

const STATUS_PRESENTATION: Record<AiCharacterStatus, { label: string; tone: ChipTone }> = {
  active: { label: 'Active', tone: 'ok' },
  draft: { label: 'Draft', tone: 'mute' },
  archived: { label: 'Archived', tone: 'bad' },
};

/** The three statuses in their canonical order, ready for the Select and the table's chip. */
export const AI_CHARACTER_STATUS_OPTIONS: readonly {
  value: AiCharacterStatus;
  label: string;
  tone: ChipTone;
}[] = AI_CHARACTER_STATUSES.map((value) => ({ value, ...STATUS_PRESENTATION[value] }));

/** True for any string this table actually stores as a status; a legacy or hand-edited row may not. */
export function isAiCharacterStatus(value: string): value is AiCharacterStatus {
  return (AI_CHARACTER_STATUSES as readonly string[]).includes(value);
}

export function aiCharacterStatusLabel(status: string): string {
  return isAiCharacterStatus(status) ? STATUS_PRESENTATION[status].label : status;
}

export function aiCharacterStatusTone(status: string): ChipTone {
  return isAiCharacterStatus(status) ? STATUS_PRESENTATION[status].tone : 'mute';
}

export interface AiCharacterField {
  readonly name: AiCharacterFieldName;
  readonly label: string;
  /** `input` is one line, `textarea` is prose, `status` is the active/draft/archived Select. */
  readonly kind: 'input' | 'textarea' | 'status';
}

export interface AiCharacterFieldGroup {
  readonly heading: string;
  readonly fields: readonly AiCharacterField[];
}

/** The four headings, in this order. The panel renders exactly these and nothing else. */
export const AI_CHARACTER_FIELD_GROUPS: readonly AiCharacterFieldGroup[] = [
  {
    heading: 'Identity',
    fields: [
      { name: 'name', label: 'Character Name', kind: 'input' },
      { name: 'status', label: 'Status', kind: 'status' },
      { name: 'attachments', label: 'Attachments (file URLs)', kind: 'input' },
    ],
  },
  {
    heading: 'Voice',
    fields: [
      { name: 'toneOfVoice', label: 'Tone of Voice', kind: 'textarea' },
      { name: 'voiceLink', label: 'Voice Link / ElevenLabs', kind: 'input' },
    ],
  },
  {
    heading: 'Personality & Appearance',
    fields: [
      { name: 'personalityTraits', label: 'Personality Traits', kind: 'textarea' },
      { name: 'appearance', label: 'Appearance', kind: 'textarea' },
      { name: 'traitsAndHabits', label: 'Traits & Habits', kind: 'textarea' },
    ],
  },
  {
    heading: 'Background',
    fields: [
      { name: 'basicInfo', label: 'Basic Info', kind: 'textarea' },
      { name: 'hobbiesAndLifestyle', label: 'Hobbies & Lifestyle', kind: 'textarea' },
      { name: 'workAndBackground', label: 'Work & Background', kind: 'textarea' },
      { name: 'whyPromotesBrand', label: 'Why Promotes This Brand', kind: 'textarea' },
    ],
  },
];

/** Every field, flattened; the Server Actions' zod schema is built from this list. */
export const AI_CHARACTER_FIELDS: readonly AiCharacterField[] = AI_CHARACTER_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** The dash a null cell or an unset field shows, so an empty value is never a blank gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** How many characters of Basic Info the table cell shows before it is cut with an ellipsis. */
const BASIC_INFO_PREVIEW_LENGTH = 80;

/** The Basic Info table cell: a short preview, never the full paragraph, with the whole value as `title`. */
export function basicInfoPreview(value: string | null): string {
  if (value === null || value.trim() === '') {
    return EM_DASH;
  }
  const trimmed = value.trim();
  return trimmed.length > BASIC_INFO_PREVIEW_LENGTH
    ? `${trimmed.slice(0, BASIC_INFO_PREVIEW_LENGTH).trimEnd()}…`
    : trimmed;
}

/** Whether a row's searchable text contains the (already-lowercased) query. */
export function matchesAiCharacterSearch(
  character: { readonly name: string; readonly basicInfo: string | null },
  query: string,
): boolean {
  if (query === '') {
    return true;
  }
  return [character.name, character.basicInfo ?? ''].some((value) =>
    value.toLowerCase().includes(query),
  );
}

/** "3 characters" / "1 of 3 characters" for the header count line. */
export function countLabel(visible: number, total: number): string {
  const noun = total === 1 ? 'character' : 'characters';
  return visible === total
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}

export const EMPTY_LIBRARY_HINT =
  'No AI characters yet. Start with the persona your ads speak through.';
export const EMPTY_SEARCH_HINT_PREFIX = 'Nothing matches';
