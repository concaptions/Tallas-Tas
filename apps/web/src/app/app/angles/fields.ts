import { angleStatuses, type AngleStatusesKey } from '@tas/db/schema';
import {
  ANGLE_FORMATS,
  ANGLE_TYPES,
  angleFormatEntries,
  angleTypeEntries,
  type AngleFormatEntry,
  type AngleTypeEntry,
  type InspoLinkKind,
} from '@tas/domain/angles';
import type { ChipTone, CreativeTrack, InternalStatusKey } from '@tas/domain/state';

import { briefPath, conceptPath } from '@/lib/routes';

import { internalStatusView as conceptInternalStatusView } from '../concepts/fields';
import { internalStatusView as briefInternalStatusView } from '../creative-design/fields';
import type { AngleFieldName } from './actions';

/**
 * How the Angles route presents what it stores (PRD §5.6). One module, so the table, the panel and
 * the `/design-system` preview cannot drift: the label a strategist reads, the tone each chip
 * carries, how many format chips fit on a row before they collapse, and how a long linked name is
 * shortened are all stated exactly once.
 *
 * Nothing here invents a vocabulary. `ANGLE_FORMATS` and `ANGLE_TYPES` come from
 * `@tas/domain/angles` (which mirrors the `angleFormats` / `angleTypes` pg enums verbatim), and the
 * Status select comes from `angleStatuses` in `@tas/db/schema`: a component renders its LABELS and
 * stores its KEYS, so no component writes `'Static'`, `'Emotional'` or `'approved'`.
 * `AngleFieldName` is re-exported from `actions.ts` rather than declared a second time: the actions
 * own the union their zod schema validates. A type-only re-export is erased, so this module stays
 * importable from a client component.
 *
 * The schema barrel is pure Drizzle table definitions (the same import `personas/fields.ts` and
 * `creative-sheet/fields.ts` make), so it is safe in a client bundle; `@tas/db` itself — the
 * driver — is deliberately not imported here, because the panel is a client component.
 */
export type { AngleFieldName };
export { ANGLE_FORMATS, ANGLE_TYPES, angleFormatEntries, angleTypeEntries };
export type { AngleFormatEntry, AngleTypeEntry };

/** The dash an unlinked row or an empty array shows, so a blank cell is never just a gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** The "None" option of a nullable dropdown. Its value is `''`, which the action stores as NULL. */
export const NONE_OPTION_LABEL = 'None';

/** The `<select>` value that means "no link". Empty, never the string `'none'`. */
export const NONE_VALUE = '';

/** The tone each linked table chip carries. Stated once so the table and the preview agree. */
export const PERSONA_CHIP_TONE: ChipTone = 'info';
export const PRODUCT_CHIP_TONE: ChipTone = 'mute';
export const FORMAT_CHIP_TONE: ChipTone = 'accent';
export const CREATIVE_MODULE_CHIP_TONE: ChipTone = 'info';

/** The Status select's label: Gratsi's field name, which the parity spec asserts verbatim. */
export const STATUS_LABEL = 'Status';

/**
 * The heading of the panel section the Status select sits in. It is NOT one of the six field
 * groups (`ANGLE_FIELD_GROUPS`): Status is the client-approval track of the angle, a different axis
 * from the hypothesis and its targeting, so it gets its own section after them, as "Linked work"
 * does — and the six-heading assertion the E2E spec makes on the groups stays true.
 */
export const APPROVAL_HEADING = 'Approval';

/**
 * The other three sections that sit under the six groups, each outside `ANGLE_FIELD_GROUPS` for the
 * same reason Approval is: Inspiration holds the ad-inspiration link editor, Assessment the
 * strategist's own read of the angle (Potential and Winning, a different axis again from the
 * client's Status), and Notes the two free-text columns, one of which a client never sees.
 */
export const INSPIRATION_HEADING = 'Inspiration';
export const ASSESSMENT_HEADING = 'Assessment';
export const NOTES_HEADING = 'Notes';

/**
 * Gratsi's field names, verbatim, for the controls the panel renders outside the prose groups. The
 * parity spec looks each one up as the exact text of a label, so none is built from another string.
 */
export const FORMATS_LABEL = 'Formats to create';
export const AD_INSPO_LABEL = 'Ad Inspo';
export const WINNING_LABEL = 'Winning';
export const CONCEPTS_LABEL = 'Concepts';
export const CREATIVE_DESIGNS_LABEL = 'Creatives';

/** What the Ad Inspo editor says under its rows while none of them holds a link. */
export const NO_AD_INSPO_NOTICE =
  'No ad inspiration saved yet. Paste the full http(s) URL of a reference ad.';

/** One Status value, ready to render: the stored key, its label and the chip tone it carries. */
export interface AngleStatusView {
  readonly key: string;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The tone of each Status, keyed on the KEY. A local total map rather than `chipTone(label)`
 * because Gratsi spells the first option "Pending For Approval" (capital F), which the domain's
 * label map has no rule for; where a label IS one `chipTone` rules on — Approved, Needs Revisions,
 * Revisions Submitted — the two agree, and `fields.test.ts` pins that. Waiting on the client is
 * `info`, the client's refusal is `warn`, the two hand-backs rest at `mute`.
 */
const ANGLE_STATUS_TONE: Record<AngleStatusesKey, ChipTone> = {
  pending_for_approval: 'info',
  revised: 'mute',
  approved: 'ok',
  needs_revisions: 'warn',
  revisions_submitted: 'mute',
};

/** The Status dropdown's options, in vocabulary order, each already carrying its tone. */
export const ANGLE_STATUS_OPTIONS: readonly AngleStatusView[] = angleStatuses.map((entry) => ({
  key: entry.key,
  label: entry.label,
  tone: ANGLE_STATUS_TONE[entry.key],
}));

/**
 * The view of one stored Status key, or null for an unset select — the column is nullable, and
 * 12 of Gratsi's 43 live angles carry none. Total on purpose: a key this build does not list
 * renders its own value in the muted tone rather than an empty cell.
 */
export function angleStatusView(key: string | null): AngleStatusView | null {
  if (key === null) return null;
  return (
    ANGLE_STATUS_OPTIONS.find((option) => option.key === key) ?? { key, label: key, tone: 'mute' }
  );
}

/**
 * One row of a read-only linked-record list in the panel: what the chip says, where it goes, and
 * the tone it carries. Plain data, so the server page can build it and hand it to the client panel
 * without the panel ever importing `@tas/db`.
 */
export interface LinkedRecord {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  /** The tone of the chip the LABEL renders as — for a record whose name is the whole chip. */
  readonly chip?: ChipTone;
  /**
   * A status chip beside the label, for a record whose label is a generated name (a concept's
   * Batch-Angle-Theme, a brief's §7 name) that the panel prints in `font-mono` rather than as a chip.
   */
  readonly status?: { readonly label: string; readonly tone: ChipTone };
}

/** The slice of a creative module row this page reads: `creative_module_angles`, inverted. */
export interface CreativeModuleLinkSource {
  readonly id: string;
  readonly moduleName: string;
  readonly angleIds: readonly string[];
}

/**
 * `creative_module_angles` read from the angle's side: `angleId -> [module, …]`, each module once
 * per angle it links, alphabetical by name so the panel's order does not depend on which module
 * was edited last. No href: the Creative Modules workspace is removed from the app (2026-10-09), so
 * the module renders as a named chip only. An angle no module links is absent, and the caller reads that as an empty list.
 * A plain object rather than a `Map` because it crosses the server → client prop boundary.
 */
export function indexCreativeModulesByAngle(
  modules: readonly CreativeModuleLinkSource[],
): Record<string, LinkedRecord[]> {
  const byAngle: Record<string, LinkedRecord[]> = {};
  for (const creativeModule of modules) {
    const record: LinkedRecord = {
      id: creativeModule.id,
      label: creativeModule.moduleName,
      chip: CREATIVE_MODULE_CHIP_TONE,
    };
    for (const angleId of new Set(creativeModule.angleIds)) {
      (byAngle[angleId] ??= []).push(record);
    }
  }
  for (const records of Object.values(byAngle)) {
    records.sort((a, b) => a.label.localeCompare(b.label));
  }
  return byAngle;
}

/** What the Linked work section says in place of an empty Concepts or Creative Designs list. */
export const NO_CONCEPTS_NOTICE =
  'No concept is paired with this angle yet. Pair one from the concept’s own page.';
export const NO_CREATIVE_DESIGNS_NOTICE =
  'No creative points at this angle yet. Set it from the creative’s own page.';

/**
 * The minimum a concept row has to carry to be listed on an angle: the junction ids that make it a
 * reverse link, the generated Batch-Angle-Theme name, and its internal status already narrowed to a
 * key by `loadConcepts` (`ConceptRow` in `@/lib/concepts-source`). Structural, so nothing is
 * re-narrowed here and the fixtures a test builds need no more than these four fields.
 */
export interface ConceptLinkSource {
  readonly id: string;
  readonly name: string;
  readonly angleIds: readonly string[];
  readonly internalStatus: InternalStatusKey;
}

/**
 * `concept_angles` read from the angle's side: `angleId -> [concept, …]`, each concept once per
 * angle it is paired with and in the rows' order (newest edit first, as `loadConcepts` returns
 * them). The label is the concept's generated name (non-negotiable 6; the panel renders it in
 * `font-mono`), the link is the concept's own detail route, and the status is the Concepts module's
 * `internalStatusView` on the track concepts run on. The track is a parameter rather than an import
 * because `CONCEPT_TRACK` lives in `@/lib/concepts-source` next to `@tas/db`, which this
 * client-importable module must not reach; the page reads it once and hands it in. A plain object
 * rather than a `Map` because it crosses the server → client prop boundary.
 */
export function indexConceptsByAngle(
  rows: readonly ConceptLinkSource[],
  track: CreativeTrack,
): Record<string, LinkedRecord[]> {
  const byAngle: Record<string, LinkedRecord[]> = {};
  for (const row of rows) {
    const status = conceptInternalStatusView(track, row.internalStatus);
    const record: LinkedRecord = {
      id: row.id,
      label: row.name,
      href: conceptPath(row.id),
      status: { label: status.label, tone: status.tone },
    };
    for (const angleId of new Set(row.angleIds)) {
      (byAngle[angleId] ??= []).push(record);
    }
  }
  return byAngle;
}

/**
 * The minimum a brief row has to carry to be listed on an angle: the FK that makes it a reverse
 * link, the generated §7 name, and its internal status already narrowed to a key of its own track
 * by `loadBriefs` (`BriefRow` in `@/lib/briefs-source`).
 */
export interface CreativeDesignLinkSource {
  readonly id: string;
  readonly name: string;
  readonly angleId: string | null;
  readonly track: CreativeTrack;
  readonly internalStatus: InternalStatusKey;
}

/**
 * `creative_briefs.angle_id` inverted: `angleId -> [brief, …]` in the rows' order (newest edit
 * first). A brief with no angle — the ordinary case for one briefed through its concept — appears
 * under no angle. The label is the brief's generated name, the link is its own detail route, and
 * the status is the Creative Design module's `internalStatusView` on the brief's track, so a static
 * and a video read their status exactly as they do on their page.
 */
export function indexCreativeDesignsByAngle(
  rows: readonly CreativeDesignLinkSource[],
): Record<string, LinkedRecord[]> {
  const byAngle: Record<string, LinkedRecord[]> = {};
  for (const row of rows) {
    if (row.angleId === null) continue;
    const status = briefInternalStatusView(row.track, row.internalStatus);
    (byAngle[row.angleId] ??= []).push({
      id: row.id,
      label: row.name,
      href: briefPath(row.id),
      status: { label: status.label, tone: status.tone },
    });
  }
  return byAngle;
}

/**
 * How many format chips a table row shows before the rest collapse into `+N`. Three is what fits
 * beside four other columns on a phone without the row wrapping to a second line.
 */
export const MAX_ROW_FORMATS = 3;

export interface FormatChipRow {
  readonly shown: readonly AngleFormatEntry[];
  /** How many selected formats are not shown; `0` when they all fit. */
  readonly overflow: number;
}

/**
 * The format chips of one table row: always in `ANGLE_FORMATS` order, never more than
 * `MAX_ROW_FORMATS` of them, with the remainder counted rather than dropped.
 */
export function formatChipRow(formats: readonly string[]): FormatChipRow {
  const entries = angleFormatEntries(formats);
  return {
    shown: entries.slice(0, MAX_ROW_FORMATS),
    overflow: Math.max(entries.length - MAX_ROW_FORMATS, 0),
  };
}

/** The `+N` chip's label. Separate from the count so the table never builds a string inline. */
export function overflowLabel(overflow: number): string {
  return `+${String(overflow)}`;
}

/**
 * The chip form of a linked row's name. The seeded personas are written as
 * `Denise — peri-menopausal, awake at 3am with night sweats`: the half before the em dash is the
 * name, and the half after it is the research. A chip shows the first half and the cell carries the
 * whole string in its `title`, so nothing is lost and no row is 60 characters wide.
 */
export function chipLabel(value: string): string {
  const [head] = value.split(` ${EM_DASH} `);
  const trimmed = (head ?? value).trim();
  return trimmed === '' ? value.trim() : trimmed;
}

/** The short source name on an ad-inspiration card. `parseInspoLink` owns which kind a URL is. */
const INSPO_SOURCE_LABELS: Record<InspoLinkKind, string> = {
  'meta-ad-library': 'Meta',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  other: 'Link',
};

export function inspoSourceLabel(kind: InspoLinkKind): string {
  return INSPO_SOURCE_LABELS[kind];
}

/** One free-text column as the panel renders it: a `Textarea` (or, for the name, an `Input`). */
export interface AngleProseField {
  readonly name: AngleFieldName;
  readonly label: string;
  readonly hint?: string;
}

export interface AngleFieldGroup {
  readonly heading: string;
  /** The prose fields of the group; `Targeting` renders its own controls and carries none. */
  readonly fields: readonly AngleProseField[];
}

/**
 * Potential is Gratsi's free-text read of how far the angle could go (`angles.potential`); the
 * Kanban view groups on it, so a strategist writes it as one short phrase rather than a paragraph.
 * A textarea, never a select: nothing fixes its vocabulary.
 */
export const POTENTIAL_FIELD: AngleProseField = {
  name: 'potential',
  label: 'Potential',
  hint: 'How far this angle could go, in your own words. The Kanban view groups on it.',
};

/**
 * The two note columns, in the Notes section. Internal Notes is team-only (non-negotiable 10 —
 * the client interface never reads it); Client Notes is what the client said about the angle.
 */
export const ANGLE_NOTE_FIELDS: readonly AngleProseField[] = [
  {
    name: 'internalNotes',
    label: 'Internal Notes',
    hint: 'Team only. A client never sees this field.',
  },
  {
    name: 'clientNotes',
    label: 'Client Notes',
    hint: 'What the client said about this angle, kept with it.',
  },
];

/**
 * The panel's six headings, in this order, and the prose field each text group owns.
 *
 * `Identity` is not in PRD §5.6's field list as a group — it exists because an angle cannot be
 * created without a name, and the name is the one field the header cannot double as an input for.
 * `Targeting` and `Inspiration` carry no prose field: their controls are the two dropdowns, the two
 * toggle rows and the link editor, all of which the panel renders itself.
 */
export const ANGLE_FIELD_GROUPS: readonly AngleFieldGroup[] = [
  {
    heading: 'Identity',
    fields: [{ name: 'name', label: 'Angle Name' }],
  },
  {
    heading: 'Hypothesis',
    fields: [
      {
        name: 'description',
        label: 'Description',
        hint: 'What you believe is true about this persona, and why an ad built on it should work.',
      },
    ],
  },
  {
    heading: 'Pain Points',
    fields: [{ name: 'painPoints', label: 'Pain Points' }],
  },
  {
    heading: 'USP',
    fields: [{ name: 'usp', label: 'USP' }],
  },
  { heading: 'Targeting', fields: [] },
  {
    heading: 'Resources',
    fields: [
      { name: 'briefUrl', label: 'Brief URL', hint: 'Link to the brief document for this angle.' },
      {
        name: 'exactScriptUrl',
        label: 'Exact Script URL',
        hint: 'Link to the exact script document for this angle.',
      },
    ],
  },
];

/** Just the headings, for the panel's section list and for the E2E assertion. */
export const ANGLE_GROUP_HEADINGS: readonly string[] = ANGLE_FIELD_GROUPS.map(
  (group) => group.heading,
);

/** Why the Type toggles are inert on this page: Type is read-only until the Concepts phase. */
export const TYPE_SOON_HINT = 'Type is set with the Concepts phase; this page does not write it.';
